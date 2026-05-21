"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, FileText, GitBranch, Search } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

type TreeNode = {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
};

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", fullPath: "", isDir: true, children: [] };
  for (const path of paths) {
    const segments = path.split("/");
    let cursor = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLeaf = i === segments.length - 1;
      const fullPath = segments.slice(0, i + 1).join("/");
      const existing = cursor.children.find((c) => c.name === segment);
      if (existing) { cursor = existing; continue; }
      const node: TreeNode = { name: segment, fullPath, isDir: !isLeaf, children: [] };
      cursor.children.push(node);
      cursor = node;
    }
  }
  const sortRecursive = (node: TreeNode) => {
    node.children.sort((a, b) => { if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; return a.name.localeCompare(b.name); });
    node.children.forEach(sortRecursive);
  };
  sortRecursive(root);
  return root;
}

function FileIcon({ name, className }: { name: string; className?: string }) {
  if (name.endsWith(".md")) return <FileText className={className} />;
  if (name.endsWith(".diff")) return <GitBranch className={className} />;
  return <FileCode2 className={className} />;
}

function Branch({ node, depth, onPick, activePath }: { node: TreeNode; depth: number; onPick: (path: string) => void; activePath: string | null }) {
  const [open, setOpen] = useState(true);

  if (node.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-[5px] text-[12px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {open ? <ChevronDown className="h-3 w-3 shrink-0 opacity-50" /> : <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open && node.children.map((child) => <Branch key={child.fullPath} node={child} depth={depth + 1} onPick={onPick} activePath={activePath} />)}
      </div>
    );
  }

  const isActive = node.fullPath === activePath;

  return (
    <button
      type="button"
      onClick={() => onPick(node.fullPath)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[12px] transition-colors",
        isActive
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]",
      )}
      style={{ paddingLeft: `${depth * 14 + 22}px` }}
    >
      <FileIcon name={node.name} className={cn("h-3 w-3 shrink-0", isActive ? "opacity-70" : "opacity-40")} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileExplorer() {
  const workspace = useWorkbench((s) => s.workspace);
  const openArtifact = useWorkbench((s) => s.openArtifact);
  const focus = useWorkbench((s) => s.focus);
  const [query, setQuery] = useState("");

  const paths = useMemo(() => Object.keys(workspace.artifacts).sort(), [workspace.artifacts]);
  const filteredPaths = useMemo(() => {
    if (!query.trim()) return paths;
    const lower = query.toLowerCase();
    return paths.filter((p) => p.toLowerCase().includes(lower));
  }, [paths, query]);
  const tree = useMemo(() => buildTree(filteredPaths), [filteredPaths]);
  const activePath = focus.kind === "artifact" ? focus.path : null;

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-hover)] px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-[var(--fg-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-[var(--fg-faint)]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filteredPaths.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--fg-faint)]">No files match "{query}"</p>
        ) : (
          tree.children.map((child) => <Branch key={child.fullPath} node={child} depth={0} onPick={openArtifact} activePath={activePath} />)
        )}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-2.5">
        <p className="text-[11px] text-[var(--fg-faint)]">{paths.length} files</p>
      </div>
    </aside>
  );
}
