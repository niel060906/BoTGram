import { useState, useEffect, useRef } from "react";
import { 
  Folder, 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  Edit, 
  FilePlus, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown, 
  ArrowLeft,
  X,
  FileCode
} from "lucide-react";
import { FileItem } from "../types";
import axios from "axios";

export default function FileManager() {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["bots", "modules"]));
  const [loading, setLoading] = useState<boolean>(false);

  // Modals / Action States
  const [newItemModal, setNewItemModal] = useState<{ isOpen: boolean; isDir: boolean; parentPath: string }>({
    isOpen: false,
    isDir: false,
    parentPath: "",
  });
  const [newItemName, setNewItemName] = useState("");

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Fetch file list
  const fetchFileTree = async () => {
    try {
      const res = await axios.get("/api/files");
      setFileTree(res.data);
    } catch (err) {
      console.error("Failed to fetch file tree", err);
    }
  };

  useEffect(() => {
    fetchFileTree();
  }, []);

  // Fetch file content
  const openFile = async (path: string) => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Discard and proceed?")) return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`/api/files/content?path=${encodeURIComponent(path)}`);
      setSelectedPath(path);
      setFileContent(res.data.content);
      setHasChanges(false);
      setSaveStatus("idle");
    } catch (err) {
      alert("Failed to read file content.");
    } finally {
      setLoading(false);
    }
  };

  // Save file content
  const saveFile = async () => {
    if (!selectedPath) return;
    setSaveStatus("saving");
    try {
      await axios.post("/api/files/save", {
        path: selectedPath,
        content: fileContent,
      });
      setSaveStatus("saved");
      setHasChanges(false);
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // Create new file or directory
  const handleCreateItem = async () => {
    if (!newItemName.trim()) return;
    const itemPath = newItemModal.parentPath 
      ? `${newItemModal.parentPath}/${newItemName.trim()}` 
      : newItemName.trim();

    try {
      await axios.post("/api/files/create", {
        path: itemPath,
        isDirectory: newItemModal.isDir,
      });
      fetchFileTree();
      setNewItemModal({ isOpen: false, isDir: false, parentPath: "" });
      setNewItemName("");
      // If it's a file, open it instantly
      if (!newItemModal.isDir) {
        openFile(itemPath);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create item.");
    }
  };

  // Delete file or directory
  const handleDeleteItem = async (pathToDelete: string) => {
    if (!confirm(`Are you sure you want to delete "${pathToDelete}"? This action is irreversible.`)) return;
    try {
      await axios.post("/api/files/delete", { path: pathToDelete });
      fetchFileTree();
      if (selectedPath === pathToDelete) {
        setSelectedPath("");
        setFileContent("");
        setHasChanges(false);
      }
    } catch (err) {
      alert("Failed to delete item.");
    }
  };

  const toggleFolder = (path: string) => {
    const updated = new Set(expandedFolders);
    if (updated.has(path)) {
      updated.delete(path);
    } else {
      updated.add(path);
    }
    setExpandedFolders(updated);
  };

  // Calculate lines for line number display
  const linesCount = fileContent.split("\n").length;
  const lineNumbersArray = Array.from({ length: linesCount }, (_, i) => i + 1);

  // Recursive render helper for the file explorer tree
  const renderTreeItem = (item: FileItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedPath === item.path;

    return (
      <div key={item.path} style={{ paddingLeft: `${depth * 10}px` }} className="space-y-0.5 select-none">
        <div className={`group flex items-center justify-between py-1 px-2 rounded-lg text-xs font-mono transition duration-200 cursor-pointer ${
          isSelected 
            ? "bg-cyan-500/10 text-cyan-300 font-medium" 
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
        }`}>
          <div 
            onClick={() => {
              if (item.isDirectory) {
                toggleFolder(item.path);
              } else {
                openFile(item.path);
              }
            }}
            className="flex-1 flex items-center gap-2 overflow-hidden"
          >
            {item.isDirectory ? (
              <>
                {isExpanded ? <ChevronDown size={14} className="text-slate-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                <Folder size={14} className="text-cyan-400 shrink-0" />
              </>
            ) : (
              <>
                <span className="w-3.5" /> {/* Align with chevron */}
                <FileText size={14} className="text-slate-400 shrink-0" />
              </>
            )}
            <span className="truncate">{item.name}</span>
          </div>

          {/* Quick Context Action Icons */}
          <div className="hidden group-hover:flex items-center gap-1.5 shrink-0 ml-2">
            {item.isDirectory && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewItemModal({ isOpen: true, isDir: false, parentPath: item.path });
                  }}
                  title="New File"
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition"
                >
                  <FilePlus size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewItemModal({ isOpen: true, isDir: true, parentPath: item.path });
                  }}
                  title="New Folder"
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 transition"
                >
                  <FolderPlus size={12} />
                </button>
              </>
            )}
            {/* Don't allow deleting base directories bots/ and modules/ */}
            {item.path !== "bots" && item.path !== "modules" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteItem(item.path);
                }}
                title="Delete"
                className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-rose-400 transition"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {item.isDirectory && isExpanded && item.children && (
          <div className="border-l border-slate-900 ml-3.5 mt-0.5 space-y-0.5">
            {item.children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full items-stretch">
      {/* File Explorer Tree Block (Left) */}
      <div className="w-full md:w-64 bg-slate-950/80 border border-slate-900 rounded-2xl flex flex-col backdrop-blur-md p-4 shrink-0 h-[300px] md:h-auto overflow-hidden">
        <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
          <h2 className="text-sm font-bold text-white tracking-wide font-mono flex items-center gap-2">
            <FileCode size={16} className="text-cyan-400" />
            WORKSPACE EXPLORER
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setNewItemModal({ isOpen: true, isDir: false, parentPath: "modules" })}
              title="Create Module"
              className="p-1 hover:bg-slate-900 border border-slate-900 hover:text-cyan-400 text-slate-400 rounded-lg transition"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
          {fileTree.map((item) => renderTreeItem(item))}
        </div>
      </div>

      {/* Code Editor Window (Right) */}
      <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col h-[500px] md:h-auto overflow-hidden shadow-2xl">
        {selectedPath ? (
          <>
            {/* Editor Action Header */}
            <div className="flex justify-between items-center px-5 py-3.5 bg-slate-900/60 border-b border-slate-900">
              <div className="overflow-hidden mr-4">
                <span className="text-[10px] font-mono text-cyan-400 block tracking-wider uppercase">
                  ACTIVE BUFFER
                </span>
                <span className="text-xs font-mono text-slate-200 truncate block">
                  /{selectedPath}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {saveStatus === "saving" && <span className="text-xs font-mono text-slate-500 animate-pulse">saving...</span>}
                {saveStatus === "saved" && <span className="text-xs font-mono text-emerald-400">Disk Sync Complete ✅</span>}
                {saveStatus === "error" && <span className="text-xs font-mono text-rose-400">Save Failed ❌</span>}
                {hasChanges && saveStatus === "idle" && (
                  <span className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    unsaved changes
                  </span>
                )}

                <button
                  onClick={saveFile}
                  disabled={saveStatus === "saving"}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-mono text-xs font-semibold text-slate-950 hover:shadow-lg transition"
                >
                  <Save size={13} />
                  <span>SAVE CHANGES</span>
                </button>
              </div>
            </div>

            {/* Editing Canvas with line numbers */}
            {loading ? (
              <div className="flex-1 flex justify-center items-center">
                <div className="text-sm font-mono text-slate-500 animate-pulse">
                  Streaming file chunks...
                </div>
              </div>
            ) : (
              <div className="flex-1 flex overflow-hidden relative">
                {/* Line numbers column */}
                <div className="w-11 bg-slate-950 border-r border-slate-900 text-right pr-2.5 py-4 font-mono text-xs text-slate-600 select-none">
                  {lineNumbersArray.map((num) => (
                    <div key={num} className="leading-6">
                      {num}
                    </div>
                  ))}
                </div>

                {/* Main input area */}
                <textarea
                  ref={editorRef}
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value);
                    setHasChanges(true);
                  }}
                  className="flex-1 bg-slate-950 p-4 border-none text-slate-300 font-mono text-xs leading-6 focus:outline-none focus:ring-0 resize-none overflow-auto"
                  style={{ whiteSpace: "pre" }}
                  placeholder="// Paste or write script logic here..."
                  spellCheck={false}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center p-12 text-center">
            <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl text-slate-500 mb-4">
              <FileText size={28} />
            </div>
            <h3 className="text-sm font-semibold text-slate-300 font-mono uppercase">
              No File Active
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Double-click or expand any folder tree item from the left explorer menu to load and edit active bot configurations or module structures.
            </p>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {newItemModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 relative shadow-2xl">
            <button
              onClick={() => setNewItemModal({ isOpen: false, isDir: false, parentPath: "" })}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-white tracking-wide font-mono uppercase mb-4">
              Create New {newItemModal.isDir ? "Folder" : "File"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                  Path Parent Location:
                </label>
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 font-mono text-xs text-slate-500 truncate">
                  /{newItemModal.parentPath || "root"}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block uppercase mb-1.5">
                  Name:
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={newItemModal.isDir ? "e.g., sessions" : "e.g., logger.ts"}
                  className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-cyan-500/50"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setNewItemModal({ isOpen: false, isDir: false, parentPath: "" })}
                  className="flex-1 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 font-mono text-xs text-slate-400 border border-slate-850 hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateItem}
                  className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 font-mono text-xs text-slate-950 font-bold hover:shadow-lg transition"
                >
                  CREATE ITEM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
