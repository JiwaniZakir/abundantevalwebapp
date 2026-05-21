"use client";

import { useCallback, useEffect, useState } from "react";
import { Chat } from "@/components/workbench/chat";
import { CommandPalette } from "@/components/workbench/command-palette";
import { EnvBanner } from "@/components/workbench/env-banner";
import { FocusSurface } from "@/components/workbench/focus-surface";
import { NoticeStack } from "@/components/workbench/notice-stack";
import { PublishDialog } from "@/components/workbench/publish-dialog";
import { Sidebar } from "@/components/workbench/sidebar";
import { TaskPackDrawer } from "@/components/workbench/task-pack-drawer";
import { TopBar } from "@/components/workbench/top-bar";

export default function WorkbenchPage() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[var(--cream)]">
      <TopBar onOpenPalette={openPalette} />
      <EnvBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <FocusSurface />
        <Chat />
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <TaskPackDrawer />
      <PublishDialog />
      <NoticeStack />
    </div>
  );
}
