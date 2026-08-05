import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: ReactNode;
  progress?: number; // 0 to 100
  color?: "cyan" | "emerald" | "amber" | "rose" | "purple";
}

export default function MetricCard({ title, value, subtext, icon, progress, color = "cyan" }: MetricCardProps) {
  const colorMap = {
    cyan: {
      border: "border-cyan-500/10",
      bg: "from-cyan-500/10 to-transparent",
      text: "text-cyan-400",
      bar: "bg-cyan-500",
      icon: "bg-cyan-500/10 text-cyan-400",
    },
    emerald: {
      border: "border-emerald-500/10",
      bg: "from-emerald-500/10 to-transparent",
      text: "text-emerald-400",
      bar: "bg-emerald-500",
      icon: "bg-emerald-500/10 text-emerald-400",
    },
    amber: {
      border: "border-amber-500/10",
      bg: "from-amber-500/10 to-transparent",
      text: "text-amber-400",
      bar: "bg-amber-500",
      icon: "bg-amber-500/10 text-amber-400",
    },
    rose: {
      border: "border-rose-500/10",
      bg: "from-rose-500/10 to-transparent",
      text: "text-rose-400",
      bar: "bg-rose-500",
      icon: "bg-rose-500/10 text-rose-400",
    },
    purple: {
      border: "border-purple-500/10",
      bg: "from-purple-500/10 to-transparent",
      text: "text-purple-400",
      bar: "bg-purple-500",
      icon: "bg-purple-500/10 text-purple-400",
    },
  };

  const scheme = colorMap[color];

  return (
    <div className={`p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md relative overflow-hidden group hover:border-slate-700/60 transition duration-300 flex flex-col justify-between h-36`}>
      {/* Dynamic Glow Effect */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-10 bg-gradient-to-br ${scheme.bg}`} />

      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-medium text-slate-400 font-mono tracking-wide uppercase">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-white mt-1.5 font-mono tracking-tight">
            {value}
          </h3>
        </div>
        <div className={`p-2.5 rounded-xl ${scheme.icon} shadow-inner`}>
          {icon}
        </div>
      </div>

      <div>
        {progress !== undefined ? (
          <div className="mt-3">
            <div className="w-full bg-slate-800/80 h-1 rounded-full overflow-hidden">
              <div 
                className={`h-full ${scheme.bar} transition-all duration-500`} 
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1 text-[10px] font-mono text-slate-500">
              <span>USAGE</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        ) : (
          subtext && (
            <p className="text-xs text-slate-400 mt-2 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
              {subtext}
            </p>
          )
        )}
      </div>
    </div>
  );
}
