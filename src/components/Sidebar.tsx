import { 
  LayoutDashboard, 
  Bot, 
  Terminal, 
  FileText, 
  Folder, 
  Layers, 
  Settings, 
  Activity,
  Menu,
  X
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "bots", label: "Bots Manager", icon: Bot },
    { id: "console", label: "Live Console", icon: Terminal },
    { id: "logs", label: "System Logs", icon: FileText },
    { id: "filemanager", label: "File Manager", icon: Folder },
    { id: "modules", label: "Modules Manager", icon: Layers },
    { id: "monitor", label: "System Monitor", icon: Activity },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 backdrop-blur-md hover:bg-slate-800 transition"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 z-40 bg-slate-950/80 border-r border-slate-900 backdrop-blur-xl flex flex-col justify-between p-6 transition-transform duration-300 md:transform-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo & Brand Header */}
          <div className="flex items-center gap-3 mb-10 mt-2">
            <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/10">
              <Bot className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-wide text-white font-mono uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Termux Bot Panel
              </h1>
              <p className="text-[10px] text-cyan-400 font-mono tracking-wider font-semibold">
                DAEMON CORE v1.0.0
              </p>
            </div>
          </div>

          {/* Nav Menu Links */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition duration-200 group relative ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/5 border-l-2 border-cyan-400 text-cyan-300"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                  }`}
                >
                  <Icon 
                    size={18} 
                    className={isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200 transition-colors"} 
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-900">
          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-mono">HOST: TERMUX-LOCAL</span>
          </div>
          <p className="text-[10px] text-slate-600 font-mono mt-1">
            Build: Production Ready
          </p>
        </div>
      </aside>
    </>
  );
}
