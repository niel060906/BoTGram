import { BotModule } from "../core/types";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import {
  isRateLimited,
  checkPermissions,
  handleCommandError,
} from "./utils";

const aiModule: BotModule = {
  id: "ai",
  name: "Gemini AI Suite",
  version: "1.2.0",
  description: "Advanced Google Gemini conversational, vision, translation, coding, and writing tools.",
  commands: [
    { name: "/ask", description: "Query general questions (e.g., /ask Tell me a joke)" },
    { name: "/vision", description: "Analyze images with natural language (e.g., /vision What is this?)" },
    { name: "/aiocr", description: "Extract and structure text from photos" },
    { name: "/aitranslate", description: "Advanced multilingual context translation" },
    { name: "/summarize", description: "Condense long articles or logs into highlights" },
    { name: "/rewrite", description: "Rephrase text to casual, professional, or academic" },
    { name: "/grammar", description: "Grammar corrector and vocabulary enhancer" },
    { name: "/story", description: "Generate custom creative short stories" },
    { name: "/novel", description: "Draft chapters or plot lines of a novel" },
    { name: "/coding", description: "Generate clean codebase templates and script snippets" },
    { name: "/debug", description: "Identify bugs in code and provide optimized solutions" },
    { name: "/explain", description: "Explain complex algorithms and lines of code" },
    { name: "/sqlgen", description: "Generate SQL schemas and relational queries" },
    { name: "/regexgen", description: "Generate regular expression patterns" },
    { name: "/htmlgen", description: "Generate clean responsive HTML webpage templates" },
    { name: "/cssgen", description: "Generate modern CSS styles and layouts" },
    { name: "/jsongen", description: "Convert unstructured data to structured JSON payloads" },
    { name: "/promptgen", description: "Create optimized prompt formulas" },
    { name: "/prompten", description: "Enhance raw text into premium high-fidelity prompts" },
    { name: "/caption", description: "Generate trending social media captions" },
    { name: "/email", description: "Compose professional high-impact business emails" },
    { name: "/resume", description: "Format high-quality professional resume content" },
  ],
  init: (bot, context) => {
    let aiClient: GoogleGenAI | null = null;
    const getAIClient = (): GoogleGenAI => {
      if (!aiClient) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
        aiClient = new GoogleGenAI({ apiKey });
      }
      return aiClient;
    };

    // Helper to query Gemini
    const queryGemini = async (
      msg: any,
      command: string,
      systemPrompt: string,
      queryText: string,
      loadingMessage: string
    ) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, command)) return;

      if (!queryText || !queryText.trim()) {
        return bot.sendMessage(
          chatId,
          `🤖 *AI Suite Help:* \`${command}\`\n\n` +
          `Usage: \`${command} <input content>\``,
          { parse_mode: "Markdown" }
        );
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `🤔 _${loadingMessage}..._`);

      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `${systemPrompt}\n\nUser Input:\n"${queryText}"`,
        });

        const replyText = response.text || "⚠️ _No response received from Gemini AI._";
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        // Send response
        await bot.sendMessage(chatId, replyText, { parse_mode: "Markdown" }).catch(async () => {
          // Fallback if Markdown parsing fails
          await bot.sendMessage(chatId, replyText);
        });

      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, command, context.logger);
      }
    };

    // 1. General ask
    bot.onText(/\/ask(?:\s+(.+))?/, async (msg: any, match: any) => {
      const query = match ? match[1]?.trim() : null;
      await queryGemini(msg, "/ask", "You are a helpful general AI assistant.", query, "Thinking");
    });

    // 2. Multimodal Vision command
    bot.onText(/\/vision(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/vision")) return;

      const prompt = match ? match[1]?.trim() : "Describe this image in detail.";
      const replyToMsg = msg.reply_to_message;
      const photos = msg.photo || (replyToMsg && replyToMsg.photo);

      if (!photos || photos.length === 0) {
        return bot.sendMessage(chatId, "⚠️ Please reply to or send an image with the `/vision` command.", { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, "🤔 _Analyzing image elements..._");

      try {
        const fileId = photos[photos.length - 1].file_id;
        const fileInfo = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;

        const responseImage = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const base64Image = Buffer.from(responseImage.data, "binary").toString("base64");

        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [
            {
              inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
              },
            },
            prompt,
          ],
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await bot.sendMessage(chatId, `👁️ *AI Vision Analysis:*\n\n${response.text}`, { parse_mode: "Markdown" }).catch(async () => {
          await bot.sendMessage(chatId, `👁️ *AI Vision Analysis:*\n\n${response.text}`);
        });

      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/vision", context.logger);
      }
    });

    // Register all AI commands to avoid boilerplate
    const aiCommands = [
      { cmd: "/aiocr", system: "Perform highly detailed and structural OCR on the text. If no text exists, return a message stating so.", load: "Extracting texts" },
      { cmd: "/aitranslate", system: "Translate the provided text with advanced linguistic context and idiomatic localization. Target the most popular languages or the requested language.", load: "Translating words" },
      { cmd: "/summarize", system: "Generate a bulleted summary of key ideas and key metrics from the text. Keep it brief and high impact.", load: "Summarizing document" },
      { cmd: "/rewrite", system: "Rewrite this content to be professional, clear, engaging, and well-styled.", load: "Rewriting text" },
      { cmd: "/grammar", system: "Find grammar errors, list the corrections, explain the modifications, and output the polished final text.", load: "Verifying grammar" },
      { cmd: "/story", system: "Draft a high-quality, creative, captivating short story based on the user's premise. Include vivid detail and character development.", load: "Drafting story" },
      { cmd: "/novel", system: "Formulate a rich, engaging novel segment, chapter breakdown, and plot details based on the user's input.", load: "Weaving plot" },
      { cmd: "/coding", system: "Write high-quality, professional, well-documented code based on the specifications. Place in markdown code blocks.", load: "Writing code" },
      { cmd: "/debug", system: "Analyze the provided code, find security holes or syntax issues, list the bugs, explain the repair, and provide the updated code.", load: "Debugging codebase" },
      { cmd: "/explain", system: "Explain the logical flow, libraries used, and algorithmic characteristics of this code snippet line-by-line.", load: "Deconstructing logic" },
      { cmd: "/sqlgen", system: "Write clean, optimized, relational database DDL and query SQL statements based on the schema requested.", load: "Generating schemas" },
      { cmd: "/regexgen", system: "Formulate a regular expression pattern matching the requested specification. Explain the modifiers used.", load: "Formulating regex" },
      { cmd: "/htmlgen", system: "Draft a complete, single-file responsive HTML layout using Tailwind CSS CDN styles. Ensure modern visual polish.", load: "Coding HTML page" },
      { cmd: "/cssgen", system: "Design beautiful custom modern CSS stylesheets, variables, and animations based on the theme description.", load: "Rendering CSS variables" },
      { cmd: "/jsongen", system: "Structure the provided data or requests into syntactically valid JSON payloads. Strictly follow keys and standard formatting.", load: "Parsing JSON objects" },
      { cmd: "/promptgen", system: "Formulate a high-performance system instructions prompt based on the user's description of a custom GPT role.", load: "Forming prompt parameters" },
      { cmd: "/prompten", system: "Expand the user's simple prompt into a descriptive, professional, detailed instruction layout to get elite AI answers.", load: "Enhancing prompt words" },
      { cmd: "/caption", system: "Create 5 viral social media captions (for Instagram, TikTok, LinkedIn) with emojis, trends, and targeted hashtags.", load: "Writing captions" },
      { cmd: "/email", system: "Compose a polished, executive-level high-impact business email addressing the provided topic.", load: "Drafting email" },
      { cmd: "/resume", system: "Write professionally polished resume bullets, objective, and skills layout based on the user's job experience description.", load: "Formatting resume profile" },
    ];

    aiCommands.forEach((command) => {
      bot.onText(new RegExp(`\\${command.cmd}(?:\\s+(.+))?`), async (msg: any, match: any) => {
        const query = match ? match[1]?.trim() : null;
        await queryGemini(msg, command.cmd, command.system, query, command.load);
      });
    });
  }
};

export default aiModule;
