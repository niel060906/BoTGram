import { BotModule } from "../core/types";
import { GoogleGenAI } from "@google/genai";

const aiModule: BotModule = {
  id: "ai",
  name: "Gemini AI",
  version: "1.1.0",
  description: "Brings advanced Google Gemini conversational smarts to your Telegram Bots.",
  commands: [
    { name: "/ask", description: "Query Google Gemini AI with questions (e.g., /ask Tell me a joke)" },
  ],
  init: (bot, context) => {
    // Lazy initialisation to prevent module startup crash if key is missing
    let aiClient: GoogleGenAI | null = null;

    const getAIClient = (): GoogleGenAI => {
      if (!aiClient) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
          throw new Error("GEMINI_API_KEY environment variable is not configured. Please set it in Settings.");
        }
        aiClient = new GoogleGenAI({ apiKey });
      }
      return aiClient;
    };

    bot.onText(/\/ask(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const question = match ? match[1] : null;

      if (!question) {
        await bot.sendMessage(
          chatId,
          "🤖 *Google Gemini AI Helper*\n\n" +
          "Please ask a question after the command:\n" +
          "Usage: `/ask What is Node.js?`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      context.logger.info(`[/ask] Gemini request from chat ${chatId}: "${question.substring(0, 30)}..."`);
      
      // Send a typing indicator
      await bot.sendChatAction(chatId, "typing");
      const loadingMsg = await bot.sendMessage(chatId, "🤔 _Thinking..._");

      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: question,
        });

        const replyText = response.text || "⚠️ _Sorry, I received an empty response from Gemini._";
        
        // Edit original message with response
        await bot.editMessageText(replyText, {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown",
        }).catch(async () => {
          // Fallback if Markdown parsing fails (e.g. invalid backticks/formatting)
          await bot.editMessageText(replyText, {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
          });
        });
      } catch (err: any) {
        context.logger.error(`[/ask] Gemini API failure`, err);
        await bot.editMessageText(
          `❌ *Gemini AI Error*\n\n` +
          `_${err.message || "An unexpected error occurred while communicating with Google AI."}_`,
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id,
            parse_mode: "Markdown",
          }
        ).catch(() => {});
      }
    });
  }
};

export default aiModule;
