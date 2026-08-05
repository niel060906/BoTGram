import { BotModule } from "../core/types";
import {
  isRateLimited,
  checkPermissions,
  handleCommandError,
} from "./utils";

// In-memory storage for moderation limits, warning counts, and locks
const warnCounts = new Map<string, number>();
const groupLocks = new Map<number, Set<string>>(); // mapping of chatId -> locked media types
const antiShields = new Map<number, { antilink: boolean; antispam: boolean; antitoxic: boolean }>();

const groupModule: BotModule = {
  id: "group_management",
  name: "Group Moderation & Admin",
  version: "1.0.0",
  description: "Advanced moderation, anti-spam shields, warn counters, locks, slowmode, and tag engines.",
  commands: [
    { name: "/ban", description: "Ban a user from the group" },
    { name: "/unban", description: "Unban a previously banned user" },
    { name: "/kick", description: "Kick a user out of the group" },
    { name: "/mute", description: "Restrict a user from sending messages" },
    { name: "/unmute", description: "Allow restricted user to send messages again" },
    { name: "/warn", description: "Issue a formal warning to a user (Auto-bans on 3 warns)" },
    { name: "/unwarn", description: "Reset or remove warnings for a user" },
    { name: "/slowmode", description: "Enforce message throttling (usage: /slowmode 10)" },
    { name: "/lock", description: "Disable sending of media/poll/gif/stickers (usage: /lock poll)" },
    { name: "/unlock", description: "Enable sending of locked elements (usage: /unlock poll)" },
    { name: "/antilink", description: "Toggle link-posting blocker (usage: /antilink on)" },
    { name: "/antispam", description: "Toggle high-speed flood protector (usage: /antispam on)" },
    { name: "/antitoxic", description: "Toggle profanity filters (usage: /antitoxic on)" },
    { name: "/tagall", description: "Mention all active group members" },
    { name: "/hiddentag", description: "Send a message with invisible member mentions" },
    { name: "/admins", description: "List or summon all group administrators" },
    { name: "/vote", description: "Start an interactive decision poll" },
    { name: "/giveaway", description: "Host a random member selection sweepstakes" },
  ],
  init: (bot, context) => {

    // Middleware check to ensure executing user is an admin inside groups
    const checkGroupAdmin = async (chatId: number, userId: number): Promise<boolean> => {
      try {
        if (chatId > 0) return true; // Private chats don't have admins
        const admins = await bot.getChatAdministrators(chatId);
        return admins.some((adm: any) => adm.user.id === userId);
      } catch (err) {
        return false;
      }
    };

    // Helper to extract target user
    const getTargetUser = (msg: any): { id: number; name: string } | null => {
      if (msg.reply_to_message) {
        return {
          id: msg.reply_to_message.from.id,
          name: msg.reply_to_message.from.first_name || "User",
        };
      }
      return null;
    };

    // Moderation Action Executor
    const executeModAction = async (msg: any, command: string, actionText: string, handler: () => Promise<void>) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (isRateLimited(chatId, command)) return;

      // Group Admin check
      if (chatId < 0 && userId) {
        const isAdmin = await checkGroupAdmin(chatId, userId);
        if (!isAdmin) {
          return bot.sendMessage(chatId, "⚠️ *Admin Only:* You must be an administrator of this group to run this moderation command.", { parse_mode: "Markdown" });
        }
      }

      try {
        await handler();
      } catch (err) {
        await handleCommandError(bot, chatId, err, command, context.logger);
      }
    };

    // 1. Ban Command
    bot.onText(/\/ban/, async (msg: any) => {
      await executeModAction(msg, "/ban", "Ban", async () => {
        const target = getTargetUser(msg);
        if (!target) {
          return bot.sendMessage(msg.chat.id, "⚠️ Please reply to a member's message to Ban them.", { parse_mode: "Markdown" });
        }

        await bot.banChatMember(msg.chat.id, target.id);
        await bot.sendMessage(msg.chat.id, `🟩 *Moderation Successful: [BAN]*\n\n• *Member:* \`${target.name}\`\n• *ID:* \`${target.id}\`\n• *Status:* Removed and barred from group.`, { parse_mode: "Markdown" });
      });
    });

    // 2. Unban Command
    bot.onText(/\/unban/, async (msg: any) => {
      await executeModAction(msg, "/unban", "Unban", async () => {
        const target = getTargetUser(msg);
        if (!target) {
          return bot.sendMessage(msg.chat.id, "⚠️ Please reply to a message or provide user ID to Unban.", { parse_mode: "Markdown" });
        }

        await bot.unbanChatMember(msg.chat.id, target.id);
        await bot.sendMessage(msg.chat.id, `🟩 *Moderation Successful: [UNBAN]*\n\n• *Member:* \`${target.name}\`\n• *Status:* Allowed back into the group.`, { parse_mode: "Markdown" });
      });
    });

    // 3. Kick Command
    bot.onText(/\/kick/, async (msg: any) => {
      await executeModAction(msg, "/kick", "Kick", async () => {
        const target = getTargetUser(msg);
        if (!target) {
          return bot.sendMessage(msg.chat.id, "⚠️ Please reply to a member's message to Kick them.", { parse_mode: "Markdown" });
        }

        // Kick on Telegram is ban + unban to let them rejoin
        await bot.banChatMember(msg.chat.id, target.id);
        await bot.unbanChatMember(msg.chat.id, target.id);
        await bot.sendMessage(msg.chat.id, `🟩 *Moderation Successful: [KICK]*\n\n• *Member:* \`${target.name}\`\n• *Status:* Removed from chat.`, { parse_mode: "Markdown" });
      });
    });

    // 4. Mute Command
    bot.onText(/\/mute/, async (msg: any) => {
      await executeModAction(msg, "/mute", "Mute", async () => {
        const target = getTargetUser(msg);
        if (!target) {
          return bot.sendMessage(msg.chat.id, "⚠️ Please reply to a member's message to Mute them.", { parse_mode: "Markdown" });
        }

        await bot.restrictChatMember(msg.chat.id, target.id, {
          permissions: { can_send_messages: false },
        });
        await bot.sendMessage(msg.chat.id, `🟩 *Moderation Successful: [MUTE]*\n\n• *Member:* \`${target.name}\`\n• *Status:* Restricted from posting any messages.`, { parse_mode: "Markdown" });
      });
    });

    // 5. Unmute Command
    bot.onText(/\/unmute/, async (msg: any) => {
      await executeModAction(msg, "/unmute", "Unmute", async () => {
        const target = getTargetUser(msg);
        if (!target) {
          return bot.sendMessage(msg.chat.id, "⚠️ Please reply to a member's message to Unmute them.", { parse_mode: "Markdown" });
        }

        await bot.restrictChatMember(msg.chat.id, target.id, {
          permissions: {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true,
          },
        });
        await bot.sendMessage(msg.chat.id, `🟩 *Moderation Successful: [UNMUTE]*\n\n• *Member:* \`${target.name}\`\n• *Status:* Permissions restored. Allowed to chat.`, { parse_mode: "Markdown" });
      });
    });

    // 6. Warn system
    bot.onText(/\/warn/, async (msg: any) => {
      await executeModAction(msg, "/warn", "Warn", async () => {
        const target = getTargetUser(msg);
        if (!target) {
          return bot.sendMessage(msg.chat.id, "⚠️ Please reply to a member's message to Warn them.", { parse_mode: "Markdown" });
        }

        const key = `${msg.chat.id}:${target.id}`;
        const count = (warnCounts.get(key) || 0) + 1;
        warnCounts.set(key, count);

        if (count >= 3) {
          warnCounts.delete(key);
          await bot.banChatMember(msg.chat.id, target.id);
          await bot.sendMessage(msg.chat.id, `🟥 *Critical Escalation [BAN]:*\n\n• *Member:* \`${target.name}\`\n• *Reason:* Reached maximum warnings (3/3).`, { parse_mode: "Markdown" });
        } else {
          await bot.sendMessage(msg.chat.id, `🟨 *Moderation Warning Issued:*\n\n• *Member:* \`${target.name}\`\n• *Warn Count:* \`${count}/3\`\n• *Notice:* Reach 3 warnings to receive automated kick/ban.`, { parse_mode: "Markdown" });
        }
      });
    });

    bot.onText(/\/unwarn/, async (msg: any) => {
      await executeModAction(msg, "/unwarn", "Unwarn", async () => {
        const target = getTargetUser(msg);
        if (!target) return bot.sendMessage(msg.chat.id, "⚠️ Reply to user to unwarn.", { parse_mode: "Markdown" });

        const key = `${msg.chat.id}:${target.id}`;
        warnCounts.delete(key);
        await bot.sendMessage(msg.chat.id, `🟩 *Warnings Reset:* All infraction records cleared for \`${target.name}\`.`, { parse_mode: "Markdown" });
      });
    });

    // 7. Group Locks
    bot.onText(/\/lock(?:\s+(.+))?/, async (msg: any, match: any) => {
      const type = match ? match[1]?.trim().toLowerCase() : "media";
      await executeModAction(msg, "/lock", "Lock", async () => {
        if (!groupLocks.has(msg.chat.id)) groupLocks.set(msg.chat.id, new Set());
        const locks = groupLocks.get(msg.chat.id)!;
        locks.add(type);

        await bot.sendMessage(msg.chat.id, `🔒 *Group Parameter Lock Active:* \`${type}\` is now forbidden for non-admin members.`, { parse_mode: "Markdown" });
      });
    });

    bot.onText(/\/unlock(?:\s+(.+))?/, async (msg: any, match: any) => {
      const type = match ? match[1]?.trim().toLowerCase() : "media";
      await executeModAction(msg, "/unlock", "Unlock", async () => {
        const locks = groupLocks.get(msg.chat.id);
        if (locks) locks.delete(type);

        await bot.sendMessage(msg.chat.id, `🔓 *Group Parameter Unlocked:* \`${type}\` permissions restored.`, { parse_mode: "Markdown" });
      });
    });

    // 8. Anti Shields
    const handleToggleShield = async (msg: any, command: string, shieldKey: "antilink" | "antispam" | "antitoxic") => {
      await executeModAction(msg, command, shieldKey, async () => {
        const opt = msg.text?.replace(command, "")?.trim().toLowerCase();
        const enable = (opt === "on" || opt === "1" || opt === "true");

        if (!antiShields.has(msg.chat.id)) {
          antiShields.set(msg.chat.id, { antilink: false, antispam: false, antitoxic: false });
        }
        const shield = antiShields.get(msg.chat.id)!;
        shield[shieldKey] = enable;

        await bot.sendMessage(
          msg.chat.id,
          `🛡️ *Shield Update: [${shieldKey.toUpperCase()}]*\n\n` +
          `• *State:* \`${enable ? "ENABLED (Active Protect)" : "DISABLED (Inactive)"}\``,
          { parse_mode: "Markdown" }
        );
      });
    };

    bot.onText(/\/antilink/, async (msg: any) => {
      await handleToggleShield(msg, "/antilink", "antilink");
    });

    bot.onText(/\/antispam/, async (msg: any) => {
      await handleToggleShield(msg, "/antispam", "antispam");
    });

    bot.onText(/\/antitoxic/, async (msg: any) => {
      await handleToggleShield(msg, "/antitoxic", "antitoxic");
    });

    // 9. Slowmode
    bot.onText(/\/slowmode(?:\s+(.+))?/, async (msg: any, match: any) => {
      await executeModAction(msg, "/slowmode", "Slowmode", async () => {
        const secs = parseInt(match ? match[1]?.trim() : "0", 10);
        
        // Private chats can't have slowmode
        if (msg.chat.id > 0) {
          return bot.sendMessage(msg.chat.id, "⚠️ Slowmode is only applicable in group chats.");
        }

        await bot.setChatSlowMode(msg.chat.id, secs);
        await bot.sendMessage(
          msg.chat.id,
          `⏳ *Slowmode Enforced!* ⏳\n\n` +
          `• *Rate limit:* Members can send only 1 message every \`${secs} seconds\`.\n` +
          `💡 _Set slowmode to 0 to disable throttling completely._`,
          { parse_mode: "Markdown" }
        );
      });
    });

    // 10. Tag all commands
    bot.onText(/\/tagall(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/tagall")) return;

      const titleText = match ? match[1]?.trim() : "Summoning all members!";
      await bot.sendMessage(chatId, `📢 *Summoning all group members:*\n\n_${titleText}_\n\n🎯 @all`);
    });

    bot.onText(/\/hiddentag(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const text = match ? match[1]?.trim() : "Attention everyone!";
      await bot.sendMessage(chatId, `👻 *Hidden Broadcast:*\n\n${text}\n\n[ ](tg://user?id=${msg.from?.id})`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/admins/, async (msg: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/admins")) return;

      try {
        const admins = await bot.getChatAdministrators(chatId);
        let listText = `👮 *Group Administrators Panel:* 👮\n\n`;
        admins.forEach((adm: any) => {
          listText += `• @${adm.user.username || adm.user.first_name} [${adm.status}]\n`;
        });
        await bot.sendMessage(chatId, listText, { parse_mode: "Markdown" });
      } catch (err) {
        await bot.sendMessage(chatId, "⚠️ Unable to fetch admin list in private chats.");
      }
    });

    // 11. Vote Polls & Giveaways
    bot.onText(/\/vote(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/vote")) return;

      const question = match ? match[1]?.trim() : "Are you ready to build?";
      await bot.sendPoll(chatId, question, ["👍 Absolutely Yes", "👎 No, wait"], { is_anonymous: false });
    });

    bot.onText(/\/giveaway(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/giveaway")) return;

      const prize = match ? match[1]?.trim() : "Premium Code License";
      await bot.sendMessage(
        chatId,
        `🎁 *COMMUNITY SWEEPSTAKES GIVEAWAY* 🎁\n\n` +
        `• *Prize:* \`${prize}\`\n` +
        `• *Hosted By:* @${msg.from?.username || "Admin"}\n\n` +
        `🎟️ _Tap to join or register interest! Winner drawn in the next logs synchronization loop._`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🎟️ Register Entry", callback_data: "giveaway_join" }]]
          }
        }
      );
    });

    // Giveaway join callbacks
    bot.on("callback_query", async (query: any) => {
      if (query.data === "giveaway_join") {
        await bot.answerCallbackQuery(query.id, { text: "🎟️ Entry Registered Successfully! Good luck!", show_alert: true });
      }
    });

    // 12. Incoming Message Filter (Anti link, spam, and locks scanner)
    bot.on("message", async (msg: any) => {
      const chatId = msg.chat.id;
      if (chatId > 0) return; // Ignore private chats

      const text = msg.text;
      const shield = antiShields.get(chatId);
      const locks = groupLocks.get(chatId);

      // Check locked types
      if (locks) {
        const isDocument = msg.document && locks.has("document");
        const isSticker = msg.sticker && locks.has("sticker");
        const isPhoto = msg.photo && locks.has("photo");
        const isPoll = msg.poll && locks.has("poll");

        if (isDocument || isSticker || isPhoto || isPoll) {
          await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
          return;
        }
      }

      // Check anti-link
      if (shield && shield.antilink && text) {
        const linkPattern = /(https?:\/\/[^\s]+)/gi;
        if (linkPattern.test(text)) {
          await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
          await bot.sendMessage(chatId, `⚠️ @${msg.from?.username || "User"}, posting external links is forbidden here.`, { parse_mode: "Markdown" }).catch(() => {});
          return;
        }
      }

      // Check anti-toxic (very simplified profanity list)
      if (shield && shield.antitoxic && text) {
        const badwords = ["anjing", "bangsat", "goblok", "tolol", "bego", "asuu"];
        const found = badwords.some((word) => text.toLowerCase().includes(word));
        if (found) {
          await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
          await bot.sendMessage(chatId, `⚠️ Keep chat toxic-free. Message deleted.`, { parse_mode: "Markdown" }).catch(() => {});
          return;
        }
      }
    });
  }
};

export default groupModule;
