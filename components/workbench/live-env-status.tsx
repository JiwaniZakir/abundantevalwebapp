"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";
import { cn } from "@/lib/utils";

export function LiveEnvStatus() {
  const envStatus = useWorkbench((s) => s.envStatus);
  const setEnvStatus = useWorkbench((s) => s.setEnvStatus);

  useEffect(() => {
    if (envStatus) return;
    let cancelled = false;
    void fetch("/api/env/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setEnvStatus(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [envStatus, setEnvStatus]);

  if (!envStatus) {
    return (
      <span className="text-[12px] text-[var(--fg-muted)] px-2">Checking env…</span>
    );
  }

  const llmOk = envStatus.anthropic || envStatus.openai || envStatus.google;
  const registryOk = envStatus.harborBin && envStatus.harborAuth && Boolean(envStatus.harborPublishOrg);
  const publishOk = registryOk || (envStatus.ghCli && envStatus.publishTarget !== "registry");

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium",
        llmOk
          ? "bg-[var(--green-soft)] text-[var(--green)]"
          : "bg-[var(--amber-soft)] text-[var(--amber)]",
      )}
      title={
        llmOk
          ? `LLM ready · Harbor ${envStatus.harborBin ? "ok" : "missing"} · auth ${envStatus.harborAuth ? "ok" : "needed"} · org ${envStatus.harborPublishOrg ?? "unset"}`
          : "Add an API key to .env.local and restart npm run dev"
      }
    >
      {llmOk ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{llmOk ? "Live" : "Setup keys"}</span>
      {llmOk && !publishOk && (
        <span className="text-[10px] opacity-70 font-normal">· publish setup</span>
      )}
    </div>
  );
}
