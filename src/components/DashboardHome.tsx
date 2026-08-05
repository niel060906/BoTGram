import { useEffect, useState } from "react";
import { 
  Bot, 
  Cpu, 
  HardDrive, 
  Layers, 
  Terminal, 
  Zap, 
  Activity, 
  Compass, 
  Workflow 
} from "lucide-react";
import MetricCard from "./MetricCard";
import { BotConfig, SystemStats } from "../types";

interface DashboardHomeProps {
  bots: BotConfig[];
  stats: SystemStats | null;
  moduleCount: number;
  setActiveTab: (tab: string) => void;
}

export default function DashboardHome({ bots, stats, moduleCount, setActiveTab }: DashboardHomeProps) {
  const [cpuHistory, setCpuHistory] = useState<number[]>([12, 18, 15, 25, 30, 22, 19, 28, 25, 30]);
  const [ramHistory, setRamHistory] = useState<number[]>([42, 45, 48, 50, 48, 52, 55, 50, 53, 55]);

  // Keep a running buffer of stats to feed our real-time SVG graphs
  useEffect(() => {
    if (!stats) return;
    
    setCpuHistory((prev) => {
      const next = [...prev.slice(1), stats.cpu];
      return next;
    });

    if (stats.ram && stats.ram.total) {
      const pct = Math.round((stats.ram.used / stats.ram.total) * 100);
      setRamHistory((prev) => {
        const next = [...prev.slice(1), pct];
        return next;
      });
    }
  }, [stats]);

  const runningCount = bots.filter((b) => b.status === "running").length;
  const offlineCount = bots.length - runningCount;

  // Render SVG charts
  const generateSvgPath = (data: number[], max: number = 100): string => {
    if (data.length === 0) return "";
    const width = 500;
    const height = 120;
    const padding = 10;
    
    const step = width / (data.length - 1);
    const points = data.map((val, i) => {
      const x = i * step;
      // invert scale
      const y = height - padding - ((val / max) * (height - padding * 2));
      return `${x},${y}`;
    });
    
    return `M ${points.join(" L ")}`;
  };

  const generateSvgAreaPath = (data: number[], max: number = 100): string => {
    const path = generateSvgPath(data, max);
    if (!path) return "";
    const width = 500;
    const height = 120;
    return `${path} L 500,${height} L 0,${height} Z`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome Panel */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-tr from-cyan-500/10 via-blue-600/5 to-transparent border border-slate-800/80 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs tracking-wider font-bold uppercase">
            <Zap size={14} className="animate-pulse" />
            NELLSPANELS CORE DAEMON ONLINE
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            NellsPanels Management Suite
          </h2>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Welcome back! Monitor and manage your Telegram bots' isolated processes on our optimized core network with NellsPanels. Update modules globally with a single click.
          </p>
        </div>

        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => setActiveTab("bots")}
            className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono text-xs font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 transition duration-200"
          >
            MANAGE BOTS
          </button>
          <button
            onClick={() => setActiveTab("filemanager")}
            className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-300 font-mono text-xs font-bold border border-slate-800 hover:text-white transition duration-200"
          >
            FILE MANAGER
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total bots"
          value={bots.length}
          subtext="Configured instances"
          color="cyan"
          icon={<Bot size={20} />}
        />
        <MetricCard
          title="Bots Running"
          value={runningCount}
          subtext={`${runningCount} process active`}
          color="emerald"
          icon={<Zap size={20} />}
        />
        <MetricCard
          title="Bots Offline"
          value={offlineCount}
          subtext={`${offlineCount} stand-by`}
          color="amber"
          icon={<Compass size={20} />}
        />
        <MetricCard
          title="Global Modules"
          value={moduleCount}
          subtext="Hot-reloaded plugins"
          color="purple"
          icon={<Layers size={20} />}
        />
      </div>

      {/* Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU graph */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <Cpu className="text-cyan-400" size={18} />
              <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase">
                Realtime CPU Load
              </h3>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold">
              {stats?.cpu || 0}%
            </span>
          </div>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-900 relative">
            <svg 
              viewBox="0 0 500 120" 
              className="w-full h-32 overflow-visible" 
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="#0f172a" strokeWidth="1" />

              {/* Glowing fill */}
              <path d={generateSvgAreaPath(cpuHistory, 100)} fill="url(#cpuGrad)" />
              {/* Solid path line */}
              <path 
                d={generateSvgPath(cpuHistory, 100)} 
                fill="none" 
                stroke="#22d3ee" 
                strokeWidth="2.5" 
                className="transition-all duration-300"
              />
            </svg>
          </div>
        </div>

        {/* RAM graph */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <HardDrive className="text-emerald-400" size={18} />
              <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase">
                Realtime RAM Memory Load
              </h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {stats?.ram ? Math.round((stats.ram.used / stats.ram.total) * 100) : 0}%
            </span>
          </div>

          <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-900 relative">
            <svg 
              viewBox="0 0 500 120" 
              className="w-full h-32 overflow-visible" 
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="60" x2="500" y2="60" stroke="#0f172a" strokeWidth="1" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="#0f172a" strokeWidth="1" />

              {/* Glowing fill */}
              <path d={generateSvgAreaPath(ramHistory, 100)} fill="url(#ramGrad)" />
              {/* Solid path line */}
              <path 
                d={generateSvgPath(ramHistory, 100)} 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="2.5" 
                className="transition-all duration-300"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* System info details row */}
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md">
        <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase mb-4 flex items-center gap-2">
          <Workflow size={16} className="text-purple-400" />
          System Daemon Specification
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] block">NODE RUNTIME:</span>
            <span className="text-slate-200 block font-semibold">{stats?.nodeVersion || "-"}</span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] block">PLATFORM ENGINE:</span>
            <span className="text-slate-200 block font-semibold">{stats?.platform || "Linux Termux"}</span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] block">ACTIVE PROCESSES:</span>
            <span className="text-slate-200 block font-semibold">{runningCount} Bots / {stats?.activeProcesses || 1} Total</span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 text-[10px] block">DAEMON UPTIME:</span>
            <span className="text-slate-200 block font-semibold">
              {stats?.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
