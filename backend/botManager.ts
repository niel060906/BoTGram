import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs-extra";
import { db, BotConfig } from "./db";
import { Server } from "socket.io";

class BotManager {
  private processes: Map<string, ChildProcess> = new Map();
  private ioServer: Server | null = null;
  private restartCounts: Map<string, number> = new Map();

  setIoServer(io: Server) {
    this.ioServer = io;
  }

  // Sync state on startup: If any bot was marked as "running" before a backend crash, reset them
  init() {
    const bots = db.getBots();
    for (const bot of bots) {
      if (bot.status === "running") {
        db.updateBot(bot.id, { status: "stopped", pid: undefined, cpu: 0, ram: 0, uptime: 0 });
      }
    }
    db.insertLog("info", "Bot Manager initialized. Checked and synchronized all bot status counters.");
  }

  async startBot(id: string): Promise<boolean> {
    const bot = db.getBot(id);
    if (!bot) {
      db.insertLog("error", `Cannot start bot: Bot with ID ${id} not found.`);
      return false;
    }

    if (this.processes.has(id)) {
      db.insertLog("warning", `Bot "${bot.name}" is already running.`, id);
      return false;
    }

    db.insertLog("info", `Launching process container for bot: ${bot.name}...`, id);
    
    // Ensure bot workspace folders exist
    const botDir = path.join(process.cwd(), "bots", bot.name);
    fs.ensureDirSync(path.join(botDir, "session"));
    fs.ensureDirSync(path.join(botDir, "database"));
    fs.ensureDirSync(path.join(botDir, "logs"));

    try {
      // Spawn runner via npx tsx
      const runnerPath = path.join(process.cwd(), "core", "runner.ts");
      const child = spawn("npx", ["tsx", runnerPath, bot.name], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          FORCE_COLOR: "1",
        },
      });

      this.processes.set(id, child);
      this.restartCounts.set(id, 0);

      // Update DB to running state
      db.updateBot(id, {
        status: "running",
        pid: child.pid,
        cpu: Math.floor(Math.random() * 5) + 1, // initial mock
        ram: Math.floor(Math.random() * 15) + 10, // initial mock MB
        uptime: 0,
      });

      this.broadcastBotStatus(id, "running");
      db.insertLog("success", `Bot "${bot.name}" launched successfully. PID: ${child.pid}`, id);

      // Stream stdout and parse Core Engine JSON logs
      child.stdout?.on("data", (data) => {
        const text = data.toString();
        this.parseLogBuffer(id, bot.name, text);
      });

      // Stream stderr (crashes / compile errors)
      child.stderr?.on("data", (data) => {
        const text = data.toString().trim();
        if (text) {
          console.error(`[Bot:${bot.name} Error]`, text);
          db.insertLog("error", `Stderr: ${text}`, id);
          this.emitConsoleLine(id, `[CRITICAL_STDERR] ${text}`);
        }
      });

      // Monitor exit
      child.on("close", (code) => {
        this.processes.delete(id);
        const currentBot = db.getBot(id);
        
        db.updateBot(id, {
          status: "stopped",
          pid: undefined,
          cpu: 0,
          ram: 0,
          uptime: 0,
        });

        this.broadcastBotStatus(id, "stopped");
        
        const exitMsg = `Bot process "${bot.name}" exited with code ${code}.`;
        db.insertLog(code === 0 ? "info" : "error", exitMsg, id);
        this.emitConsoleLine(id, `\n[SYSTEM] Process terminated with exit code ${code}`);

        // Handle auto-restart if crashed (non-zero exit code)
        const settings = db.getSettings();
        if (code !== 0 && settings.autoRestart && currentBot) {
          const attempts = this.restartCounts.get(id) || 0;
          if (attempts < 5) {
            const delay = Math.min(3000 * Math.pow(2, attempts), 30000);
            this.restartCounts.set(id, attempts + 1);
            db.insertLog("warning", `Bot crashed! Re-triggering auto-restart in ${delay / 1000}s... (Attempt ${attempts + 1}/5)`, id);
            this.emitConsoleLine(id, `[SYSTEM] Crash detected. Reviving instance in ${delay / 1000}s...`);

            setTimeout(() => {
              // Ensure process wasn't started manually in the meantime
              if (!this.processes.has(id)) {
                this.startBot(id);
              }
            }, delay);
          } else {
            db.insertLog("error", `Auto-restart aborted: Bot "${bot.name}" failed to boot 5 consecutive times.`, id);
            this.emitConsoleLine(id, `[SYSTEM] Loop failure: Bot failed to start continuously. Disabling auto-restart.`);
          }
        }
      });

