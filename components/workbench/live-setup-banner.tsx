"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useWorkbench } from "@/lib/workbench/store";

export function LiveSetupBanner() {
  const envStatus = useWorkbench((s) => s.envStatus);
  const setEnvStatus = useWorkbench((s) => s.setEnvStatus);
  const [dismissed, setDismissed] = useState(false);

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

  const llmOk =
    envStatus !== null &&
    (envStatus.anthropic || envStatus.openai || envStatus.google);

  if (dismissed || llmOk || !envStatus) return null;

  const missing: string[] = [];
  const onVercel =
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".vercel.app") ||
      window.location.hostname.includes("vercel.app"));

  if (!envStatus.anthropic && !envStatus.openai && !envStatus.google) {
    missing.push(
      onVercel
        ? "ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in Vercel Environment Variables"
        : "ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in .env.local",
    );
  }
  if (!envStatus.harborBin && !onVercel) {
    missing.push(`\`${envStatus.harborBinName ?? "harbor"}\` on PATH (or set HARBOR_BIN)`);
  }
  if (!envStatus.ghCli && !onVercel) {
    missing.push("`gh` CLI on PATH");
  } else if (!onVercel) {
    missing.push("run `gh auth login` if publish fails (token may be expired)");
  }
  if (onVercel && !envStatus.harborBin) {
    missing.push("Harbor CLI and Docker are not available on Vercel — run sweeps/publish locally");
  }

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--amber-soft)] px-4 py-2.5">
      <div className="mx-auto flex max-w-[1200px] items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber)]" />
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-[var(--fg-secondary)]">
          <p className="font-medium text-[var(--fg)]">Live mode needs configuration</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
            {onVercel ? (
              <>
                Open Vercel → Project → Settings → Environment Variables, add at least one LLM key, then redeploy.
              </>
            ) : (
              <>
                Edit <code className="mono">.env.local</code>, paste at least one LLM key, then restart{" "}
                <code className="mono">npm run dev</code>.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
