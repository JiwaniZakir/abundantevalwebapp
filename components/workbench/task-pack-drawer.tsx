"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  GitBranch,
  Search,
  X,
} from "lucide-react";
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
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      const isLeaf = index === segments.length - 1;
      const fullPath = segments.slice(0, index + 1).join("/");
      const existing = cursor.children.find((child) => child.name === segment);
      if (existing) {
        cursor = existing;
        continue;
      }
      const node: TreeNode = {
        name: segment,
        fullPath,
        isDir: !isLeaf,
        children: [],
      };
      cursor.children.push(node);
      cursor = node;
    }
  }

  const sortRecursive = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
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

function Branch({
  node,
  depth,
  onPick,
}: {
  node: TreeNode;
  depth: number;
  onPick: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);

  if (node.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-[var(--ink-muted)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span>{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <Branch
                key={child.fullPath}
                node={child}
                depth={depth + 1}
                onPick={onPick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPick(node.fullPath)}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-[var(--ink-soft)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
      style={{ paddingLeft: `${depth * 12 + 18}px` }}
    >
      <FileIcon name={node.name} className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function TaskPackDrawer() {
  const open = useWorkbench((s) => s.taskPackOpen);

  return (
    <AnimatePresence>{open && <DrawerContents />}</AnimatePresence>
  );
}

function DrawerContents() {
  const setOpen = useWorkbench((s) => s.setTaskPackOpen);
  const workspace = useWorkbench((s) => s.workspace);
  const recent = useWorkbench((s) => s.recentArtifacts);
  const openArtifact = useWorkbench((s) => s.openArtifact);
  const [query, setQuery] = useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setOpen]);

  const paths = useMemo(
    () => Object.keys(workspace.artifacts).sort((a, b) => a.localeCompare(b)),
    [workspace.artifacts],
  );

  const filteredPaths = useMemo(() => {
    if (!query.trim()) return paths;
    const lower = query.toLowerCase();
    return paths.filter((path) => path.toLowerCase().includes(lower));
  }, [paths, query]);

  const tree = useMemo(() => buildTree(filteredPaths), [filteredPaths]);

  return (
    <motion.div
      key="drawer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-40 bg-[rgba(20,20,20,0.28)] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <motion.div
        key="drawer"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Task pack browser"
        initial={{ x: -32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -32, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="absolute inset-y-0 left-0 flex w-[360px] flex-col border-r border-[var(--hairline-strong)] bg-[var(--cream)] shadow-[var(--shadow-pop)]"
        onClick={(event) => event.stopPropagation()}
      >
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
              <div>
                <p className="eyebrow">Task pack</p>
                <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.01em]">
                  {paths.length} artifacts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-[var(--hairline)] px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--paper-pure)] px-3 py-2">
                <Search className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a file…"
                  className="w-full bg-transparent text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
                />
              </div>
            </div>

            {recent.length > 0 && (
              <div className="border-b border-[var(--hairline)] px-5 py-3">
                <p className="eyebrow mb-2">Recent</p>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((path) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => openArtifact(path)}
                      className={cn(
                        "mono rounded-full border border-[var(--hairline)] bg-[var(--paper-pure)] px-2.5 py-1 text-[10.5px] text-[var(--ink-muted)] hover:bg-[var(--cream-soft)] hover:text-[var(--ink)]",
                      )}
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </div>
            )}

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {filteredPaths.length === 0 ? (
            <p className="px-2 text-[12px] text-[var(--ink-muted)]">
              No artifacts match “{query}”.
            </p>
          ) : (
            tree.children.map((child) => (
              <Branch
                key={child.fullPath}
                node={child}
                depth={0}
                onPick={openArtifact}
              />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