      return true;
    } catch (err: any) {
      db.insertLog("error", `Process spawn failed: ${err.message}`, id);
      return false;
    }
  }

  async stopBot(id: string): Promise<boolean> {
    const child = this.processes.get(id);
    const bot = db.getBot(id);
    if (!bot) return false;

    if (!child) {
      db.insertLog("warning", `Stop requested for offline bot: ${bot.name}`, id);
      return false;
    }

    db.insertLog("info", `Gracefully stopping bot process: ${bot.name}...`, id);
    this.emitConsoleLine(id, `[SYSTEM] Terminating runner process...`);

    // Kill process
    child.kill("SIGTERM");
    this.processes.delete(id);
    
    db.updateBot(id, {
      status: "stopped",
      pid: undefined,
      cpu: 0,
      ram: 0,
      uptime: 0,
    });

    this.broadcastBotStatus(id, "stopped");
    return true;
  }

  async restartBot(id: string): Promise<boolean> {
    const bot = db.getBot(id);
    if (!bot) return false;

    db.insertLog("info", `Restarting bot: ${bot.name}...`, id);
    this.emitConsoleLine(id, `[SYSTEM] Restart command received. Shutting down...`);

    if (this.processes.has(id)) {
      await this.stopBot(id);
      // Wait briefly for process cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    
    return this.startBot(id);
  }

  private parseLogBuffer(botId: string, botName: string, text: string) {
    const lines = text.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.includes("__LOG_START__") && line.includes("__LOG_END__")) {
        try {
          const raw = line.substring(line.indexOf("__LOG_START__") + 13, line.indexOf("__LOG_END__"));
          const logPayload = JSON.parse(raw);
          
          // Insert into Database
          db.insertLog(logPayload.type, logPayload.message, botId);

          // Emit real-time console formatted line
          const colorMap = {
            info: "\x1b[36m[INFO]\x1b[0m",
            success: "\x1b[32m[SUCCESS]\x1b[0m",
            warning: "\x1b[33m[WARNING]\x1b[0m",
            error: "\x1b[31m[ERROR]\x1b[0m",
          };
          const formattedLine = `${colorMap[logPayload.type as keyof typeof colorMap] || "[LOG]"} ${logPayload.message}`;
          this.emitConsoleLine(botId, formattedLine);
          
          // Broadcast to overall global log list
          this.broadcastGlobalLog(logPayload);
        } catch (err) {
          // Fallback to plain line if JSON parsing fails
          this.emitConsoleLine(botId, line);
        }
      } else {
        // Plain line console output
        console.log(`[Bot:${botName}]`, line);
        this.emitConsoleLine(botId, line);
      }
    }
  }

  private emitConsoleLine(botId: string, text: string) {
    if (this.ioServer) {
      this.ioServer.to(`console:${botId}`).emit("console_output", {
        botId,
        text,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private broadcastBotStatus(botId: string, status: "running" | "stopped") {
    if (this.ioServer) {
      this.ioServer.emit("bot_status_changed", { botId, status });
    }
  }

  private broadcastGlobalLog(payload: any) {
    if (this.ioServer) {
      this.ioServer.emit("global_log_received", payload);
    }
  }

  getBotsWithProcessesCount(): number {
    return this.processes.size;
  }

  // Periodic updates for active CPU / RAM telemetry metrics
  updateStatsLoop() {
    const activeBots = db.getBots().filter((b) => b.status === "running");
    for (const bot of activeBots) {
      const child = this.processes.get(bot.id);
      if (child) {
        // Simulate real CPU/RAM values dynamically centering around limits
        const targetCpu = Math.floor(Math.random() * 8) + 1; // 1-9%
        const targetRam = Math.floor(Math.random() * 12) + 24; // 24-36 MB
        const updatedUptime = bot.uptime ? bot.uptime + 5 : 5; // increment 5s
        
        db.updateBot(bot.id, {
          cpu: targetCpu,
          ram: targetRam,
          uptime: updatedUptime,
        });

        if (this.ioServer) {
          this.ioServer.emit("bot_telemetry", {
            botId: bot.id,
            cpu: targetCpu,
            ram: targetRam,
            uptime: updatedUptime,
          });
        }
      }
    }
  }
}

export const botManager = new BotManager();
export { BotManager };
