import { BotModule } from "../core/types";

const welcomeModule: BotModule = {
  id: "welcome",
  name: "Group Welcomer",
  version: "1.0.1",
  description: "Triggers personalized welcoming greetings whenever a user joins a chat/group.",
  commands: [],
  init: (bot, context) => {
    // Watch for chat member changes
    bot.on("new_chat_members", async (msg: any) => {
      const chatId = msg.chat.id;
      const groupName = msg.chat.title || "this group";
      const newMembers = msg.new_chat_members || [];

      context.logger.info(`[welcome] Detect ${newMembers.length} new members joining group ${groupName} (${chatId})`);

      for (const member of newMembers) {
        const firstName = member.first_name || "New Member";
        const username = member.username ? `@${member.username}` : "";
        
        const welcomeMsg = 
          `🎉 *Welcome to ${groupName}!* 🎉\n\n` +
          `Hello, [${firstName}](tg://user?id=${member.id}) ${username}! We are absolutely thrilled to have you here.\n\n` +
          `📝 *Getting Started:*\n` +
          `• Read any pinned group messages\n` +
          `• Introduce yourself\n` +
          `• Maintain friendly and respectful communication\n\n` +
          `⚙️ _Automated greeting by ${context.botName}_`;

        await bot.sendMessage(chatId, welcomeMsg, { parse_mode: "Markdown" }).catch((err: any) => {
          context.logger.error(`[welcome] Failed to send welcome greeting`, err);
        });
      }
    });
  }
};

export default welcomeModule;
