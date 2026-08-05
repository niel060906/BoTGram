import React, { useState, FormEvent } from "react";
import { 
  Bot, 
  Play, 
  Square, 
  RotateCcw, 
  Edit, 
  Trash2, 
  Terminal, 
  Plus, 
  Eye, 
  EyeOff, 
  X,
  AlertTriangle,
  RefreshCw,
  Clock,
  Cpu,
  HardDrive
} from "lucide-react";
import { BotConfig } from "../types";
import axios from "axios";

interface BotsListProps {
  bots: BotConfig[];
  fetchBots: () => void;
  setSelectedBotId: (id: string) => void;
  setActiveTab: (tab: string) => void;
}

export default function BotsList({ bots, fetchBots, setSelectedBotId, setActiveTab }: BotsListProps) {
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotConfig | null>(null);

  // Form states
  const [botName, setBotName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Token visibility map
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Create Bot
  const handleCreateBot = async (e: FormEvent) => {
    e.preventDefault();
    if (!botName.trim() || !botToken.trim()) {
      setErrorMsg("All inputs are required.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      await axios.post("/api/bots", {
        name: botName.trim(),
        token: botToken.trim(),
      });
      fetchBots();
      setIsCreateOpen(false);
      setBotName("");
      setBotToken("");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to validate or register bot.");
    } finally {
      setLoading(false);
    }
  };

  // Edit Bot
  const handleEditBot = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingBot) return;

    setLoading(true);
    setErrorMsg("");

    try {
      await axios.put(`/api/bots/${editingBot.id}`, {
        name: botName.trim(),
        token: botToken.trim(),
      });
      fetchBots();
      setIsEditOpen(false);
      setEditingBot(null);
      setBotName("");
      setBotToken("");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to edit bot.");
    } finally {
      setLoading(false);
    }
  };

  // Bot process signals
  const triggerBotAction = async (id: string, action: "start" | "stop" | "restart") => {
    try {
      await axios.post(`/api/bots/${id}/${action}`);
      fetchBots();
    } catch (err: any) {
      alert(err.response?.data?.error || `Action ${action} failed.`);
    }
  };

  // Delete Bot
  const handleDeleteBot = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This deletes the sessions and logs associated with this bot.`)) return;
    try {
      await axios.delete(`/api/bots/${id}`);
      fetchBots();
    } catch (err) {
      alert("Failed to delete bot.");
    }
  };

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return "0s";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/20 p-5 rounded-2xl border border-slate-800/60 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">
            Registered Telegram Bots
          </h2>
          <p className="text-xs text-slate-400">
            Isolated daemon containers running on a unified Core Engine module network.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg("");
            setBotName("");
            setBotToken("");
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-mono text-xs font-bold text-slate-950 hover:shadow-lg transition duration-200"
        >
          <Plus size={16} />
          <span>REGISTER NEW BOT</span>
        </button>
      </div>

      {/* Grid container */}
      {bots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => {
            const isOnline = bot.status === "running";
            const isTokenVisible = !!visibleTokens[bot.id];

            return (
              <div
                key={bot.id}
                className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between relative overflow-hidden group hover:border-slate-700/60 transition duration-300"
              >
                {/* Visual Glow Status */}
                <div className={`absolute top-0 right-0 w-20 h-20 rounded-full filter blur-2xl opacity-10 ${
                  isOnline ? "bg-emerald-500" : "bg-slate-500"
                }`} />

                <div>
                  {/* Status header & name */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-850 border border-slate-800 rounded-xl">
                        <Bot className={isOnline ? "text-cyan-400" : "text-slate-500"} size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-wide font-mono">
                          {bot.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono">
                          ID: {bot.id}
                        </p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                      isOnline 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" 
                        : "bg-slate-950 text-slate-500 border border-slate-900"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                      <span>{isOnline ? "ACTIVE" : "OFFLINE"}</span>
                    </div>
                  </div>

                  {/* Token block */}
                  <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl mb-4 font-mono text-[10px] text-slate-500 flex items-center justify-between gap-2 overflow-hidden">
                    <span className="truncate flex-1 select-all">
                      {isTokenVisible ? bot.token : `${bot.token.substring(0, 9)}*************************`}
                    </span>
                    <button
                      onClick={() => toggleTokenVisibility(bot.id)}
                      className="text-slate-500 hover:text-slate-300 transition shrink-0"
                    >
                      {isTokenVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>

                  {/* Metrics details */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900 mb-6 text-xs font-mono">
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 block uppercase">PID</span>
                      <span className="text-slate-300 block font-semibold">{bot.pid || "-"}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 block uppercase">UPTIME</span>
                      <span className="text-slate-300 block flex items-center gap-1">
                        <Clock size={10} className="text-slate-500" />
                        {isOnline ? formatUptime(bot.uptime) : "0s"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 block uppercase">PROCESSOR</span>
                      <span className="text-slate-300 block flex items-center gap-1">
                        <Cpu size={10} className="text-slate-500" />
                        {isOnline ? `${bot.cpu}%` : "0%"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 block uppercase">ALLOC RAM</span>
                      <span className="text-slate-300 block flex items-center gap-1">
                        <HardDrive size={10} className="text-slate-500" />
                        {isOnline ? `${bot.ram} MB` : "0 MB"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid controls */}
                <div className="flex gap-2">
                  <div className="flex-1 flex gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-900 shrink-0">
                    {isOnline ? (
                      <button
                        onClick={() => triggerBotAction(bot.id, "stop")}
                        className="flex-1 flex justify-center py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg transition"
                        title="Stop Daemon"
                      >
                        <Square size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => triggerBotAction(bot.id, "start")}
                        className="flex-1 flex justify-center py-2 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 rounded-lg transition"
                        title="Start Daemon"
                      >
                        <Play size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => triggerBotAction(bot.id, "restart")}
                      disabled={!isOnline}
                      className="flex-1 flex justify-center py-2 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 rounded-lg transition disabled:opacity-30"
                      title="Restart Daemon"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setEditingBot(bot);
                        setBotName(bot.name);
                        setBotToken(bot.token);
                        setErrorMsg("");
                        setIsEditOpen(true);
                      }}
                      className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-cyan-400 rounded-xl transition"
                      title="Edit Configuration"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBotId(bot.id);
                        setActiveTab("console");
                      }}
                      className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-cyan-400 rounded-xl transition"
                      title="Inspect Live Console"
                    >
                      <Terminal size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteBot(bot.id, bot.name)}
                      className="p-3 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-500 hover:text-rose-400 rounded-xl transition"
                      title="Delete Container"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center p-16 text-center bg-slate-900/10 border border-dashed border-slate-800/80 rounded-2xl">
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl text-slate-500 mb-4">
            <Bot size={28} />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">
            No active bots configured
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Click on "Register New Bot" at the top right corner to connect your first bot via BotFather API token.
          </p>
        </div>
      )}

      {/* Creation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-white tracking-wide font-mono uppercase mb-4">
              Register New Bot Daemon
            </h3>

            <form onSubmit={handleCreateBot} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                  Bot Container Name:
                </label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g., DownloaderBot"
                  className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                  BotFather Telegram API Token:
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="e.g., 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 font-mono text-xs text-slate-400 border border-slate-850 hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-mono text-xs text-slate-950 font-bold hover:shadow-lg transition flex justify-center items-center gap-2"
                >
                  {loading && <RefreshCw size={12} className="animate-spin" />}
                  <span>{loading ? "VALIDATING..." : "VERIFY & REGISTER"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Modal */}
      {isEditOpen && editingBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button
              onClick={() => {
                setIsEditOpen(false);
                setEditingBot(null);
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-white tracking-wide font-mono uppercase mb-4">
              Edit Bot Config
            </h3>

            <form onSubmit={handleEditBot} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                  Bot Name:
                </label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                  Bot Token (BotFather):
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingBot(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 font-mono text-xs text-slate-400 border border-slate-850 hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-mono text-xs text-slate-950 font-bold hover:shadow-lg transition flex justify-center items-center gap-2"
                >
                  {loading && <RefreshCw size={12} className="animate-spin" />}
                  <span>{loading ? "VALIDATING..." : "VERIFY & SAVE"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
