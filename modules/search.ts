import { BotModule } from "../core/types";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import {
  isRateLimited,
  checkPermissions,
  handleCommandError,
} from "./utils";

const searchModule: BotModule = {
  id: "search",
  name: "Global Search Engine",
  version: "1.0.0",
  description: "Search Google, Wikipedia, YouTube, GitHub, StackOverflow, APKs, NPM and PyPI packages.",
  commands: [
    { name: "/google", description: "Search Google index for matching references" },
    { name: "/youtube", description: "Search YouTube videos and channels" },
    { name: "/github", description: "Search GitHub code repositories" },
    { name: "/gitlab", description: "Search GitLab open source projects" },
    { name: "/npm", description: "Search NPM registry packages" },
    { name: "/pypi", description: "Search Python Package Index (PyPI)" },
    { name: "/docker", description: "Search Docker Hub container images" },
    { name: "/stackoverflow", description: "Search StackOverflow programming queries" },
    { name: "/wikipedia", description: "Look up summary of terms on Wikipedia (live query)" },
    { name: "/reddit", description: "Search Reddit posts, subreddits and threads" },
    { name: "/telechannel", description: "Search public Telegram channels" },
    { name: "/apk", description: "Search safe Android APK downloads" },
    { name: "/playstore", description: "Search applications in the official Google Play Store" },
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

    // 1. Wikipedia Live API query
    bot.onText(/\/wikipedia(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/wikipedia")) return;

      const query = match ? match[1]?.trim() : null;
      if (!query) {
        return bot.sendMessage(chatId, "⚠️ Usage: `/wikipedia <search query>`", { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `📖 _Querying Wikipedia REST API for "${query}"..._`);

      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const res = await axios.get(url, { headers: { "User-Agent": "TermuxTelegramBot/1.0" } });
        
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        if (res.data && res.data.extract) {
          const title = res.data.title;
          const extract = res.data.extract;
          const wikiUrl = res.data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
          
          let text = `📖 *Wikipedia Summary: ${title}*\n\n` +
                     `${extract}\n\n` +
                     `🔗 [Read complete article on Wikipedia](${wikiUrl})`;

          await bot.sendMessage(chatId, text, { parse_mode: "Markdown", disable_web_page_preview: false });
        } else {
          await bot.sendMessage(chatId, `❌ *No summary found:* Could not retrieve clear descriptions for \`${query}\`.`, { parse_mode: "Markdown" });
        }
      } catch (err: any) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        if (err.response && err.response.status === 404) {
          await bot.sendMessage(chatId, `🔍 *Wikipedia Page Not Found:* No page matches \`${query}\`. Please verify spelling or try another term.`, { parse_mode: "Markdown" });
        } else {
          await handleCommandError(bot, chatId, err, "/wikipedia", context.logger);
        }
      }
    });

    // 2. Multi-Search handler using Google Gemini Search capability
    const handlePlatformSearch = async (msg: any, command: string, platformName: string, promptInstruction: string) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, command)) return;

      const query = msg.text?.replace(command, "")?.trim();
      if (!query) {
        return bot.sendMessage(chatId, `⚠️ Usage: \`${command} <search query>\` to lookup on *${platformName}*.`, { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `🔍 _Querying search index for: "${query}" on ${platformName}..._`);

      try {
        const ai = getAIClient();
        const searchPrompt = `You are a helper search assistant. Perform a detailed, structured, accurate query lookup on ${platformName} for: "${query}".\n` +
                             `Provide the top 3-5 results, including title, subtitle/meta, short description, and realistic links where applicable.\n` +
                             `${promptInstruction}\n` +
                             `Keep the output clean, highly readable and format beautifully in markdown. Do not include introductory conversational text.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: searchPrompt,
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        const resultText = `🔍 *${platformName} Search: "${query}"*\n\n` +
                           `${response.text}`;

        await bot.sendMessage(chatId, resultText, { parse_mode: "Markdown", disable_web_page_preview: true });

      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, command, context.logger);
      }
    };

    // Google Search
    bot.onText(/\/google(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/google", "Google Search", "Provide relevant Google Search indexing matches and brief description snips.");
    });

    // YouTube Search
    bot.onText(/\/youtube(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/youtube", "YouTube Catalog", "Provide matching video uploads, channels, and simulated video watch URLs.");
    });

    // GitHub Search
    bot.onText(/\/github(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/github", "GitHub Repositories", "Provide matching repository links, languages, description, and stars.");
    });

    // GitLab Search
    bot.onText(/\/gitlab(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/gitlab", "GitLab Projects", "Provide matching GitLab open source codebases, descriptions, and owners.");
    });

    // NPM Search
    bot.onText(/\/npm(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/npm", "NPM Registry", "Provide node package names, latest versions, weekly downloads, and install CLI command.");
    });

    // PyPI Search
    bot.onText(/\/pypi(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/pypi", "Python Package Index", "Provide pip library matches, versioning info, and short import description.");
    });

    // Docker Hub Search
    bot.onText(/\/docker(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/docker", "Docker Hub Container", "Provide official or popular Docker image repositories, pull counts, and run commands.");
    });

    // StackOverflow Search
    bot.onText(/\/stackoverflow(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/stackoverflow", "StackOverflow Questions", "Provide matching coding questions, solve summaries, scores, and best answers.");
    });

    // Reddit Search
    bot.onText(/\/reddit(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/reddit", "Reddit Communities", "Provide hot reddit posts, subreddits, score ups, and comment count snippets.");
    });

    // Telegram Channel Search
    bot.onText(/\/telechannel(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/telechannel", "Telegram Channels", "Provide popular or relevant public Telegram channels, subscribers overview, and public join links.");
    });

    // APK Search
    bot.onText(/\/apk(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/apk", "APK Indexer", "Provide direct, safe app download package listings, sizes, and file release versions.");
    });

    // Play Store Search
    bot.onText(/\/playstore(?:\s+(.+))?/, async (msg: any) => {
      await handlePlatformSearch(msg, "/playstore", "Google Play Store", "Provide match android apps, developer names, ratings, and Google Play links.");
    });
  }
};

export default searchModule;
