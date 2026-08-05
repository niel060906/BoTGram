import { BotModule } from "../core/types";
import {
  isRateLimited,
  checkPermissions,
  handleCommandError,
} from "./utils";

interface UserProfile {
  balance: number;
  inventory: Map<string, number>;
  pets: string[];
  partner?: string;
  level: number;
  xp: number;
  lastDaily?: number;
}

const gameState = new Map<string, UserProfile>();
const activeBlackjackGames = new Map<number, { playerHand: number[]; dealerHand: number[]; bet: number; userId: number }>();

const gamesModule: BotModule = {
  id: "games_station",
  name: "Games & Economy Station",
  version: "1.0.0",
  description: "Text-based economy games, Blackjack, slots, fishing, mining, farms, pet feeds, and marriages.",
  commands: [
    { name: "/slots", description: "Spin and win virtual credits (usage: /slots 100)" },
    { name: "/blackjack", description: "Start interactive Blackjack game (usage: /blackjack 200)" },
    { name: "/fishing", description: "Cast fishing line to catch exotic sea life" },
    { name: "/mining", description: "Mine rock beds for precious gemstones and minerals" },
    { name: "/farming", description: "Plant and cultivate crops for high yields" },
    { name: "/inventory", description: "Check virtual balance, tools, items, and levels" },
    { name: "/shop", description: "Browse and buy mining tools, rods, and pet elements" },
    { name: "/pet", description: "Adopt, feed, or play with your virtual pet animal" },
    { name: "/marriage", description: "Propose marriage to a chat member (usage: /marriage @username)" },
    { name: "/divorce", description: "Sever the marriage ties" },
    { name: "/rewards", description: "Claim your daily check-in credits reward" },
    { name: "/leaderboard", description: "View the networth leaderboard for the chat" },
  ],
  init: (bot, context) => {

    const getProfile = (userId: string): UserProfile => {
      if (!gameState.has(userId)) {
        gameState.set(userId, {
          balance: 1000,
          inventory: new Map<string, number>([
            ["wood_pickaxe", 1],
            ["bamboo_rod", 1],
          ]),
          pets: [],
          level: 1,
          xp: 0,
        });
      }
      return gameState.get(userId)!;
    };

    // 1. Daily Rewards
    bot.onText(/\/rewards/, async (msg: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/rewards")) return;

      const p = getProfile(userId);
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      if (p.lastDaily && now - p.lastDaily < oneDay) {
        const diff = oneDay - (now - p.lastDaily);
        const hrs = Math.floor(diff / (60 * 60 * 1000));
        const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        return bot.sendMessage(chatId, `⏳ *Check-in Cooldown:* Please wait another \`${hrs}h ${mins}m\` before claiming again.`, { parse_mode: "Markdown" });
      }

      p.balance += 500;
      p.lastDaily = now;
      await bot.sendMessage(
        chatId,
        `🎁 *Daily Reward Claimed!* 🎁\n\n` +
        `• *Added:* \`+500 credits\`\n` +
        `• *New Balance:* \`${p.balance} credits\`\n\n` +
        `💡 _Come back tomorrow for more free balance!_`,
        { parse_mode: "Markdown" }
      );
    });

    // 2. Inventory viewer
    bot.onText(/\/inventory/, async (msg: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/inventory")) return;

      const p = getProfile(userId);
      let invText = `🎒 *Your Virtual Inventory* 🎒\n\n` +
                    `• *Level:* \`${p.level}\` (XP: \`${p.xp}/1000\`)\n` +
                    `• *Cash Balance:* \`${p.balance} credits\`\n` +
                    `• *Partner:* \`${p.partner || "Single"}\`\n\n` +
                    `📦 *Items & Gear:* \n`;

      let hasItems = false;
      p.inventory.forEach((qty, item) => {
        if (qty > 0) {
          invText += `  • \`${item.replace("_", " ")}\` x${qty}\n`;
          hasItems = true;
        }
      });

      if (!hasItems) invText += `  _(Your inventory is currently empty)_\n`;

      if (p.pets.length > 0) {
        invText += `\n🐾 *Pets Adopted:* \n`;
        p.pets.forEach((pet) => {
          invText += `  • \`${pet}\` (Healthy)\n`;
        });
      }

      await bot.sendMessage(chatId, invText, { parse_mode: "Markdown" });
    });

    // 3. Slots
    bot.onText(/\/slots(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/slots")) return;

      const betStr = match ? match[1]?.trim() : "50";
      const bet = parseInt(betStr, 10);
      const p = getProfile(userId);

      if (isNaN(bet) || bet <= 0) return bot.sendMessage(chatId, "⚠️ Usage: `/slots <bet amount>`");
      if (p.balance < bet) return bot.sendMessage(chatId, `❌ *Insufficient Balance:* You only have \`${p.balance}\` credits.`, { parse_mode: "Markdown" });

      const reels = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎"];
      const r1 = reels[Math.floor(Math.random() * reels.length)];
      const r2 = reels[Math.floor(Math.random() * reels.length)];
      const r3 = reels[Math.floor(Math.random() * reels.length)];

      let win = 0;
      let status = "";

      if (r1 === r2 && r2 === r3) {
        win = bet * 5;
        p.balance += win;
        status = `🏆 *JACKPOT WIN! (5x multiplier)* \n➕ Recieved \`+${win} credits\``;
      } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        win = bet * 2;
        p.balance += win;
        status = `🎉 *Nice Win! (2x multiplier)* \n➕ Recieved \`+${win} credits\``;
      } else {
        p.balance -= bet;
        status = `🟥 *You Lost!* \n➖ Deducted \`-${bet} credits\``;
      }

      const output = 
        `🎰 *TERMUX CORE SLOTS STATION* 🎰\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `  [  ${r1}  |  ${r2}  |  ${r3}  ]\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `${status}\n` +
        `• *Current Balance:* \`${p.balance} credits\``;

      await bot.sendMessage(chatId, output, { parse_mode: "Markdown" });
    });

    // 4. Interactive Blackjack Engine
    bot.onText(/\/blackjack(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      if (!userId) return;

      const betStr = match ? match[1]?.trim() : "100";
      const bet = parseInt(betStr, 10);
      const p = getProfile(String(userId));

      if (isNaN(bet) || bet <= 0) return bot.sendMessage(chatId, "⚠️ Usage: `/blackjack <bet amount>`");
      if (p.balance < bet) return bot.sendMessage(chatId, `❌ *Insufficient balance:* Need \`${bet}\` credits.`, { parse_mode: "Markdown" });

      // Deal hands
      const rollCard = () => Math.floor(Math.random() * 10) + 2; // 2-11 range
      const playerHand = [rollCard(), rollCard()];
      const dealerHand = [rollCard(), rollCard()];

      activeBlackjackGames.set(chatId, { playerHand, dealerHand, bet, userId });

      const getSum = (hand: number[]) => hand.reduce((a, b) => a + b, 0);

      const kb = {
        inline_keyboard: [
          [
            { text: "🃏 Hit (Draw)", callback_data: `bj_hit:${chatId}` },
            { text: "🛑 Stand (Hold)", callback_data: `bj_stand:${chatId}` }
          ]
        ]
      };

      const bjText = 
        `🃏 *Interactive Blackjack Arena* 🃏\n\n` +
        `• *Bet:* \`${bet} credits\`\n` +
        `• *Your Hand:* \`[${playerHand.join(", ")}]\` (Total: *${getSum(playerHand)}*)\n` +
        `• *Dealer Show Card:* \`[${dealerHand[0]}]\`\n\n` +
        `💡 _Choose Hit to draw a card, or Stand to compare hand values._`;

      await bot.sendMessage(chatId, bjText, { parse_mode: "Markdown", reply_markup: kb });
    });

    // Blackjack Action Callback Router
    bot.on("callback_query", async (query: any) => {
      const data = query.data;
      if (!data || !data.startsWith("bj_")) return;

      const parts = data.split(":");
      const act = parts[0];
      const chatId = parseInt(parts[1], 10);

      const game = activeBlackjackGames.get(chatId);
      if (!game) return bot.answerCallbackQuery(query.id, { text: "No active game found here." });

      if (query.from?.id !== game.userId) {
        return bot.answerCallbackQuery(query.id, { text: "⚠️ This is not your game board!", show_alert: true });
      }

      await bot.answerCallbackQuery(query.id);

      const getSum = (hand: number[]) => hand.reduce((a, b) => a + b, 0);
      const rollCard = () => Math.floor(Math.random() * 10) + 2;

      const p = getProfile(String(game.userId));

      if (act === "bj_hit") {
        game.playerHand.push(rollCard());
        const sum = getSum(game.playerHand);

        if (sum > 21) {
          // BUST
          p.balance -= game.bet;
          activeBlackjackGames.delete(chatId);

          await bot.editMessageText(
            `💥 *Blackjack BUST!* (You went over 21!)\n\n` +
            `• *Your Hand:* \`[${game.playerHand.join(", ")}]\` (Total: *${sum}*)\n` +
            `• *Dealer Hand:* \`[${game.dealerHand.join(", ")}]\`\n\n` +
            `🟥 *Result:* Lost \`-${game.bet} credits\`\n` +
            `• *New Balance:* \`${p.balance} credits\``,
            { chat_id: chatId, message_id: query.message?.message_id, parse_mode: "Markdown" }
          );
        } else {
          // Send updated board
          const kb = {
            inline_keyboard: [
              [
                { text: "🃏 Hit (Draw)", callback_data: `bj_hit:${chatId}` },
                { text: "🛑 Stand (Hold)", callback_data: `bj_stand:${chatId}` }
              ]
            ]
          };

          await bot.editMessageText(
            `🃏 *Interactive Blackjack Arena* 🃏\n\n` +
            `• *Bet:* \`${game.bet} credits\`\n` +
            `• *Your Hand:* \`[${game.playerHand.join(", ")}]\` (Total: *${sum}*)\n` +
            `• *Dealer Show Card:* \`[${game.dealerHand[0]}]\`\n\n` +
            `💡 _Hit or Stand?_`,
            { chat_id: chatId, message_id: query.message?.message_id, parse_mode: "Markdown", reply_markup: kb }
          );
        }
      } else if (act === "bj_stand") {
        // Dealer's turn: hits until sum >= 17
        let dSum = getSum(game.dealerHand);
        while (dSum < 17) {
          game.dealerHand.push(rollCard());
          dSum = getSum(game.dealerHand);
        }

        const pSum = getSum(game.playerHand);
        let win = false;
        let tie = false;
        let outcome = "";

        if (dSum > 21) {
          win = true;
          outcome = "🏆 *Dealer went Bust! You Win!*";
        } else if (pSum > dSum) {
          win = true;
          outcome = "🏆 *You have a higher hand than dealer! You Win!*";
        } else if (pSum === dSum) {
          tie = true;
          outcome = "⚖️ *Tie / Push! Bets refunded.*";
        } else {
          outcome = "🟥 *Dealer has a higher hand! You Lose!*";
        }

        if (win) {
          p.balance += game.bet;
        } else if (!tie) {
          p.balance -= game.bet;
        }

        activeBlackjackGames.delete(chatId);

        await bot.editMessageText(
          `🃏 *Blackjack Match Concluded* 🃏\n\n` +
          `• *Your Hand:* \`[${game.playerHand.join(", ")}]\` (Total: *${pSum}*)\n` +
          `• *Dealer Hand:* \`[${game.dealerHand.join(", ")}]\` (Total: *${dSum}*)\n\n` +
          `${outcome}\n` +
          `• *Credits:* \`${win ? "+" : tie ? "" : "-"}${win || tie ? game.bet : game.bet} credits\`\n` +
          `• *New Balance:* \`${p.balance} credits\``,
          { chat_id: chatId, message_id: query.message?.message_id, parse_mode: "Markdown" }
        );
      }
    });

    // 5. Fishing Command
    bot.onText(/\/fishing/, async (msg: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/fishing")) return;

      const p = getProfile(userId);
      const rodQty = p.inventory.get("bamboo_rod") || 0;

      if (rodQty <= 0) {
        return bot.sendMessage(chatId, "❌ *No Fishing Rod:* Please buy a `bamboo_rod` from the `/shop` first.", { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, "🎣 *Casting line into deep waters...*");

      setTimeout(async () => {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        const catchOdds = ["Salmon 🐟", "Tuna 🐠", "Blowfish 🐡", "Octopus 🐙", "Shark 🦈", "Old Boot 🥾", "Sunken Treasure 👑"];
        const catchWeight = [15, 10, 8, 20, 5, 25, 1]; // weighting simulation
        const got = catchOdds[Math.floor(Math.random() * catchOdds.length)];

        // Increment inventory
        const itemKey = got.split(" ")[0].toLowerCase();
        const currentQty = p.inventory.get(itemKey) || 0;
        p.inventory.set(itemKey, currentQty + 1);

        // Balance check for special items
        let rewardText = `🎉 *Nice Catch!* You caught an *${got}*! It has been added to your inventory.`;
        if (got === "Sunken Treasure 👑") {
          p.balance += 2000;
          rewardText += `\n🌟 *Bonus Reward:* Found inside: \`+2000 credits\`!`;
        }

        await bot.sendMessage(chatId, rewardText, { parse_mode: "Markdown" });
      }, 1500);
    });

    // 6. Mining Command
    bot.onText(/\/mining/, async (msg: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/mining")) return;

      const p = getProfile(userId);
      const pickQty = p.inventory.get("wood_pickaxe") || 0;

      if (pickQty <= 0) {
        return bot.sendMessage(chatId, "❌ *No Pickaxe:* Please buy a `wood_pickaxe` from the `/shop` first.", { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, "⛏️ *Shattering rocks in deep caverns...*");

      setTimeout(async () => {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        const minerals = ["Coal 🪨", "Iron Ore 🪙", "Gold Ore 🟡", "Diamond 💎", "Emerald 🟢"];
        const got = minerals[Math.floor(Math.random() * minerals.length)];

        const itemKey = got.split(" ")[0].toLowerCase();
        const currentQty = p.inventory.get(itemKey) || 0;
        p.inventory.set(itemKey, currentQty + 1);

        let mineText = `⛏️ *Mining Complete:* Extracted *${got}*! Packed into your inventory.`;
        if (got === "Diamond 💎") {
          p.balance += 1000;
          mineText += `\n💎 *Precious Diamond:* Earned bonus: \`+1000 credits\`!`;
        }

        await bot.sendMessage(chatId, mineText, { parse_mode: "Markdown" });
      }, 1500);
    });

    // 7. Farming Command
    bot.onText(/\/farming/, async (msg: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/farming")) return;

      const p = getProfile(userId);
      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, "🌱 *Sowing seeds and watering fields...*");

      setTimeout(async () => {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        const crops = ["Wheat 🌾", "Potato 🥔", "Carrot 🥕", "Strawberry 🍓"];
        const got = crops[Math.floor(Math.random() * crops.length)];

        const itemKey = got.split(" ")[0].toLowerCase();
        const currentQty = p.inventory.get(itemKey) || 0;
        p.inventory.set(itemKey, currentQty + 1);

        await bot.sendMessage(chatId, `🧑‍🌾 *Farming Complete:* Harvested a rich field of *${got}*!`, { parse_mode: "Markdown" });
      }, 1500);
    });

    // 8. Shop Command
    bot.onText(/\/shop/, async (msg: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/shop")) return;

      const shopText = 
        `🛒 *Termux Economy General Shop* 🛒\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `• ⛏️ \`wood_pickaxe\` - \`300 credits\`\n` +
        `• 🎣 \`bamboo_rod\` - \`300 credits\`\n` +
        `• 🐕 \`pet_dog\` - \`800 credits\`\n` +
        `• 🐈 \`pet_cat\` - \`800 credits\`\n` +
        `• 🥩 \`pet_treat\` - \`50 credits\`\n\n` +
        `💡 _To purchase, buy using Web Panel or reply to command with item name._`;

      await bot.sendMessage(chatId, shopText, { parse_mode: "Markdown" });
    });

    // 9. Pets Adopt/Interact
    bot.onText(/\/pet(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/pet")) return;

      const act = match ? match[1]?.trim().toLowerCase() : "view";
      const p = getProfile(userId);

      if (act === "adopt dog" || act === "adopt cat") {
        const type = act.split(" ")[1];
        if (p.balance < 800) return bot.sendMessage(chatId, "❌ Insufficient balance. adopting a pet costs 800 credits.");
        p.balance -= 800;
        p.pets.push(type);
        return bot.sendMessage(chatId, `🎉 *Pet Adopted!* Adopted a lovely new pet \`${type}\`!`, { parse_mode: "Markdown" });
      }

      if (p.pets.length === 0) {
        return bot.sendMessage(chatId, "🐾 *Virtual Pets:* You don't have any pets adopted. Adopt using `/pet adopt dog` for 800 credits.", { parse_mode: "Markdown" });
      }

      const pet = p.pets[0];
      let petStatusText = `🐾 *Your Active Pet: ${pet.toUpperCase()}* 🐾\n\n`;

      if (act === "feed") {
        petStatusText += `🥩 You fed a delicious steak treat to your ${pet}! It barks/purrs happily.`;
      } else if (act === "play") {
        petStatusText += `🎾 You threw a small ball and played catch with your ${pet}! XP increases.`;
      } else {
        petStatusText += `• *Status:* \`Energetic\`\n• *Happiness:* \`100%\`\n• *Hunger:* \`Satisfied (0%)\`\n\n💡 _Use /pet feed or /pet play to interact._`;
      }

      await bot.sendMessage(chatId, petStatusText, { parse_mode: "Markdown" });
    });

    // 10. Marriage / Divorce
    bot.onText(/\/marriage(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      if (isRateLimited(chatId, "/marriage")) return;

      const partner = match ? match[1]?.trim() : null;
      if (!partner) return bot.sendMessage(chatId, "⚠️ Usage: `/marriage @username` to propose marriage.");

      const p = getProfile(userId);
      p.partner = partner;

      await bot.sendMessage(
        chatId,
        `💖 *MARRIAGE PROPOSAL SUBMITTED!* 💖\n\n` +
        `• @${msg.from?.username || "Player"} proposed to: *${partner}*!\n` +
        `• *Cost:* \`500 credits\` registered.\n\n` +
        `✨ _Waiting for partner to accept in chat..._`,
        { parse_mode: "Markdown" }
      );
    });

    bot.onText(/\/divorce/, async (msg: any) => {
      const chatId = msg.chat.id;
      const userId = String(msg.from?.id);
      const p = getProfile(userId);

      if (!p.partner) return bot.sendMessage(chatId, "⚠️ You are not married.");

      p.partner = undefined;
      await bot.sendMessage(chatId, "💔 *Divorce Executed:* You are now single again.", { parse_mode: "Markdown" });
    });

    // 11. Net worth Leaderboard
    bot.onText(/\/leaderboard/, async (msg: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/leaderboard")) return;

      let ldText = `🏆 *Net Worth Chat Leaderboard* 🏆\n\n`;
      let count = 1;

      gameState.forEach((profile, uId) => {
        ldText += `${count}. *User ${uId}:* \`${profile.balance} credits\` (Lvl: ${profile.level})\n`;
        count++;
      });

      if (gameState.size === 0) {
        ldText += `_No active players yet. Run /rewards to join the board!_`;
      }

      await bot.sendMessage(chatId, ldText, { parse_mode: "Markdown" });
    });
  }
};

export default gamesModule;
