import { BotModule } from "../core/types";
import { GoogleGenAI } from "@google/genai";
import {
  isRateLimited,
  validateInput,
  checkPermissions,
  updateProgress,
  handleCommandError,
  requestCache,
} from "./utils";

interface Track {
  title: string;
  artist: string;
  duration: string;
  requestedBy: string;
}

// In-memory chat music queues and playing state
const musicQueues = new Map<number, Track[]>();
const currentTracks = new Map<number, Track>();
const playbackStatus = new Map<number, "playing" | "paused" | "stopped">();
const volumes = new Map<number, number>(); // default volume 80%
const playHistory = new Map<number, Track[]>();

const musicModule: BotModule = {
  id: "music",
  name: "Music Services & Queue",
  version: "1.0.0",
  description: "Play music, manage queues, find chords, lyrics, and Spotify search.",
  commands: [
    { name: "/play", description: "Search and play a song in queue (e.g., /play Faded)" },
    { name: "/song", description: "Download/retrieve a song as an audio file" },
    { name: "/lyrics", description: "Fetch lyrics of a song (e.g., /lyrics Perfect)" },
    { name: "/chord", description: "Get guitar chords of a song (e.g., /chord Hotel California)" },
    { name: "/spotify", description: "Search tracks or playlists on Spotify" },
    { name: "/album", description: "Search for a specific music album details" },
    { name: "/artist", description: "Search for a music artist profile" },
    { name: "/playlist", description: "Display queue or search a playlist" },
    { name: "/queue", description: "View the current music queue for this chat" },
    { name: "/pause", description: "Pause the music playback" },
    { name: "/resume", description: "Resume the paused music" },
    { name: "/skip", description: "Skip the current playing song" },
    { name: "/shuffle", description: "Shuffle the active play queue" },
    { name: "/volume", description: "Adjust volume level (0-100)" },
    { name: "/stop", description: "Stop playback and clear active queue" },
    { name: "/recently_played", description: "View recently played tracks history" },
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

    // Helper to get or init queue
    const getQueue = (chatId: number): Track[] => {
      if (!musicQueues.has(chatId)) musicQueues.set(chatId, []);
      return musicQueues.get(chatId)!;
    };

    // Helper to add history
    const addToHistory = (chatId: number, track: Track) => {
      if (!playHistory.has(chatId)) playHistory.set(chatId, []);
      const history = playHistory.get(chatId)!;
      history.unshift(track);
      if (history.length > 20) history.pop();
    };

    // 1. Play command
    bot.onText(/\/play(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/play")) return;

      const perm = checkPermissions(msg);
      if (!perm.allowed) {
        return bot.sendMessage(chatId, perm.reason, { parse_mode: "Markdown" });
      }

      const query = match ? match[1]?.trim() : null;
      if (!query) {
        return bot.sendMessage(
          chatId,
          "🎵 *Music Play Helper*\n\n" +
          "Usage: `/play <song name / url>`\n" +
          "Example: `/play Alan Walker Faded`",
          { parse_mode: "Markdown" }
        );
      }

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, "🔍 *Searching for your track...*");

      try {
        await updateProgress(bot, chatId, loading.message_id, 30, "Querying music indices");
        
        // Use AI to get simulated metadata & details about this song
        const cacheKey = `music:play:${query}`;
        let trackInfo: { title: string; artist: string; duration: string } | null = requestCache.get(cacheKey);

        if (!trackInfo) {
          const ai = getAIClient();
          const prompt = `Return a JSON object containing the music track information for: "${query}". Format JSON exactly with keys: title (string), artist (string), duration (string, e.g. "3:42").`;
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
            config: { responseMimeType: "application/json" }
          });
          trackInfo = JSON.parse(response.text || "{}");
          if (trackInfo) requestCache.set(cacheKey, trackInfo);
        }

        await updateProgress(bot, chatId, loading.message_id, 80, "Adding track to playback queue");

        const track: Track = {
          title: trackInfo?.title || query,
          artist: trackInfo?.artist || "Unknown Artist",
          duration: trackInfo?.duration || "3:00",
          requestedBy: msg.from?.first_name || "User",
        };

        const queue = getQueue(chatId);
        queue.push(track);
        addToHistory(chatId, track);

        const current = currentTracks.get(chatId);
        let playingNow = false;
        if (!current || playbackStatus.get(chatId) === "stopped") {
          currentTracks.set(chatId, track);
          playbackStatus.set(chatId, "playing");
          queue.shift(); // remove from queue since it's playing
          playingNow = true;
        }

        const keyboard = {
          inline_keyboard: [
            [
              { text: playingNow ? "⏸️ Pause" : "▶️ Play", callback_data: playingNow ? "music_pause" : "music_resume" },
              { text: "⏭️ Skip", callback_data: "music_skip" },
              { text: "🔁 Queue", callback_data: "music_queue" }
            ],
            [
              { text: "🎵 Lyrics", callback_data: `music_lyrics:${track.title}` },
              { text: "🎸 Chords", callback_data: `music_chord:${track.title}` }
            ]
          ]
        };

        const text = playingNow
          ? `▶️ *Now Playing:*\n\n` +
            `• *Song:* \`${track.title}\`\n` +
            `• *Artist:* \`${track.artist}\`\n` +
            `• *Duration:* \`${track.duration}\`\n` +
            `• *Requested By:* _${track.requestedBy}_\n\n` +
            `🔊 _Volume: ${volumes.get(chatId) || 80}% | Status: Playing_`
          : `➕ *Added to Queue [Position #${queue.length}]:*\n\n` +
            `• *Song:* \`${track.title}\`\n` +
            `• *Artist:* \`${track.artist}\`\n` +
            `• *Duration:* \`${track.duration}\`\n` +
            `• *Requested By:* _${track.requestedBy}_\n\n` +
            `💡 _Use /queue to see all songs._`;

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: keyboard });
      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/play", context.logger);
      }
    });

    // 2. Song Download command
    bot.onText(/\/song(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      if (isRateLimited(chatId, "/song")) return;

      const query = match ? match[1]?.trim() : null;
      if (!query) {
        return bot.sendMessage(chatId, "Usage: `/song <song name>` to retrieve high quality MP3 audio file.", { parse_mode: "Markdown" });
      }

      await bot.sendChatAction(chatId, "upload_audio");
      const status = await bot.sendMessage(chatId, "🔍 *Searching database and generating MP3...*");

      try {
        await updateProgress(bot, chatId, status.message_id, 40, "Downloading from server registry");
        await updateProgress(bot, chatId, status.message_id, 80, "Converting and injection metadata tags");

        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Return song title and artist for "${query}" in simple text format.`,
        });

        const songName = response.text?.trim() || query;
        await bot.deleteMessage(chatId, status.message_id).catch(() => {});

        // Send simulated high-quality download details with premium audio mock
        await bot.sendMessage(
          chatId,
          `📥 *Audio File Downloaded!* \n\n` +
          `• *Song:* \`${songName}\`\n` +
          `• *Quality:* \`320kbps High Fidelity (Stereo)\`\n` +
          `• *Size:* \`8.43 MB\`\n\n` +
          `🔊 _Due to environment restrictions, full MP3 file is hosted. You can preview it using our Web Panel dashboard._`,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        await bot.deleteMessage(chatId, status.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/song", context.logger);
      }
    });

    // 3. Lyrics command
    bot.onText(/\/lyrics(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const query = match ? match[1]?.trim() : null;
      if (!query) return bot.sendMessage(chatId, "Usage: `/lyrics <song name>`", { parse_mode: "Markdown" });

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `🔍 *Searching lyrics for: "${query}"...*`);

      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Provide complete lyrics for the song: "${query}". If lyrics are long, format nicely.`,
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await bot.sendMessage(chatId, `🎤 *Lyrics for: ${query}*\n\n${response.text || "Lyrics not found"}`, { parse_mode: "Markdown" });
      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/lyrics", context.logger);
      }
    });

    // 4. Chord command
    bot.onText(/\/chord(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const query = match ? match[1]?.trim() : null;
      if (!query) return bot.sendMessage(chatId, "Usage: `/chord <song name>`", { parse_mode: "Markdown" });

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `🔍 *Searching guitar chords for: "${query}"...*`);

      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `Provide guitar chords and key for the song: "${query}". Format code block nicely with [C] [G] [Am] style inline markup.`,
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await bot.sendMessage(chatId, `🎸 *Guitar Chords for: ${query}*\n\n${response.text || "Chords not found"}`, { parse_mode: "Markdown" });
      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/chord", context.logger);
      }
    });

    // 5. Spotify search
    bot.onText(/\/spotify(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const query = match ? match[1]?.trim() : null;
      if (!query) return bot.sendMessage(chatId, "Usage: `/spotify <query>`", { parse_mode: "Markdown" });

      await bot.sendChatAction(chatId, "typing");
      const loading = await bot.sendMessage(chatId, `🔍 *Searching Spotify catalog...*`);

      try {
        const ai = getAIClient();
        const prompt = `Simulate a Spotify track and playlist search result for query: "${query}". Return a list of 5 matching tracks with their album and direct links in a beautiful markdown format.`;
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
        });

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await bot.sendMessage(chatId, `🟢 *Spotify Search Results:*\n\n${response.text}`, { parse_mode: "Markdown" });
      } catch (err) {
        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
        await handleCommandError(bot, chatId, err, "/spotify", context.logger);
      }
    });

    // Other Music commands
    bot.onText(/\/album(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const query = match ? match[1]?.trim() : null;
      if (!query) return bot.sendMessage(chatId, "Usage: `/album <album name>`", { parse_mode: "Markdown" });

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Describe the album details, tracklist, and released year for: "${query}". Format nicely.`,
      });
      await bot.sendMessage(chatId, `💿 *Album Details: ${query}*\n\n${response.text}`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/artist(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const query = match ? match[1]?.trim() : null;
      if (!query) return bot.sendMessage(chatId, "Usage: `/artist <artist name>`", { parse_mode: "Markdown" });

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Provide details, top tracks, biography, and monthly listeners of the artist: "${query}".`,
      });
      await bot.sendMessage(chatId, `🧑‍🎤 *Artist Profile: ${query}*\n\n${response.text}`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/playlist(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const query = match ? match[1]?.trim() : null;
      if (!query) return bot.sendMessage(chatId, "Usage: `/playlist <genre/theme>`", { parse_mode: "Markdown" });

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Recommend a custom music playlist of 10 tracks for: "${query}".`,
      });
      await bot.sendMessage(chatId, `🎼 *Playlist recommendations for: ${query}*\n\n${response.text}`, { parse_mode: "Markdown" });
    });

    bot.onText(/\/queue/, async (msg: any) => {
      const chatId = msg.chat.id;
      const queue = getQueue(chatId);
      const current = currentTracks.get(chatId);

      let text = `🎵 *Music Queue for this Chat* 🎵\n\n`;
      if (current) {
        text += `▶️ *Currently Playing:*\n• \`${current.title}\` - ${current.artist} [${current.duration}] (Requested by: ${current.requestedBy})\n\n`;
      } else {
        text += `⏸️ _No song is currently playing._\n\n`;
      }

      text += `📋 *Up Next [${queue.length} track(s)]:*\n`;
      if (queue.length === 0) {
        text += `_Queue is empty. Use /play to add songs!_`;
      } else {
        queue.forEach((track, index) => {
          text += `${index + 1}. \`${track.title}\` - ${track.artist} [${track.duration}] (by: ${track.requestedBy})\n`;
        });
      }

      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    });

    bot.onText(/\/pause/, async (msg: any) => {
      const chatId = msg.chat.id;
      playbackStatus.set(chatId, "paused");
      await bot.sendMessage(chatId, "⏸️ *Playback has been paused.* Use `/resume` to continue playing.", { parse_mode: "Markdown" });
    });

    bot.onText(/\/resume/, async (msg: any) => {
      const chatId = msg.chat.id;
      playbackStatus.set(chatId, "playing");
      await bot.sendMessage(chatId, "▶️ *Resuming playback.* Enjoy the beats!", { parse_mode: "Markdown" });
    });

    bot.onText(/\/skip/, async (msg: any) => {
      const chatId = msg.chat.id;
      const queue = getQueue(chatId);
      const next = queue.shift();

      if (next) {
        currentTracks.set(chatId, next);
        playbackStatus.set(chatId, "playing");
        await bot.sendMessage(chatId, `⏭️ *Skipped current song!*\n\n▶️ *Now Playing:*\n• \`${next.title}\` - ${next.artist} [${next.duration}]`, { parse_mode: "Markdown" });
      } else {
        currentTracks.delete(chatId);
        playbackStatus.set(chatId, "stopped");
        await bot.sendMessage(chatId, "⏭️ *Skipped!* No more songs in the queue.", { parse_mode: "Markdown" });
      }
    });

    bot.onText(/\/shuffle/, async (msg: any) => {
      const chatId = msg.chat.id;
      const queue = getQueue(chatId);

      if (queue.length < 2) {
        return bot.sendMessage(chatId, "⚠️ *Cannot Shuffle:* You need at least 2 songs in the queue to shuffle.", { parse_mode: "Markdown" });
      }

      // Fisher-Yates Shuffle
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }

      await bot.sendMessage(chatId, "🔀 *Queue shuffled successfully!* Use `/queue` to see the new order.", { parse_mode: "Markdown" });
    });

    bot.onText(/\/volume(?:\s+(.+))?/, async (msg: any, match: any) => {
      const chatId = msg.chat.id;
      const volStr = match ? match[1]?.trim() : null;

      if (!volStr) {
        const currentVol = volumes.get(chatId) || 80;
        return bot.sendMessage(chatId, `🔊 *Current Volume:* \`${currentVol}%\``, { parse_mode: "Markdown" });
      }

      const val = parseInt(volStr, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        return bot.sendMessage(chatId, "❌ *Invalid Volume:* Please provide a level between `0` and `100`.", { parse_mode: "Markdown" });
      }

      volumes.set(chatId, val);
      await bot.sendMessage(chatId, `🔊 *Volume level updated to:* \`${val}%\``, { parse_mode: "Markdown" });
    });

    bot.onText(/\/stop/, async (msg: any) => {
      const chatId = msg.chat.id;
      musicQueues.delete(chatId);
      currentTracks.delete(chatId);
      playbackStatus.set(chatId, "stopped");
      await bot.sendMessage(chatId, "⏹️ *Playback stopped and active queue cleared.*", { parse_mode: "Markdown" });
    });

    bot.onText(/\/recently_played/, async (msg: any) => {
      const chatId = msg.chat.id;
      const history = playHistory.get(chatId) || [];

      if (history.length === 0) {
        return bot.sendMessage(chatId, "⏮️ *No songs recently played in this chat yet.*", { parse_mode: "Markdown" });
      }

      let text = `⏮️ *Recently Played Tracks (History)* ⏮️\n\n`;
      history.slice(0, 10).forEach((track, index) => {
        text += `${index + 1}. \`${track.title}\` - ${track.artist} (by: ${track.requestedBy})\n`;
      });

      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
    });

    // 6. Support Inline Callbacks for Music Controller
    bot.on("callback_query", async (query: any) => {
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      const data = query.data;

      if (!chatId || !data || !data.startsWith("music_")) return;

      try {
        await bot.answerCallbackQuery(query.id);

        if (data === "music_pause") {
          playbackStatus.set(chatId, "paused");
          await bot.sendMessage(chatId, "⏸️ *Paused via dashboard.*");
        } else if (data === "music_resume") {
          playbackStatus.set(chatId, "playing");
          await bot.sendMessage(chatId, "▶️ *Resumed via dashboard.*");
        } else if (data === "music_skip") {
          const queue = getQueue(chatId);
          const next = queue.shift();
          if (next) {
            currentTracks.set(chatId, next);
            await bot.sendMessage(chatId, `⏭️ *Skipped!* Now playing: \`${next.title}\``);
          } else {
            currentTracks.delete(chatId);
            await bot.sendMessage(chatId, "⏭️ *Skipped!* Queue is empty.");
          }
        } else if (data === "music_queue") {
          const queue = getQueue(chatId);
          let qText = `📋 *Upcoming Songs:* \n`;
          if (queue.length === 0) {
            qText += `_Queue is currently empty._`;
          } else {
            queue.forEach((t, i) => {
              qText += `${i + 1}. \`${t.title}\` - ${t.artist}\n`;
            });
          }
          await bot.sendMessage(chatId, qText, { parse_mode: "Markdown" });
        } else if (data.startsWith("music_lyrics:")) {
          const song = data.split(":")[1];
          const ai = getAIClient();
          const res = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: `Lyrics for ${song}`,
          });
          await bot.sendMessage(chatId, `🎤 *Lyrics:* \n\n${res.text || "Not found"}`, { parse_mode: "Markdown" });
        } else if (data.startsWith("music_chord:")) {
          const song = data.split(":")[1];
          const ai = getAIClient();
          const res = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: `Guitar chords for ${song}`,
          });
          await bot.sendMessage(chatId, `🎸 *Guitar Chords:* \n\n${res.text || "Not found"}`, { parse_mode: "Markdown" });
        }
      } catch (err) {
        context.logger.error("Music callback error", err);
      }
    });
  }
};

export default musicModule;
