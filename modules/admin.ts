import { BotModule } from "../core/types";

const adminModule: BotModule = {
  id: "admin",
  name: "Admin Utilities",
  version: "1.1.0",
  description: "Core administrative commands, statistics, helper menus, and owner checks.",
  commands: [
    { name: "/start", description: "Initialize the bot and get a warm greeting with interactive menus" },
    { name: "/help", description: "Display all available bot commands by category" },
    { name: "/status", description: "Retrieve real-time metrics, system stats, and uptime info" },
  ],
  init: (bot, context) => {
    // Shared helper for Status Text
    const getStatusText = () => {
      const up = process.uptime();
      const hrs = Math.floor(up / 3600);
      const mins = Math.floor((up % 3600) / 60);
      const secs = Math.floor(up % 60);
      const uptimeStr = `${hrs}h ${mins}m ${secs}s`;

      return (
        `⚡ *Core Engine Bot Status*\n\n` +
        `• *Bot Name:* \`${context.botName}\`\n` +
        `• *Bot Status:* \`Online (Active)\`\n` +
        `• *Process PID:* \`${process.pid}\`\n` +
        `• *Uptime:* \`${uptimeStr}\`\n` +
        `• *Node Version:* \`${process.version}\`\n` +
        `• *Modules Loaded:* \`${context.getEnabledModules().length}\`\n` +
        `• *Timezone:* \`${context.timezone || "UTC"}\`\n\n` +
        `⚙️ _Running seamlessly on Termux Node.js_`
      );
    };

    // Shared helper for Help Text
    const getHelpText = () => {
      let helpMsg = `📖 *Available Commands Guide* \n\n`;
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
      helpMsg += `💡 _All commands are dynamically hot-reloaded and globally managed with physical buttons._`;
      return helpMsg;
    };

    // 1. Command /start
    bot.onText(/\/start/, async (msg: any) => {
      const chatId = msg.chat.id;
      const firstName = msg.from?.first_name || "User";
      context.logger.info(`[/start] Handled command for user ${firstName} (${chatId})`);

      const welcomeMsg = 
        `👋 *Hello, ${firstName}!*\n\n` +
        `Welcome to this Telegram Bot, powered by the central *Termux Bot Management Panel Core Engine*! ⚡\n\n` +
        `This bot is fully running on an isolated process. You can control this bot using the *Reply Keyboard* below or tap the *Inline Buttons* on this message.`;

      const replyMarkup = {
        keyboard: [
          [{ text: "📖 Help" }, { text: "⚡ Status" }],
          [{ text: "🤖 Ask AI" }, { text: "📥 Downloader" }, { text: "🎨 Sticker" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      };

      const inlineMarkup = {
        inline_keyboard: [
          [
            { text: "📖 Commands Guide", callback_data: "action_help" },
            { text: "⚡ System Status", callback_data: "action_status" }
          ],
          [
            { text: "🌐 Open Web Panel", url: "https://ais-dev-uwgelndxtshgyoen3bdydx-540545985556.asia-southeast1.run.app" }
          ]
        ]
      };

      await bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: "Markdown",
        reply_markup: replyMarkup
      });

      // Send inline buttons separately or as part of a quick helper message
      await bot.sendMessage(chatId, "🎛️ *Interactive Dashboard Controls:*", {
        parse_mode: "Markdown",
        reply_markup: inlineMarkup
      });
    });

    // 2. Command /help
    bot.onText(/\/help/, async (msg: any) => {
      const chatId = msg.chat.id;
      context.logger.info(`[/help] Sending help menu to chat ${chatId}`);
      await bot.sendMessage(chatId, getHelpText(), { parse_mode: "Markdown" });
    });

    // 3. Command /status
    bot.onText(/\/status/, async (msg: any) => {
      const chatId = msg.chat.id;
      context.logger.info(`[/status] Querying system status for chat ${chatId}`);
      await bot.sendMessage(chatId, getStatusText(), { parse_mode: "Markdown" });
    });

    // 4. Listen for Reply Keyboard Button Clicks (Normal Text messages)
    bot.on("message", async (msg: any) => {
      // Ignore command formats (handled by onText)
      if (msg.text && msg.text.startsWith("/")) return;

      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text) return;

      context.logger.info(`[message] Received keyboard or text input: "${text}" in chat ${chatId}`);

      switch (text) {
        case "📖 Help": {
          await bot.sendMessage(chatId, getHelpText(), { parse_mode: "Markdown" });
          break;
        }
        case "⚡ Status": {
          await bot.sendMessage(chatId, getStatusText(), { parse_mode: "Markdown" });
          break;
        }
        case "🤖 Ask AI": {
          const aiMsg = 
            `🤖 *Google Gemini AI Mode*\n\n` +
            `Type your question starting with the command \`/ask\`.\n` +
            `Example:\n` +
            `\`/ask What are the benefits of Node.js?\``;
          await bot.sendMessage(chatId, aiMsg, { parse_mode: "Markdown" });
          break;
        }
        case "📥 Downloader": {
          const dlMsg = 
            `📥 *Media Downloader Mode*\n\n` +
            `Provide a URL to download content starting with the command \`/download\`.\n` +
            `Example:\n` +
            `\`/download https://example.com/video.mp4\``;
          await bot.sendMessage(chatId, dlMsg, { parse_mode: "Markdown" });
          break;
        }
        case "🎨 Sticker": {
          const stMsg = 
            `🎨 *Sticker Utilities Mode*\n\n` +
            `Reply to any photo with the \`/sticker\` command to convert it, or type your text after it:\n` +
            `Example:\n` +
            `\`/sticker Cool Vibes\``;
          await bot.sendMessage(chatId, stMsg, { parse_mode: "Markdown" });
          break;
        }
        default:
          // Do nothing for other normal chat messages to avoid spamming
          break;
      }
    });

    // 5. Listen for Inline Keyboard Button Clicks (Callback Queries)
    bot.on("callback_query", async (query: any) => {
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      const data = query.data;

      if (!chatId || !data) return;

      context.logger.info(`[callback_query] Action received: "${data}" from user ${query.from?.first_name}`);

      try {
        // Answer callback query first to stop loading state in client
        await bot.answerCallbackQuery(query.id);

        if (data === "action_help") {
          const inlineBack = {
            inline_keyboard: [
              [{ text: "⬅️ Back to Status", callback_data: "action_status" }]
            ]
          };
          await bot.editMessageText(getHelpText(), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: inlineBack
          });
        } else if (data === "action_status") {
          const inlineBack = {
            inline_keyboard: [
              [{ text: "📖 View Commands", callback_data: "action_help" }]
            ]
          };
          await bot.editMessageText(getStatusText(), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: inlineBack
          });
        }
      } catch (err: any) {
        context.logger.error(`[callback_query] Error handling callback action "${data}"`, err);
      }
    });
  }
};

export default adminModule;
