import fs from "fs-extra";
import path from "path";

const DB_PATH = path.join(process.cwd(), "database", "db.json");

export interface BotConfig {
  id: string;
  name: string;
  token: string;
  status: "running" | "stopped";
  pid?: number;
  cpu?: number;
  ram?: number;
  uptime?: number;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  botId?: string; // empty for system logs
  type: "info" | "success" | "warning" | "error";
  message: string;
  timestamp: string;
}

export interface ModuleConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  commands: { name: string; description: string }[];
  enabled: boolean;
}

export interface AppSettings {
  port: number;
  prefix: string;
  ownerId: string;
  timezone: string;
  autoRestart: boolean;
  pollingInterval: number;
}

interface DBStructure {
  bots: BotConfig[];
  logs: SystemLog[];
  settings: AppSettings;
  modules: ModuleConfig[];
  sessions: any[];
}

const DEFAULT_DB: DBStructure = {
  bots: [],
  logs: [
    {
      id: "sys-init",
      type: "success",
      message: "Database system initialized successfully.",
      timestamp: new Date().toISOString(),
    }
  ],
  settings: {
    port: 3000,
    prefix: "/",
    ownerId: "123456789",
    timezone: "Asia/Jakarta",
    autoRestart: true,
    pollingInterval: 1000,
  },
  modules: [],
  sessions: [],
};

class JSONDatabase {
  private data: DBStructure = DEFAULT_DB;

  constructor() {
    this.init();
  }

  private init() {
    try {
      fs.ensureDirSync(path.dirname(DB_PATH));
      if (!fs.existsSync(DB_PATH)) {
        fs.writeJsonSync(DB_PATH, DEFAULT_DB, { spaces: 2 });
        this.data = DEFAULT_DB;
      } else {
        const loaded = fs.readJsonSync(DB_PATH);
        // Deep merge with defaults to ensure missing properties don't cause crashes
        this.data = {
          bots: loaded.bots || [],
          logs: loaded.logs || [],
          settings: { ...DEFAULT_DB.settings, ...(loaded.settings || {}) },
          modules: loaded.modules || [],
          sessions: loaded.sessions || [],
        };
      }
    } catch (err) {
      console.error("Failed to initialize database, using memory-store.", err);
      this.data = DEFAULT_DB;
    }
  }

  private save() {
    try {
      fs.writeJsonSync(DB_PATH, this.data, { spaces: 2 });
    } catch (err) {
      console.error("Failed to persist database changes.", err);
    }
  }

  // --- BOTS TABLE ---
  getBots(): BotConfig[] {
    return this.data.bots;
  }

  getBot(id: string): BotConfig | undefined {
    return this.data.bots.find((b) => b.id === id);
  }

  insertBot(bot: Omit<BotConfig, "id" | "createdAt" | "status">): BotConfig {
    const newBot: BotConfig = {
      ...bot,
      id: "bot-" + Math.random().toString(36).substr(2, 9),
      status: "stopped",
      createdAt: new Date().toISOString(),
    };
    this.data.bots.push(newBot);
    this.save();
    return newBot;
  }

  updateBot(id: string, updates: Partial<BotConfig>): BotConfig | undefined {
    const botIndex = this.data.bots.findIndex((b) => b.id === id);
    if (botIndex === -1) return undefined;
    this.data.bots[botIndex] = { ...this.data.bots[botIndex], ...updates };
    this.save();
    return this.data.bots[botIndex];
  }

  deleteBot(id: string): boolean {
    const originalLength = this.data.bots.length;
    this.data.bots = this.data.bots.filter((b) => b.id !== id);
    if (this.data.bots.length !== originalLength) {
      this.save();
      return true;
    }
    return false;
  }

  // --- LOGS TABLE ---
  getLogs(filter?: { botId?: string; type?: string; search?: string }): SystemLog[] {
    let logs = this.data.logs;
    if (filter) {
      if (filter.botId !== undefined) {
        logs = logs.filter((l) => l.botId === filter.botId);
      }
      if (filter.type) {
        logs = logs.filter((l) => l.type === filter.type);
      }
      if (filter.search) {
        const query = filter.search.toLowerCase();
        logs = logs.filter((l) => l.message.toLowerCase().includes(query));
      }
    }
    // Limit to last 1000 logs to prevent memory/file bloat
    return logs.slice(-1000).reverse();
  }

  insertLog(type: SystemLog["type"], message: string, botId?: string): SystemLog {
    const newLog: SystemLog = {
      id: "log-" + Math.random().toString(36).substr(2, 9),
      botId,
      type,
      message,
      timestamp: new Date().toISOString(),
    };
    this.data.logs.push(newLog);
    
    // Cap log list to 1000 to keep DB lightweight
    if (this.data.logs.length > 1000) {
      this.data.logs = this.data.logs.slice(-1000);
    }
    
    this.save();
    return newLog;
  }

  clearLogs(botId?: string): void {
    if (botId) {
      this.data.logs = this.data.logs.filter((l) => l.botId !== botId);
    } else {
      this.data.logs = [];
    }
    this.save();
  }

  // --- SETTINGS TABLE ---
  getSettings(): AppSettings {
    return this.data.settings;
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  // --- MODULES TABLE ---
  getModules(): ModuleConfig[] {
    return this.data.modules;
  }

  syncModules(scannedModules: Omit<ModuleConfig, "enabled">[]): void {
    const existing = this.data.modules;
    const synced: ModuleConfig[] = scannedModules.map((scanned) => {
      const exist = existing.find((m) => m.id === scanned.id);
      return {
        ...scanned,
        enabled: exist ? exist.enabled : true, // default to enabled
      };
    });
    this.data.modules = synced;
    this.save();
  }

  updateModuleStatus(id: string, enabled: boolean): boolean {
    const mod = this.data.modules.find((m) => m.id === id);
    if (mod) {
      mod.enabled = enabled;
      this.save();
      return true;
    }
    return false;
  }
}

export const db = new JSONDatabase();
