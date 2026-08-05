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
  botId?: string;
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

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: FileItem[];
}

export interface SystemStats {
  cpu: number;
  ram: {
    total: number;
    used: number;
    free: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  uptime: number;
  nodeVersion: string;
  platform: string;
  activeProcesses: number;
}
