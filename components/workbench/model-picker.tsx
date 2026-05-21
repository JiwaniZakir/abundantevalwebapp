"use client";

import { modelRegistry } from "@/lib/ai/providers";
import { useWorkbench } from "@/lib/workbench/store";

export function ModelPicker() {
  const targetModel = useWorkbench((s) => s.workspace.targetModel);
  const setTargetModel = useWorkbench((s) => s.setTargetModel);
  const envStatus = useWorkbench((s) => s.envStatus);

  return (
    <select
      value={targetModel}
      onChange={(e) => {
        const entry = modelRegistry.find((m) => m.modelSlug === e.target.value);
        if (entry) setTargetModel(entry.modelSlug, entry.runner);
      }}
      className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-caption text-[var(--fg-secondary)]"
      title="Target model for probes and sweeps"
    >
      {modelRegistry.map((m) => {
        const enabled =
          !envStatus ||
          (m.provider === "google" && envStatus.google) ||
          (m.provider === "anthropic" && envStatus.anthropic) ||
          (m.provider === "openai" && envStatus.openai);
        return (
          <option key={m.modelSlug} value={m.modelSlug} disabled={!enabled}>
            {m.label}
          </option>
        );
      })}
    </select>
  );
}
