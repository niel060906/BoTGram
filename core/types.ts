export interface BotModule {
  id: string;
  name: string;
  version: string;
  description: string;
  commands: { name: string; description: string }[];
  init: (bot: any, context: BotContext) => void;
}

export interface BotContext {
  botName: string;
  logger: {
    info: (msg: string) => void;
    success: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, err?: any) => void;
  };
  timezone: string;
  getEnabledModules: () => BotModule[];
}
