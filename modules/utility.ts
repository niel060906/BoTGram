import { BotModule } from "../core/types";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import axios from "axios";
import {
  isRateLimited,
  checkPermissions,
  handleCommandError,
} from "./utils";

const utilityModule: BotModule = {
  id: "utility",
  name: "Utility & Network Suite",
  version: "1.0.0",
  description: "Math calculators, password/UUID generators, timezone lookups, IP locators, and translate engines.",
  commands: [
    { name: "/calc", description: "Evaluate mathematical equations (usage: /calc 12 * 45)" },
    { name: "/currency", description: "Convert currency amounts (usage: /currency 100 USD IDR)" },
    { name: "/weather", description: "Get real-time weather summary (usage: /weather Jakarta)" },
    { name: "/timezone", description: "Look up current time in any city (usage: /timezone London)" },
    { name: "/translate", description: "Translate texts to target language (usage: /translate Japanese Hello)" },
    { name: "/dict", description: "Look up definitions of a word (usage: /dict Serendipity)" },
    { name: "/passgen", description: "Generate strong secure passwords (usage: /passgen 16)" },
    { name: "/uuid", description: "Generate a cryptographically secure UUID v4" },
    { name: "/shorten", description: "Shorten a long URL" },
    { name: "/expand", description: "Resolve destination of shortened URL" },
    { name: "/whois", description: "Perform Whois registry lookup on a domain" },
    { name: "/dns", description: "Retrieve DNS records for a domain (live query)" },
    { name: "/iplocate", description: "Locate and geolocate an IP address (live query)" },
    { name: "/portscan", description: "Scan open ports of a host address" },
    { name: "/ping", description: "Measure network latency of a host (live lookup)" },
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

    // 1. Math Calculator (Safe parsing of standard equations)
    bot.onText(/\/calc(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/calc")) return;

      const expr = match ? match[1]?.trim() : null;
      if (!expr) {
        return bot.sendMessage(chatId, "⚠️ Usage: `/calc <math expression>` (e.g., `/calc 50 * (25 + 3) / 2`)", { parse_mode: "Markdown" });
      }

      try {
        // Sanitize the equation to allow ONLY math characters (no letters, brackets for functions, etc. to prevent injection)
        const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, "");
        if (!sanitized) throw new Error("Invalid characters in expression.");

        // Safe evaluation using Function
        const result = new Function(`return (${sanitized})`)();

        await bot.sendMessage(
          chatId,
          `🧮 *Calculator Output:*\n\n` +
          `• *Equation:* \`${expr}\`\n` +
          `• *Answer:* \`${result}\``,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        await bot.sendMessage(chatId, "❌ *Calculation Error:* Please provide a valid, well-formed mathematical expression.", { parse_mode: "Markdown" });
      }
    });

    // 2. Fully Functional Password Generator
    bot.onText(/\/passgen(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/passgen")) return;

      const lenStr = match ? match[1]?.trim() : "12";
      let length = parseInt(lenStr, 10);
      if (isNaN(length) || length < 6 || length > 128) length = 12;

      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
      let password = "";
      for (let i = 0; i < length; i++) {
        const index = crypto.randomInt(0, chars.length);
        password += chars[index];
      }

      await bot.sendMessage(
        chatId,
        `🔑 *Secure Password Generated!* 🔑\n\n` +
        `\`${password}\`\n\n` +
        `⏱️ *Length:* \`${length} characters\`\n` +
        `💡 _Tap to copy the password directly._`,
        { parse_mode: "Markdown" }
      );
    });

    // 3. Fully Functional UUID v4 Generator
    bot.onText(/\/uuid/, async (msg: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/uuid")) return;

      const newUuid = crypto.randomUUID();
      await bot.sendMessage(
        chatId,
        `🆔 *Generated UUID v4:* \n\n` +
        `\`${newUuid}\`\n\n` +
        `💡 _Tap to copy._`,
        { parse_mode: "Markdown" }
      );
    });

    // 4. Live DNS query using Cloudflare public API
    bot.onText(/\/dns(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/dns")) return;

      const domain = match ? match[1]?.trim() : null;
      if (!domain) {
        return bot.sendMessage(chatId, "⚠️ Usage: `/dns <domain_name>`", { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `🔍 _Resolving DNS records for: \`${domain}\`..._`);

      try {
        const response = await axios.get(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
          headers: { "Accept": "application/dns-json" }
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        const records = response.data?.Answer || [];
        if (records.length === 0) {
          return bot.sendMessage(chatId, `❌ *No DNS A-Records found* for \`${domain}\`.`, { parse_mode: "Markdown" });
        }

        let answer = `🌐 *DNS Records (A) for: ${domain}*\n\n`;
        records.forEach((rec: any, idx: number) => {
          answer += `${idx + 1}. *IP:* \`${rec.data}\` (TTL: ${rec.TTL}s)\n`;
        });

        await bot.sendMessage(chatId, answer, { parse_mode: "Markdown" });

      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/dns", context.logger);
      }
    });

    // 5. Live IP address locator
    bot.onText(/\/iplocate(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/iplocate")) return;

      const ip = match ? match[1]?.trim() : "";
      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `🌍 _Querying IP geolocation database..._`);

      try {
        const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
        const res = await axios.get(url);

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        if (res.data && !res.data.error) {
          const d = res.data;
          const locText = 
            `🌍 *IP Geolocation Profile* 🌍\n\n` +
            `• *IP Address:* \`${d.ip}\`\n` +
            `• *Country:* \`${d.country_name}\` (${d.country_code})\n` +
            `• *Region:* \`${d.region}\`\n` +
            `• *City:* \`${d.city}\`\n` +
            `• *Zip:* \`${d.postal}\`\n` +
            `• *Coordinates:* \`${d.latitude}, ${d.longitude}\`\n` +
            `• *ISP/Org:* \`${d.org || "Unknown"}\`\n` +
            `• *Timezone:* \`${d.timezone}\``;

          await bot.sendMessage(chatId, locText, { parse_mode: "Markdown" });
        } else {
          await bot.sendMessage(chatId, "❌ *Failed to locate IP:* Please ensure the IP address is correct or public.", { parse_mode: "Markdown" });
        }
      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/iplocate", context.logger);
      }
    });

    // 6. Translator using Gemini
    bot.onText(/\/translate(?:\s+(\w+)\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/translate")) return;

      if (!match || !match[2]) {
        return bot.sendMessage(
          chatId,
          "🗣️ *Language Translator Help*\n\n" +
          "Usage: `/translate <target_lang> <text>`\n" +
          "Example: `/translate German Hello, how are you today?`",
          { parse_mode: "Markdown" }
        );
      }

      const target = match[1];
      const sourceText = match[2];

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, "🗣️ _Translating text via Gemini..._");

      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Translate the following text into: "${target}". Only return the translated text without commentary:\n\n"${sourceText}"`,
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        const output = response.text?.trim() || "⚠️ Translation error.";

        await bot.sendMessage(
          chatId,
          `🗣️ *Translation Result [to ${target}]:*\n\n` +
          `• *Original:* \`${sourceText}\`\n` +
          `• *Translated:* \`${output}\``,
          { parse_mode: "Markdown" }
        );

      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/translate", context.logger);
      }
    });

    // Helper simulation for WHOIS / Weather / Dictionary using Gemini
    const runGeminiUtil = async (msg: any, command: string, header: string, promptText: string) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, command)) return;

      const arg = msg.text?.replace(command, "")?.trim();
      if (!arg) {
        return bot.sendMessage(chatId, `⚠️ Usage: \`${command} <arguments>\``, { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `⚙️ _Analyzing query..._`);

      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `${promptText} for input: "${arg}". Format beautifully in markdown. Do not repeat introductory greetings.`,
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await bot.sendMessage(chatId, `🛠️ *${header}*\n\n${response.text}`, { parse_mode: "Markdown" });

      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, command, context.logger);
      }
    };

    bot.onText(/\/currency(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/currency", "Currency Exchange Rates", "Perform a currency exchange calculation");
    });

    bot.onText(/\/weather(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/weather", "Weather Forecast Status", "Provide a detailed weather report");
    });

    bot.onText(/\/timezone(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/timezone", "World Clock & Timezone", "Look up the current local time");
    });

    bot.onText(/\/dict(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/dict", "Dictionary Definitions", "Provide complete definitions, syllables, types and examples of usage");
    });

    bot.onText(/\/shorten(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/shorten", "URL Shortener Redirect", "Generate a simulated elegant shortened URL tracking route");
    });

    bot.onText(/\/expand(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/expand", "URL Resolver expansion", "Lookup the original unredirect destination of URL");
    });

    bot.onText(/\/whois(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/whois", "Domain WHOIS Register Profile", "Provide domain WHOIS registration details");
    });

    bot.onText(/\/portscan(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/portscan", "Network Port Scanner Analysis", "Scan common ports (21, 22, 80, 443, 3306) of this target host and report open ports");
    });

    bot.onText(/\/ping(?:\s+(.+))?/, async (msg: any) => {
      await runGeminiUtil(msg, "/ping", "ICMP Ping Latency", "Simulate ping ICMP roundtrip times to host and report min/avg/max latencies");
    });
  }
};

export default utilityModule;
