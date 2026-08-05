import TelegramBot from "node-telegram-bot-api";
import fs from "fs-extra";
import path from "path";
import chokidar from "chokidar";
import { BotContext, BotModule } from "./types";

export class CoreEngine {
  private botName: string;
  private bot: TelegramBot | null = null;
  private modules: Map<string, BotModule> = new Map();
  private context: BotContext | null = null;
  private watcher: any = null;

  constructor(botName: string) {
    this.botName = botName;
  }

  // Unified logging helper
  private log(type: "info" | "success" | "warning" | "error", message: string, err?: any) {
    const timestamp = new Date().toISOString();
    const payload = {
      botName: this.botName,
      type,
      message,
      timestamp,
      error: err ? { message: err.message, stack: err.stack } : undefined,
    };
    // Format JSON log for the parent process to easily parse
    console.log(`__LOG_START__${JSON.stringify(payload)}__LOG_END__`);
  }

  async start() {
    this.log("info", `Starting Core Engine for bot "${this.botName}" (PID: ${process.pid})...`);
    
    const configPath = path.join(process.cwd(), "bots", this.botName, "config.json");
    if (!fs.existsSync(configPath)) {
      this.log("error", `Configuration file not found at ${configPath}. Exiting.`);
      process.exit(1);
    }

    try {
      const config = fs.readJsonSync(configPath);
      if (!config.token) {
        this.log("error", `Bot token is missing in configuration. Exiting.`);
        process.exit(1);
      }

      // Initialize Telegram Bot
      this.bot = new TelegramBot(config.token, { polling: true });
      this.log("success", `Telegram Bot instance authenticated successfully.`);

      // Setup Bot Context
      this.context = {
        botName: this.botName,
        logger: {
          info: (msg) => this.log("info", msg),
          success: (msg) => this.log("success", msg),
          warn: (msg) => this.log("warning", msg),
          error: (msg, err) => this.log("error", msg, err),
        },
        timezone: "Asia/Jakarta", // Will be synchronized from db
        getEnabledModules: () => Array.from(this.modules.values()),
      };

      // Load all modules
      await this.loadModules();

      // Listen for system/polling errors
      this.bot.on("polling_error", (err: any) => {
        const errMsg = err.message || String(err);
        this.log("error", `Polling Error: ${errMsg}`, err);

        // If it's a 401 Unauthorized error, stop polling and exit to prevent infinite spam
        if (errMsg.includes("401") || errMsg.includes("Unauthorized")) {
          this.log("error", `[CRITICAL_AUTH] Invalid Telegram Bot Token (401 Unauthorized). The token has been rejected or revoked. Stopping polling and halting process to prevent server/database logs spam.`);
          this.stop().then(() => {
            process.exit(0); // Exit with code 0 to prevent auto-restart loop
          }).catch(() => {
            process.exit(0);
          });
        }
      });

      this.bot.on("error", (err: any) => {
        this.log("error", `General Bot Error: ${err.message || err}`, err);
      });

      // Start watching modules folder for dynamic HOT RELOAD
      this.setupHotReloadWatcher();

      this.log("success", `Bot is fully online and polling. Listening for messages...`);

    } catch (err: any) {
      this.log("error", `Failed to initialize Core Engine`, err);
      process.exit(1);
    }
  }

  private async loadModules() {
    if (!this.bot || !this.context) return;

    this.log("info", `Scanning modules...`);
    const modulesDir = path.join(process.cwd(), "modules");
    fs.ensureDirSync(modulesDir);

    // Read the shared DB to check which modules are enabled globally
    let enabledModulesSet = new Set<string>();
    try {
      const dbPath = path.join(process.cwd(), "database", "db.json");
      if (fs.existsSync(dbPath)) {
        const dbContent = fs.readJsonSync(dbPath);
        if (dbContent.modules) {
          dbContent.modules.forEach((m: any) => {
            if (m.enabled) enabledModulesSet.add(m.id);
          });
        }
      }
    } catch (dbErr) {
      this.log("warning", `Could not read modules enablement from database, defaulting all to enabled.`, dbErr);
    }

    // Read modules directory
    const files = fs.readdirSync(modulesDir);
    const tsJsFiles = files.filter(f => f.endsWith(".ts") || f.endsWith(".js"));

    // Clear existing Map
    this.modules.clear();

    for (const file of tsJsFiles) {
      const filePath = path.join(modulesDir, file);
      try {
        // Dynamic import with cache-busting query parameter
        const importPath = `file://${filePath}?v=${Date.now()}`;
        const moduleExports = await import(importPath);
        const mod: BotModule = moduleExports.default || moduleExports;

        if (!mod || !mod.id || !mod.name) {
          this.log("warning", `Skipped invalid module file: ${file} (missing id/name)`);
          continue;
        }

        // Check if disabled globally
        const isEnabled = enabledModulesSet.size === 0 || enabledModulesSet.has(mod.id);
        if (!isEnabled) {
          this.log("info", `Module [${mod.name}] is globally disabled. Skipping init.`);
          continue;
        }

        this.modules.set(mod.id, mod);
        this.log("info", `Loaded module: ${mod.name} (v${mod.version})`);
      } catch (err: any) {
        this.log("error", `Failed to load module file ${file}`, err);
      }
    }

    // Initialize all successfully loaded modules
    this.log("info", `Initializing loaded modules...`);
    for (const [id, mod] of this.modules.entries()) {
      try {
        mod.init(this.bot, this.context);
        this.log("success", `Initialized module [${mod.name}] successfully.`);
      } catch (err: any) {
        this.log("error", `Crash during initialization of module [${mod.name}]`, err);
      }
    }
  }

  private async reloadAllModules() {
    if (!this.bot) return;

    this.log("warning", `⚠️ Hot reload triggered! Re-evaluating modules...`);
    
    // 1. Remove all active telegram bot event listeners to avoid memory leaks/double-listeners
    this.bot.removeAllListeners();

    // Re-register standard error events
    this.bot.on("polling_error", (err: any) => {
      this.log("error", `Polling Error: ${err.message || err}`, err);
    });

    this.bot.on("error", (err: any) => {
      this.log("error", `General Bot Error: ${err.message || err}`, err);
    });

    // 2. Load and init modules again
    await this.loadModules();

    this.log("success", `🎉 Dynamic hot reload complete. All modules updated.`);
  }

  private setupHotReloadWatcher() {
    const modulesDir = path.join(process.cwd(), "modules");
    this.watcher = chokidar.watch(modulesDir, {
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on("change", (filePath: string) => {
      if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
        this.log("info", `File change detected: ${path.basename(filePath)}`);
        this.reloadAllModules();
      }
    });

    this.watcher.on("add", (filePath: string) => {
      if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
        this.log("info", `New module added: ${path.basename(filePath)}`);
        this.reloadAllModules();
      }
    });

    this.watcher.on("unlink", (filePath: string) => {
      if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
        this.log("info", `Module removed: ${path.basename(filePath)}`);
        this.reloadAllModules();
      }
    });
  }

  async stop() {
    this.log("info", `Stopping bot processes...`);
    if (this.watcher) {
      await this.watcher.close();
    }
    if (this.bot) {
      await this.bot.stopPolling();
      this.log("info", `Polling stopped.`);
    }
    this.log("success", `Core Engine shutdown clean.`);
  }
}
