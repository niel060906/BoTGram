import fs from "fs-extra";
import path from "path";

// Cooldown tracker: maps key "chatId:command" to last execution timestamp
const cooldowns = new Map<string, number>();

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks if a command is on cooldown for a specific chat/user.
 */
export function isRateLimited(
  chatId: number,
  command: string,
  cooldownMs: number = 2000
): boolean {
  const key = `${chatId}:${command}`;
  const now = Date.now();
  const lastTime = cooldowns.get(key);

  if (lastTime && now - lastTime < cooldownMs) {
    return true;
  }
  cooldowns.set(key, now);
  return false;
}

/**
 * Standardized input validation.
 */
export function validateInput(
  text: string | undefined,
  pattern: RegExp,
  usageMessage: string
): { valid: boolean; match?: RegExpExecArray; error?: string } {
  if (!text || !text.trim()) {
    return { valid: false, error: usageMessage };
  }
  const match = pattern.exec(text.trim());
  if (!match) {
    return { valid: false, error: usageMessage };
  }
  return { valid: true, match };
}

/**
 * Check if user has required permissions (owner or premium status).
 */
export function checkPermissions(
  msg: any,
  role: "owner" | "premium" | "user" = "user"
): PermissionCheckResult {
  try {
    const dbPath = path.join(process.cwd(), "database", "db.json");
    if (!fs.existsSync(dbPath)) {
      return { allowed: true }; // default if DB is not ready
    }

    const db = fs.readJsonSync(dbPath);
    const userId = String(msg.from?.id);
    const ownerId = String(db.settings?.ownerId || "123456789");

    // Whitelist / Blacklist checks
    const blacklist: string[] = db.blacklist || [];
    const whitelist: string[] = db.whitelist || [];

    if (blacklist.includes(userId)) {
      return { allowed: false, reason: "⚠️ *Access Denied:* Your account has been blacklisted by the bot owner." };
    }

    if (role === "owner") {
      if (userId === ownerId || whitelist.includes(userId)) {
        return { allowed: true };
      }
      return { allowed: false, reason: "⚠️ *Owner Only Command:* This feature is restricted to the bot owner." };
    }

    if (role === "premium") {
      const premiumUsers: string[] = db.premiumUsers || [];
      if (userId === ownerId || premiumUsers.includes(userId) || whitelist.includes(userId)) {
        return { allowed: true };
      }
      return { allowed: false, reason: "⭐ *Premium Feature:* This command is exclusive to premium users. Upgrades can be requested in the Web Panel." };
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: true }; // fallback gracefully
  }
}

/**
 * Standard progress bar builder.
 */
export function makeProgressBar(percentage: number, length: number = 10): string {
  const filledCount = Math.round((percentage / 100) * length);
  const emptyCount = length - filledCount;
  return "█".repeat(filledCount) + "░".repeat(emptyCount);
}

/**
 * Updates a loading message with a beautiful progress bar.
 */
export async function updateProgress(
  bot: any,
  chatId: number,
  messageId: number,
  percentage: number,
  actionText: string
): Promise<any> {
  const bar = makeProgressBar(percentage);
  const text = `⚙️ *Processing [${percentage}%]*\n` +
               `*Action:* _${actionText}_\n` +
               `\`[${bar}]\``;
  try {
    return await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
    });
  } catch (err) {
    // Ignore edit failures due to identical text
  }
}

/**
 * Unified error handler.
 */
export async function handleCommandError(
  bot: any,
  chatId: number,
  error: any,
  commandName: string,
  logger: any
): Promise<void> {
  const errMsg = error.message || String(error);
  logger.error(`Error in command ${commandName}:`, error);

  const responseText = 
    `❌ *Error Occurred in ${commandName}*\n\n` +
    `_Reason:_ \`${errMsg}\`\n\n` +
    `💡 _If this persists, please contact the bot support._`;

  await bot.sendMessage(chatId, responseText, { parse_mode: "Markdown" }).catch(() => {});
}

/**
 * Shared in-memory cache for heavy API requests
 */
class RequestCache {
  private cache = new Map<string, { value: any; expiry: number }>();

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: any, ttlMs: number = 300000): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }
}

export const requestCache = new RequestCache();
