import { BotModule } from "../core/types";

const adminModule: BotModule = {
  id: "admin",
  name: "Admin Utilities",
  version: "1.0.0",
  description: "Core administrative commands, statistics, helper menus, and owner checks.",
  commands: [
    { name: "/start", description: "Initialize the bot and get a warm greeting" },
    { name: "/help", description: "Display all available bot commands by category" },
    { name: "/status", description: "Retrieve real-time metrics, system stats, and uptime info" },
  ],
  init: (bot, context) => {
    bot.onText(/\/start/, async (msg: any) => {
      const chatId = msg.chat.id;
      const firstName = msg.from?.first_name || "User";
      context.logger.info(`[/start] Handled command for user ${firstName} (${chatId})`);
      
      const welcomeMsg = 
        `👋 *Hello, ${firstName}!*\n\n` +
        `Welcome to this Telegram Bot, powered by the central *Termux Bot Management Panel Core Engine*! ⚡\n\n` +
        `This bot is fully running on a isolated child process with zero downtime. Use /help to discover available features.`;
      
      await bot.sendMessage(chatId, welcomeMsg, { parse_mode: "Markdown" });
    });

    bot.onText(/\/help/, async (msg: any) => {
      const chatId = msg.chat.id;
      context.logger.info(`[/help] Sending help menu to chat ${chatId}`);
      
      let helpMsg = `📖 *Available Commands* \n\n`;
      
      // Dynamic compilation of modules
      const modules = context.getEnabledModules();
      for (const mod of modules) {
        if (mod.commands && mod.commands.length > 0) {
          helpMsg += `📦 *${mod.name}* (v${mod.version})\n`;
          for (const cmd of mod.commands) {
            helpMsg += `  • \`${cmd.name}\` - ${cmd.description}\n`;
          }
          helpMsg += `\n`;
        }
      }
      
      helpMsg += `💡 _All commands are dynamically hot-reloaded and globally managed._`;
      await bot.sendMessage(chatId, helpMsg, { parse_mode: "Markdown" });
    });

    bot.onText(/\/status/, async (msg: any) => {
      const chatId = msg.chat.id;
      context.logger.info(`[/status] Querying system status for chat ${chatId}`);
      
      const up = process.uptime();
      const hrs = Math.floor(up / 3600);
      const mins = Math.floor((up % 3600) / 60);
      const secs = Math.floor(up % 60);
      const uptimeStr = `${hrs}h ${mins}m ${secs}s`;
      
      const statusMsg = 
        `⚡ *Core Engine Bot Status*\n\n` +
        `• *Bot Name:* \`${context.botName}\`\n` +
        `• *Bot Status:* \`Online (Active)\`\n` +
        `• *Process PID:* \`${process.pid}\`\n` +
        `• *Uptime:* \`${uptimeStr}\`\n` +
        `• *Node Version:* \`${process.version}\`\n` +
        `• *Modules Loaded:* \`${context.getEnabledModules().length}\`\n` +
        `• *Timezone:* \`${context.timezone || "UTC"}\`\n\n` +
        `⚙️ _Running seamlessly on Termux Node.js_`;
        
      await bot.sendMessage(chatId, statusMsg, { parse_mode: "Markdown" });
    });
  }
};

export default adminModule;
