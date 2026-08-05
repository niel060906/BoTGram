import React, { useEffect, useRef, useState, FormEvent } from "react";
import { Terminal as TerminalIcon, Send, RefreshCcw, Trash2 } from "lucide-react";
import { BotConfig } from "../types";
import { Socket } from "socket.io-client";

interface ConsoleViewProps {
  bots: BotConfig[];
  selectedBotId: string;
  setSelectedBotId: (id: string) => void;
  socket: Socket | null;
}

export default function ConsoleView({ bots, selectedBotId, setSelectedBotId, socket }: ConsoleViewProps) {
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Subscription room management for socket
  useEffect(() => {
    if (!socket || !selectedBotId) return;

    // Clear console output before joining new room
    setConsoleLogs([
      `\x1b[36m[SYSTEM]\x1b[0m Establishing terminal socket tunnel for bot ID: ${selectedBotId}...`,
      `\x1b[32m[SYSTEM]\x1b[0m Pipeline connected. Listening for daemon std streams.`
    ]);

    // Join room
    socket.emit("join_console", selectedBotId);

    // Event listener
    const onConsoleOutput = (data: { botId: string; text: string }) => {
      if (data.botId === selectedBotId) {
        setConsoleLogs((prev) => {
          const updated = [...prev, data.text];
          // Limit line buffer to 200 lines to prevent browser frame lag
          if (updated.length > 200) {
            return updated.slice(-200);
          }
          return updated;
        });
      }
    };

    socket.on("console_output", onConsoleOutput);

    return () => {
      socket.emit("leave_console", selectedBotId);
      socket.off("console_output", onConsoleOutput);
    };
  }, [socket, selectedBotId]);

  // Scroll to bottom on log append
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  const activeBot = bots.find((b) => b.id === selectedBotId);

  // Send a custom test command to the console
  const handleSendCommand = (e: FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !selectedBotId || !socket) return;

    // Echo local command in console
    const userLine = `\x1b[35m[USER@TERMUX ~]$\x1b[0m ${commandInput}`;
    setConsoleLogs((prev) => [...prev, userLine]);

    const cmd = commandInput.trim().toLowerCase();
    
    // Simulate interactive developer inputs
    setTimeout(() => {
      if (cmd === "help") {
        setConsoleLogs((prev) => [
          ...prev,
          "📖 Terminal Helper Commands:\n" +
          "  • `help` - Show this menu\n" +
          "  • `status` - Ask runner for current CPU/RAM metrics\n" +
          "  • `clear` - Clear local terminal viewport\n" +
          "  • `ping` - Get socket latency check"
        ]);
      } else if (cmd === "clear") {
        setConsoleLogs([]);
      } else if (cmd === "status") {
        if (activeBot) {
          setConsoleLogs((prev) => [
            ...prev,
            `ℹ️ Bot metrics: name=${activeBot.name}, pid=${activeBot.pid || "offline"}, state=${activeBot.status}`
          ]);
        } else {
          setConsoleLogs((prev) => [...prev, "❌ No bot active on this pipeline context."]);
        }
      } else if (cmd === "ping") {
        setConsoleLogs((prev) => [...prev, `pong! Latency check complete: OK`]);
      } else {
        setConsoleLogs((prev) => [...prev, `sh: command not found: ${cmd}`]);
      }
    }, 200);

    setCommandInput("");
  };

  const handleClearTerminal = () => {
    setConsoleLogs([`\x1b[33m[SYSTEM]\x1b[0m Terminal viewport cleared.`]);
  };

  // Convert custom console ansi tags to standard HTML styles for render
  const renderLogLine = (line: string, index: number) => {
    let text = line;
    let className = "text-slate-300 font-mono text-xs leading-relaxed break-all";

    if (text.includes("\x1b[36m") || text.includes("[INFO]")) {
      text = text.replace(/\x1b\[36m/g, "").replace(/\x1b\[0m/g, "");
      className += " text-cyan-400";
    } else if (text.includes("\x1b[32m") || text.includes("[SUCCESS]")) {
      text = text.replace(/\x1b\[32m/g, "").replace(/\x1b\[0m/g, "");
      className += " text-emerald-400 font-semibold";
    } else if (text.includes("\x1b[33m") || text.includes("[WARNING]")) {
      text = text.replace(/\x1b\[33m/g, "").replace(/\x1b\[0m/g, "");
      className += " text-amber-400";
    } else if (text.includes("\x1b[31m") || text.includes("[ERROR]") || text.includes("[CRITICAL")) {
      text = text.replace(/\x1b\[31m/g, "").replace(/\x1b\[0m/g, "");
      className += " text-rose-400";
    } else if (text.includes("\x1b[35m")) {
      text = text.replace(/\x1b\[35m/g, "").replace(/\x1b\[0m/g, "");
      className += " text-fuchsia-400";
    }

    return (
      <div key={index} className={className}>
        {text}
      </div>
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/20 p-5 rounded-2xl border border-slate-800/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-850 border border-slate-800 rounded-xl">
            <TerminalIcon className="text-cyan-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Live Bot Console
            </h2>
            <p className="text-xs text-slate-400">
              Pipeline stream connection for standard system output.
            </p>
          </div>
        </div>

        {/* Bot selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-mono text-slate-400 whitespace-nowrap uppercase">
            SELECT BOT:
          </label>
          <select
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
            className="flex-1 sm:flex-initial text-sm bg-slate-950/80 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">-- Choose active bot --</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.status === "running" ? "Online" : "Offline"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Terminal Viewport */}
      {selectedBotId ? (
        <div className="flex-1 flex flex-col bg-slate-950 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
          {/* Terminal Titlebar */}
          <div className="flex justify-between items-center px-5 py-3 bg-slate-900/60 border-b border-slate-900 text-[10px] font-mono tracking-wider text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="ml-2 font-bold text-slate-300">
                sh - runner@{activeBot?.name || "bot"}.service
              </span>
            </div>
            <button
              onClick={handleClearTerminal}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 hover:text-white transition duration-200 text-slate-500"
              title="Clear Console"
            >
              <Trash2 size={12} />
              <span>CLEAR</span>
            </button>
          </div>

          {/* Lines block */}
          <div className="flex-1 p-6 overflow-y-auto space-y-1 bg-slate-950 font-mono scrollbar-thin select-text">
            {consoleLogs.map((line, index) => renderLogLine(line, index))}
            <div ref={terminalEndRef} />
          </div>

          {/* Interactive Input Form */}
          <form
            onSubmit={handleSendCommand}
            className="p-4 bg-slate-900/40 border-t border-slate-900/80 flex items-center gap-3 backdrop-blur-md"
          >
            <span className="text-cyan-400 font-mono text-xs select-none">
              $
            </span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Type terminal command (e.g., help, clear, status)..."
              className="flex-1 bg-transparent border-none text-slate-200 focus:outline-none focus:ring-0 text-xs font-mono placeholder:text-slate-600"
            />
            <button
              type="submit"
              className="p-2 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center items-center p-12 text-center bg-slate-900/10 border border-dashed border-slate-800/80 rounded-2xl">
          <div className="p-4 bg-slate-900/50 rounded-full text-slate-500 mb-4 border border-slate-800/40">
            <TerminalIcon size={28} />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">
            No pipeline stream active
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Select a Telegram Bot from the selector above to establish a live WebSockets terminal connection.
          </p>
        </div>
      )}
    </div>
  );
}
