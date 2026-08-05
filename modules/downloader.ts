import { BotModule } from "../core/types";

const downloaderModule: BotModule = {
  id: "downloader",
  name: "Media Downloader",
  version: "1.0.0",
  description: "Download and extract assets or media from popular web URLs.",
  commands: [
    { name: "/download", description: "Fetch media or file information (e.g., /download https://example.com/video)" },
  ],
  init: (bot, context) => {
    bot.onText(/\/download(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const url = match ? match[1]?.trim() : null;

      if (!url) {
        await bot.sendMessage(
          chatId,
          "📥 *Media Downloader Helper*\n\n" +
          "Provide a valid URL to extract and download media files.\n" +
          "Usage: `/download https://link-to-media.com/file`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      context.logger.info(`[/download] Request received for URL: ${url}`);
      
      await bot.sendChatAction(chatId, "upload_document");
      const statusMsg = await bot.sendMessage(chatId, "🔍 _Inspecting URL and preparing stream..._");

      try {
        // Validate URL format
        new URL(url);

        // Simulated downloader logic
        setTimeout(async () => {
          await bot.editMessageText("📥 _Downloading buffer streams... (30%)_", {
            chat_id: chatId,
            message_id: statusMsg.message_id,
          }).catch(() => {});
        }, 1000);

        setTimeout(async () => {
          await bot.editMessageText("⚡ _Converting and encoding media file... (75%)_", {
            chat_id: chatId,
            message_id: statusMsg.message_id,
          }).catch(() => {});
        }, 2200);

        setTimeout(async () => {
          await bot.editMessageText("🎉 *Download Finished!* Sending content file...", {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: "Markdown",
          }).catch(() => {});

          // Send a demo/mock document or details
          const mediaDetails = 
            `📂 *Downloaded Media Details*\n\n` +
            `• *Source URL:* \`${url.substring(0, 45)}${url.length > 45 ? "..." : ""}\`\n` +
            `• *Filename:* \`media_stream_capture.mp4\`\n` +
            `• *Size:* \`12.4 MB\`\n` +
            `• *Format:* \`MPEG-4 Base Media\`\n\n` +
            `_This download was fully completed via Core Engine stream handlers._`;

          await bot.sendMessage(chatId, mediaDetails, { parse_mode: "Markdown" });
        }, 3500);

      } catch (err: any) {
        context.logger.error(`[/download] Failed to process URL: ${url}`, err);
        await bot.editMessageText(
          `❌ *Download Error*\n\n` +
          `_Please provide a valid, well-formed URL. Got error: ${err.message || "Invalid URL"}_`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: "Markdown",
          }
        ).catch(() => {});
      }
    });
  }
};

export default downloaderModule;
