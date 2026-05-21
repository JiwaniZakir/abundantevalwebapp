"use client";

import { useCallback, useEffect, useState } from "react";
import { Chat } from "@/components/workbench/chat";
import { CommandPalette } from "@/components/workbench/command-palette";
import { FileExplorer } from "@/components/workbench/file-explorer";
import { AgentPanel } from "@/components/workbench/agent-panel";
import { LiveSetupBanner } from "@/components/workbench/live-setup-banner";
import { NoticeStack } from "@/components/workbench/notice-stack";
import { PublishDialog } from "@/components/workbench/publish-dialog";
import { TopBar } from "@/components/workbench/top-bar";
import { useWorkbench } from "@/lib/workbench/store";

export default function WorkbenchPage() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const setFocus = useWorkbench((s) => s.setFocus);
  const hydrateFromSnapshot = useWorkbench((s) => s.hydrateFromSnapshot);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.latest?.snapshot) return;
        hydrateFromSnapshot(data.latest.snapshot, data.latest.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrateFromSnapshot]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (mod && key === "b") {
        event.preventDefault();
        setLeftOpen((v) => !v);
      }
      if (mod && key === "j") {
        event.preventDefault();
        requestAnimationFrame(() => {
          document.querySelector<HTMLTextAreaElement>("#chat-composer")?.focus();
        });
      }
      if (mod && key === "\\") {
        event.preventDefault();
        setRightOpen((v) => !v);
      }
      if (mod && key === "e") {
        event.preventDefault();
        setFocus({ kind: "none" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setFocus]);

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)]">
      <TopBar
        onOpenPalette={openPalette}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
      />
      <LiveSetupBanner />
      <div className="flex min-h-0 flex-1">
        {leftOpen && <FileExplorer />}
        <Chat />
        {rightOpen && <AgentPanel />}
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <PublishDialog />
      <NoticeStack />
    </div>
  );
}
