import { User, Mail, Globe, Terminal, Cpu, Layers, Zap, Heart, Shield, Award } from "lucide-react";

export default function AboutMe() {
  const skills = [
    { name: "React / Vite", level: "Expert", progress: 95, color: "text-cyan-400 bg-cyan-400/10" },
    { name: "Node.js / Express", level: "Expert", progress: 90, color: "text-emerald-400 bg-emerald-400/10" },
    { name: "Socket.io (Realtime)", level: "Advanced", progress: 85, color: "text-purple-400 bg-purple-400/10" },
    { name: "Tailwind CSS", level: "Expert", progress: 95, color: "text-cyan-400 bg-cyan-400/10" },
    { name: "Linux / Termux Daemonry", level: "Advanced", progress: 88, color: "text-amber-400 bg-amber-400/10" },
    { name: "Gemini AI Suite Integration", level: "Expert", progress: 92, color: "text-blue-400 bg-blue-400/10" },
  ];

  const highlights = [
    {
      icon: <Cpu className="text-cyan-400" size={20} />,
      title: "System Automation",
      desc: "Architecting high-performance backends and background daemons with robust crash recoveries and minimal memory overhead.",
    },
    {
      icon: <Layers className="text-emerald-400" size={20} />,
      title: "Modular Integration",
      desc: "Designed NellsPanels' plugin engine, allowing fast hot-reloads of media downloader, AI suites, and group moderator modules.",
    },
    {
      icon: <Shield className="text-purple-400" size={20} />,
      title: "Enterprise Security",
      desc: "Crafted robust authentication filters, anti-spam shields, link-blockers, and clean rate-limiting schemas.",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Premium Hero Section */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-tr from-cyan-500/15 via-blue-600/5 to-transparent border border-slate-800/80 backdrop-blur-md relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full filter blur-[100px] opacity-20 bg-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 left-12 w-48 h-48 rounded-full filter blur-[80px] opacity-10 bg-purple-500 pointer-events-none" />

        {/* Creator Avatar / Initials Circle */}
        <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 relative group overflow-hidden shrink-0 border border-cyan-300/20">
          <span className="text-4xl font-extrabold text-slate-950 tracking-wider select-none font-mono">
            CD
          </span>
          <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Heart className="text-white fill-white animate-pulse" size={20} />
          </div>
        </div>

        <div className="space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            <Award size={12} />
            Lead Core Developer
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Cristian Dwi Hariantoro
          </h2>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Developer and systems designer of <span className="text-cyan-300 font-semibold font-mono">NellsPanels</span>.
            I specialize in crafting advanced, robust system control panels, real-time daemon orchestration, and beautifully polished full-stack user interfaces that operate with flawless micro-second precision.
          </p>

          <div className="flex flex-wrap gap-4 pt-2 justify-center md:justify-start">
            <a 
              href="mailto:cristiandwihariantoro@gmail.com" 
              className="flex items-center gap-2 text-xs font-mono text-slate-300 hover:text-cyan-400 transition"
            >
              <Mail size={14} className="text-cyan-400" />
              <span>cristiandwihariantoro@gmail.com</span>
            </a>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Globe size={14} className="text-slate-500" />
              <span>Jakarta, Indonesia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid with Skills and Project Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* NellsPanels Brand Concept */}
        <div className="lg:col-span-2 p-6 md:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase flex items-center gap-2 border-b border-slate-900 pb-3">
              <Terminal size={16} className="text-cyan-400" />
              About NellsPanels Philosophy
            </h3>
            
            <p className="text-slate-300 text-sm leading-relaxed">
              <span className="text-cyan-400 font-semibold font-mono">NellsPanels</span> was born out of a desire for extreme resource-efficiency and comprehensive modular control. It converts standard devices—such as minimal virtual servers, embedded Raspberry Pi arrays, or portable local environments like <span className="text-cyan-300 font-medium">Termux on Android</span>—into high-capability Telegram bot management powerhouses.
            </p>

            <p className="text-slate-400 text-xs leading-relaxed">
              Every design component and visual indicator inside NellsPanels is optimized using a sleek cyberpunk glassmorphism layout, featuring real-time telemetry streaming over robust WebSocket ports and detailed flat-file database logging.
            </p>
          </div>

          {/* Highlights Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-900">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-mono block">PLATFORM STACK:</span>
              <span className="text-slate-200 block text-xs font-semibold">NodeJS + React 18</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-mono block">MESSAGE PROTOCOL:</span>
              <span className="text-slate-200 block text-xs font-semibold">WebSocket (Socket.io)</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-mono block">MODULAR ENGINES:</span>
              <span className="text-slate-200 block text-xs font-semibold">Hot-Swappable Runtimes</span>
            </div>
          </div>
        </div>

        {/* Technical Competencies Progress Bars */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-5">
          <h3 className="text-sm font-bold text-white font-mono tracking-wide uppercase flex items-center gap-2 border-b border-slate-900 pb-3">
            <Zap size={16} className="text-purple-400" />
            Core Competencies
          </h3>

          <div className="space-y-4">
            {skills.map((skill) => (
              <div key={skill.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300">{skill.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${skill.color}`}>
                    {skill.level}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000"
                    style={{ width: `${skill.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Core Highlights Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {highlights.map((item, idx) => (
          <div 
            key={idx}
            className="p-6 rounded-2xl bg-slate-900/20 border border-slate-850 hover:border-slate-800 transition duration-300 space-y-3"
          >
            <div className="p-2.5 w-fit rounded-xl bg-slate-950 border border-slate-900 shadow-inner">
              {item.icon}
            </div>
            <h4 className="text-sm font-bold text-slate-200 font-mono">
              {item.title}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Simple Interactive Contact Card */}
      <div className="p-6 md:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md relative overflow-hidden text-center max-w-2xl mx-auto space-y-4">
        <h3 className="text-lg font-extrabold text-white">Let's Connect and Build Together!</h3>
        <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
          Need custom bot features, advanced automation scripts, or dedicated daemon control servers? Get in touch directly via my email channel.
        </p>
        <div className="pt-2">
          <a
            href="mailto:cristiandwihariantoro@gmail.com"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-mono text-xs font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 transition duration-200"
          >
            <Mail size={14} />
            <span>CONTACT VIA EMAIL</span>
          </a>
        </div>
      </div>
    </div>
  );
}
