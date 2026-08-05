import React, { useEffect, useState, FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import axios from "axios";
import { 
  BotConfig, 
  SystemLog, 
  ModuleConfig, 
  AppSettings, 
  SystemStats 
} from "./types";
import Sidebar from "./components/Sidebar";
import DashboardHome from "./components/DashboardHome";
import BotsList from "./components/BotsList";
import ConsoleView from "./components/ConsoleView";
import FileManager from "./components/FileManager";
import AboutMe from "./components/AboutMe";
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Search, 
  Trash2, 
  Download, 
  Layers, 
  Zap, 
  RefreshCw, 
  Settings, 
  ShieldAlert,
  Sliders,
  Database,
  Terminal,
  Cpu,
  HardDrive,
  FileText
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Filter logs states
  const [logBotFilter, setLogBotFilter] = useState<string>("");
  const [logTypeFilter, setLogTypeFilter] = useState<string>("");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");

  // Form settings states
  const [prefix, setPrefix] = useState("/");
  const [ownerId, setOwnerId] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [autoRestart, setAutoRestart] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(1000);
  const [saveSettingsStatus, setSaveSettingsStatus] = useState<string>("");

  // Import config paste state
  const [importConfigRaw, setImportConfigRaw] = useState("");
  const [importStatus, setImportStatus] = useState("");

  // API fetches
  const fetchBots = async () => {
    try {
      const res = await axios.get("/api/bots");
      setBots(res.data);
      if (res.data.length > 0 && !selectedBotId) {
        setSelectedBotId(res.data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch bots list", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (logBotFilter) params.append("botId", logBotFilter);
      if (logTypeFilter) params.append("type", logTypeFilter);
      if (logSearchQuery) params.append("search", logSearchQuery);

      const res = await axios.get(`/api/logs?${params.toString()}`);
      setLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch logs historical list", err);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await axios.get("/api/modules");
      setModules(res.data);
    } catch (err) {
      console.error("Failed to fetch modules status", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get("/api/settings");
      setSettings(res.data);
      setPrefix(res.data.prefix);
      setOwnerId(res.data.ownerId);
      setTimezone(res.data.timezone);
      setAutoRestart(res.data.autoRestart);
      setPollingInterval(res.data.pollingInterval);
    } catch (err) {
      console.error("Failed to fetch system configurations", err);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const res = await axios.get("/api/system/stats");
      setSystemStats(res.data);
    } catch (err) {
      console.error("Failed to query system stats metrics", err);
    }
  };

  // Connect WebSockets
  useEffect(() => {
    const s = io(window.location.origin);
    setSocket(s);

    s.on("connect", () => {
      console.log("WebSocket tunnel connected successfully.");
    });

    s.on("bot_status_changed", (data: { botId: string; status: "running" | "stopped" }) => {
      setBots((prevBots) => 
        prevBots.map((b) => (b.id === data.botId ? { ...b, status: data.status } : b))
      );
    });

    s.on("bot_telemetry", (data: { botId: string; cpu: number; ram: number; uptime: number }) => {
      setBots((prevBots) => 
        prevBots.map((b) => (b.id === data.botId ? { ...b, cpu: data.cpu, ram: data.ram, uptime: data.uptime } : b))
      );
    });

    s.on("global_log_received", (payload: any) => {
      // Prepend live logs
      setLogs((prev) => [
        {
          id: "live-" + Math.random().toString(36).substr(2, 9),
          type: payload.type,
          message: payload.message,
          timestamp: payload.timestamp,
        },
        ...prev.slice(0, 200) // cap size on client
      ]);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // Fetch initial loads
  useEffect(() => {
    fetchBots();
    fetchLogs();
    fetchModules();
    fetchSettings();
    fetchSystemStats();

    // Poll system stats every 5 seconds
    const interval = setInterval(fetchSystemStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync log filters
  useEffect(() => {
    fetchLogs();
  }, [logBotFilter, logTypeFilter, logSearchQuery]);

  // Toggle Module Enable/Disable Globally
  const handleToggleModule = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await axios.post(`/api/modules/${id}/toggle`, { enabled: !currentEnabled });
      if (res.data.success) {
        setModules((prev) => 
          prev.map((m) => (m.id === id ? { ...m, enabled: !currentEnabled } : m))
        );
      }
    } catch (err) {
      alert("Failed to toggle module.");
    }
  };

  // Hot Reload action
  const handleTriggerHotReload = async () => {
    try {
      await axios.get("/api/modules"); // Recalls re-scan
      fetchModules();
      alert("Dynamic scanner synchronized. All modules re-evaluated on active bot runtimes.");
    } catch (err) {
      alert("Hot reload check failed.");
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSaveSettingsStatus("saving");
    try {
      await axios.put("/api/settings", {
        prefix,
        ownerId,
        timezone,
        autoRestart,
        pollingInterval,
      });
      setSaveSettingsStatus("success");
      fetchSettings();
      setTimeout(() => setSaveSettingsStatus(""), 3000);
    } catch (err) {
      setSaveSettingsStatus("error");
      setTimeout(() => setSaveSettingsStatus(""), 3500);
    }
  };

  // Wipe Logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to completely clear all historical records?")) return;
    try {
      await axios.post("/api/logs/clear");
      fetchLogs();
    } catch (err) {
      alert("Failed to clear logs.");
    }
  };

  // Download Logs as CSV
  const handleDownloadLogs = () => {
    if (logs.length === 0) {
      alert("No logs available to export.");
      return;
    }
    const headers = "ID,Timestamp,BotName,Type,Message\n";
    const rows = logs.map((l) => {
      const botName = bots.find((b) => b.id === l.botId)?.name || "System";
      return `"${l.id}","${l.timestamp}","${botName}","${l.type}","${l.message.replace(/"/g, '""')}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termux_bot_panel_logs_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export Complete config
  const handleExportConfig = () => {
    const configData = {
      bots,
      settings,
      modules,
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termux_bot_panel_config_backup_${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Import configuration paste
  const handleImportConfig = async () => {
    if (!importConfigRaw.trim()) {
      setImportStatus("Please paste valid JSON config.");
      return;
    }
    try {
      const parsed = JSON.parse(importConfigRaw.trim());
      if (!parsed.settings) {
        setImportStatus("Invalid backup format: missing settings node.");
        return;
      }
      
      // Sync settings
      await axios.put("/api/settings", parsed.settings);

      // Re-populate bots if present
      if (parsed.bots && Array.isArray(parsed.bots)) {
        for (const b of parsed.bots) {
          // Add them incrementally (checking duplicates)
          const exist = bots.find((existBot) => existBot.name === b.name || existBot.token === b.token);
          if (!exist) {
            await axios.post("/api/bots", { name: b.name, token: b.token }).catch(() => {});
          }
        }
      }

      setImportStatus("Configuration imported successfully! Refreshing view...");
      setImportConfigRaw("");
      fetchSettings();
      fetchBots();
      setTimeout(() => setImportStatus(""), 3000);
    } catch (err) {
      setImportStatus("Import failed: JSON syntax parse error.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300">
      
      {/* Dynamic Animated Nebula Background Grid */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.05)_0%,transparent_50%),radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.05)_0%,transparent_50%)] pointer-events-none" />

      {/* Main Container Grid */}
      <div className="flex w-full relative z-10">
        
        {/* Visual Sidebar Navigation */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />

        {/* Content Wrapper */}
        <main className="flex-1 flex flex-col p-6 md:p-10 lg:p-12 min-w-0 h-screen overflow-y-auto">
          
          {/* Top Bar Workspace Header info */}
          <header className="flex justify-between items-center mb-10 pb-4 border-b border-slate-900/40">
            <div className="pl-12 md:pl-0">
              <span className="text-[10px] text-cyan-400 font-mono tracking-widest font-bold uppercase block">
                ACTIVE PIPELINE CONTEXT
              </span>
              <h2 className="text-sm font-semibold text-slate-300 font-mono flex items-center gap-2">
                /{activeTab}
              </h2>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-slate-900 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>SERVER: ONLINE</span>
              </div>
            </div>
          </header>

          {/* Core Tab Routing Panels */}
          <div className="flex-1">
            
            {/* Dashboard tab */}
            {activeTab === "dashboard" && (
              <DashboardHome 
                bots={bots} 
                stats={systemStats} 
                moduleCount={modules.length} 
                setActiveTab={setActiveTab} 
              />
            )}

            {/* Bots Manager tab */}
            {activeTab === "bots" && (
              <BotsList 
                bots={bots} 
                fetchBots={fetchBots} 
                setSelectedBotId={setSelectedBotId} 
                setActiveTab={setActiveTab} 
              />
            )}

            {/* Live Console tab */}
            {activeTab === "console" && (
              <ConsoleView 
                bots={bots} 
                selectedBotId={selectedBotId} 
                setSelectedBotId={setSelectedBotId} 
                socket={socket} 
              />
            )}

            {/* File Manager Tab */}
            {activeTab === "filemanager" && (
              <FileManager />
            )}

            {/* Historical System Logs Browser Tab */}
            {activeTab === "logs" && (
              <div className="space-y-6 animate-fade-in">
                {/* Logs controller panel */}
                <div className="p-5 bg-slate-900/20 border border-slate-800/60 rounded-2xl flex flex-col gap-4 backdrop-blur-md">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-wide">
                        Historical Stream Logs
                      </h2>
                      <p className="text-xs text-slate-400">
                        Historical system operations and parsed bot message logs.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <button
                        onClick={handleClearLogs}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition font-mono text-xs font-bold"
                      >
                        <Trash2 size={13} />
                        <span>CLEAR RECORD</span>
                      </button>
                      <button
                        onClick={handleDownloadLogs}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 transition font-mono text-xs font-bold"
                      >
                        <Download size={13} />
                        <span>DOWNLOAD CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter controls row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="relative flex items-center col-span-1 sm:col-span-2">
                      <Search className="absolute left-3.5 text-slate-500" size={14} />
                      <input
                        type="text"
                        value={logSearchQuery}
                        onChange={(e) => setLogSearchQuery(e.target.value)}
                        placeholder="Search operation messages..."
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-9.5 pr-4 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>

                    <div>
                      <select
                        value={logBotFilter}
                        onChange={(e) => setLogBotFilter(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="">-- Filter by Bot --</option>
                        <option value="sys-init">System Events Only</option>
                        {bots.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={logTypeFilter}
                        onChange={(e) => setLogTypeFilter(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="">-- Filter by Type --</option>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Logs Listing Viewer */}
                <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 h-[450px] overflow-y-auto space-y-3.5 scrollbar-thin">
                  {logs.length > 0 ? (
                    logs.map((log) => {
                      const logBot = bots.find((b) => b.id === log.botId);
                      const isError = log.type === "error";
                      const isWarn = log.type === "warning";
                      const isSuccess = log.type === "success";

                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 text-xs leading-relaxed font-mono border-b border-slate-900/60 pb-3"
                        >
                          {/* Log Icon */}
                          <div className={`mt-0.5 shrink-0 p-1 rounded-md ${
                            isError ? "bg-rose-500/10 text-rose-400" :
                            isWarn ? "bg-amber-500/10 text-amber-400" :
                            isSuccess ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-900 text-cyan-400"
                          }`}>
                            {isError && <ShieldAlert size={12} />}
                            {isWarn && <AlertCircle size={12} />}
                            {isSuccess && <CheckCircle2 size={12} />}
                            {log.type === "info" && <Info size={12} />}
                          </div>

                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 text-[9px] text-slate-500">
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                              <span className="text-slate-700">•</span>
                              <span className="text-cyan-400 font-bold">
                                {logBot ? `BOT: [${logBot.name}]` : "SYSTEM"}
                              </span>
                            </div>
                            <p className="text-slate-300 break-words">{log.message}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-center text-slate-600">
                      <FileText size={28} className="mb-2" />
                      <p className="text-xs font-mono uppercase">No logs indexed</p>
                      <p className="text-[10px] mt-0.5">Try altering the filter query keywords above.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modules Tab */}
            {activeTab === "modules" && (
              <div className="space-y-6 animate-fade-in">
                {/* Modules Action Panel */}
                <div className="flex justify-between items-center bg-slate-900/20 p-5 rounded-2xl border border-slate-800/60 backdrop-blur-md">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">
                      Global Module System
                    </h2>
                    <p className="text-xs text-slate-400">
                      Discovered features automatically loaded by the Core Engine across all running bots.
                    </p>
                  </div>

                  <button
                    onClick={handleTriggerHotReload}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-mono text-xs font-bold text-slate-950 hover:shadow-lg transition duration-200"
                  >
                    <RefreshCw size={14} />
                    <span>HOT RELOAD SCANNED MODULES</span>
                  </button>
                </div>

                {/* Modules grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {modules.map((mod) => (
                    <div
                      key={mod.id}
                      className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-slate-700/60 transition duration-300"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-850 border border-slate-800 rounded-xl text-cyan-400">
                            <Layers size={18} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white font-mono tracking-wide">
                              {mod.name}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-mono">
                              id: {mod.id} • v{mod.version}
                            </p>
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <button
                          onClick={() => handleToggleModule(mod.id, mod.enabled)}
                          className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                            mod.enabled ? "bg-cyan-500" : "bg-slate-950 border border-slate-800"
                          }`}
                        >
                          <div className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            mod.enabled ? "translate-x-4 bg-slate-950" : "translate-x-0 bg-slate-600"
                          }`} />
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed mb-6 h-12 overflow-hidden">
                        {mod.description}
                      </p>

                      <div className="border-t border-slate-900/80 pt-4 flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>COMMANDS RECOGNIZED:</span>
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-900 text-slate-400 font-bold">
                          {mod.commands ? mod.commands.length : 3}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Monitor detailed statistics tab */}
            {activeTab === "monitor" && (
              <div className="space-y-6 animate-fade-in">
                {/* Visual gauge cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* CPU load */}
                  <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between h-44">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] text-slate-500 font-mono tracking-wider font-bold">CPU ALLOC LIMIT</span>
                      <Cpu size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold font-mono text-white">{systemStats?.cpu || 0}%</h4>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-3">
                        <div 
                          className="h-full bg-cyan-400 transition-all duration-500"
                          style={{ width: `${systemStats?.cpu || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* RAM usage */}
                  <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between h-44">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] text-slate-500 font-mono tracking-wider font-bold">RAM WORKSPACE</span>
                      <HardDrive size={16} className="text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold font-mono text-white">
                        {systemStats?.ram ? `${systemStats.ram.used} / ${systemStats.ram.total} MB` : "-"}
                      </h4>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-3">
                        <div 
                          className="h-full bg-emerald-400 transition-all duration-500"
                          style={{ 
                            width: `${systemStats?.ram ? Math.round((systemStats.ram.used / systemStats.ram.total) * 100) : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Disk size */}
                  <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between h-44">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] text-slate-500 font-mono tracking-wider font-bold">DISK STORAGE</span>
                      <Database size={16} className="text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold font-mono text-white">
                        {systemStats?.disk ? `${systemStats.disk.used} / ${systemStats.disk.total} GB` : "-"}
                      </h4>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-3">
                        <div 
                          className="h-full bg-purple-400 transition-all duration-500"
                          style={{ 
                            width: `${systemStats?.disk ? Math.round((systemStats.disk.used / systemStats.disk.total) * 100) : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Processes List */}
                <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md">
                  <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase mb-4 flex items-center gap-2">
                    <Terminal size={16} className="text-cyan-400" />
                    Active Bot Daemon Processes
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500">
                          <th className="py-3 font-semibold">DAEMON NAME</th>
                          <th className="py-3 font-semibold">PID STATUS</th>
                          <th className="py-3 font-semibold">CPU METRIC</th>
                          <th className="py-3 font-semibold">RAM ALLOC</th>
                          <th className="py-3 font-semibold">STATE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60">
                        {bots.map((b) => (
                          <tr key={b.id} className="text-slate-300">
                            <td className="py-3.5 font-bold">{b.name}</td>
                            <td className="py-3.5 text-slate-400">{b.pid || "offline"}</td>
                            <td className="py-3.5">{b.status === "running" ? `${b.cpu}%` : "0%"}</td>
                            <td className="py-3.5">{b.status === "running" ? `${b.ram} MB` : "0 MB"}</td>
                            <td className="py-3.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.status === "running" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-900 text-slate-500"
                              }`}>
                                {b.status === "running" ? "RUNNING" : "STOPPED"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Settings and Backups configuration Tab */}
            {activeTab === "settings" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                
                {/* Primary Panel Settings Form */}
                <form 
                  onSubmit={handleSaveSettings} 
                  className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-5 lg:col-span-2"
                >
                  <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase flex items-center gap-2 border-b border-slate-900 pb-3">
                    <Sliders size={16} className="text-cyan-400" />
                    System Daemon Settings
                  </h3>

                  {saveSettingsStatus === "success" && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                      <CheckCircle2 size={15} />
                      <span>Settings successfully committed to SQLite storage.</span>
                    </div>
                  )}

                  {saveSettingsStatus === "error" && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle size={15} />
                      <span>Failed to save configurations. Check system logs.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                        Bot Command Prefix:
                      </label>
                      <input
                        type="text"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                        Owner Telegram ID:
                      </label>
                      <input
                        type="text"
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                        Timezone:
                      </label>
                      <input
                        type="text"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                        Polling Interval (ms):
                      </label>
                      <input
                        type="number"
                        value={pollingInterval}
                        onChange={(e) => setPollingInterval(Number(e.target.value))}
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-900 rounded-xl">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 font-mono uppercase">
                        Auto Restart daemon
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Auto-reboot bot processes if a standard exit crash is encountered.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAutoRestart(!autoRestart)}
                      className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                        autoRestart ? "bg-cyan-500" : "bg-slate-900 border border-slate-800"
                      }`}
                    >
                      <div className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        autoRestart ? "translate-x-4 bg-slate-950" : "translate-x-0 bg-slate-600"
                      }`} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={saveSettingsStatus === "saving"}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-mono text-xs font-bold text-slate-950 hover:shadow-lg transition duration-200 flex justify-center items-center gap-2"
                  >
                    {saveSettingsStatus === "saving" && <RefreshCw size={12} className="animate-spin" />}
                    <span>SAVE PANEL SETTINGS</span>
                  </button>
                </form>

                {/* Import / Export & Presets Panel */}
                <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase flex items-center gap-2 border-b border-slate-900 pb-3">
                      <Database size={16} className="text-purple-400" />
                      Configuration Backups
                    </h3>

                    <p className="text-slate-400 text-xs leading-relaxed">
                      Download or restore your registered bot configs and panel settings using structured backups.
                    </p>

                    <button
                      onClick={handleExportConfig}
                      className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 font-mono text-xs text-slate-300 border border-slate-850 hover:text-white hover:shadow-lg transition duration-200 flex justify-center items-center gap-2"
                    >
                      <Download size={13} />
                      <span>EXPORT BACKUP JSON</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-900 pt-4 space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 font-mono uppercase">
                      Paste backup payload
                    </h4>

                    {importStatus && (
                      <div className="p-2.5 bg-slate-950 border border-slate-900 text-cyan-400 font-mono text-[10px] rounded-lg">
                        {importStatus}
                      </div>
                    )}

                    <textarea
                      value={importConfigRaw}
                      onChange={(e) => setImportConfigRaw(e.target.value)}
                      placeholder='Paste JSON config here {"bots": [], "settings": {}}...'
                      className="w-full h-24 text-[10px] bg-slate-950 border border-slate-850 text-slate-400 rounded-xl p-3.5 font-mono focus:outline-none focus:border-cyan-500/50 resize-none"
                    />

                    <button
                      onClick={handleImportConfig}
                      className="w-full py-2 rounded-xl bg-purple-500 hover:bg-purple-600 font-mono text-xs font-bold text-white hover:shadow-lg transition duration-200"
                    >
                      IMPORT BACKUP CONFIG
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* About Me tab */}
            {activeTab === "aboutme" && (
              <AboutMe />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
