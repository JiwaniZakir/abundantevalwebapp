"use client";

import type { ProbeSummary } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

const VARIANTS = ["plain", "prior_work", "schema", "audit", "speed"];

function aggregateRate(summary: ProbeSummary) {
  return (
    summary.variants.reduce((a, v) => a + v.failureRate, 0) /
    Math.max(1, summary.variants.length)
  );
}

function DifficultyCurve({ summary }: { summary: ProbeSummary }) {
  const points = VARIANTS.map((name, i) => {
    const v = summary.variants.find((x) => x.variant === name);
    const rate = v?.failureRate ?? 0;
    const x = 24 + (i / Math.max(1, VARIANTS.length - 1)) * 272;
    const y = 96 - rate * 72;
    return { x, y, rate, name };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-micro text-[var(--fg-muted)]">Difficulty curve</p>
        <p className="text-micro text-[var(--fg-faint)]">{summary.weaknessTitle.slice(0, 28)}</p>
      </div>
      <svg viewBox="0 0 320 112" className="w-full h-[112px]" aria-hidden>
        <line x1="24" y1="96" x2="296" y2="96" stroke="var(--border-strong)" strokeWidth="1" />
        <line x1="24" y1="24" x2="24" y2="96" stroke="var(--border-strong)" strokeWidth="1" />
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1="24"
            y1={96 - t * 72}
            x2="296"
            y2={96 - t * 72}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p) => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--accent)" />
            <text x={p.x} y="108" textAnchor="middle" fontSize="8" fill="var(--fg-muted)">
              {p.name.replace("_", " ").slice(0, 5)}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-micro text-[var(--fg-faint)]">
        <span>Pressure variants</span>
        <span>Failure rate</span>
      </div>
    </div>
  );
}

function ProbeHeatmap({ summaries }: { summaries: ProbeSummary[] }) {
  if (summaries.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 overflow-x-auto">
      <p className="text-micro text-[var(--fg-muted)] mb-3">Batch probe matrix</p>
      <table className="w-full min-w-[280px] text-micro">
        <thead>
          <tr>
            <th className="text-left py-1 pr-2 font-medium text-[var(--fg-muted)]">Weakness</th>
            {VARIANTS.map((v) => (
              <th key={v} className="px-1 py-1 font-medium text-[var(--fg-faint)] uppercase">
                {v.slice(0, 4)}
              </th>
            ))}
            <th className="pl-2 text-right font-medium text-[var(--fg-muted)]">Avg</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => {
            const avg = aggregateRate(s);
            return (
              <tr key={s.weaknessTitle} className="border-t border-[var(--border)]">
                <td className="py-2 pr-2 text-[var(--fg-secondary)] truncate max-w-[88px]" title={s.weaknessTitle}>
                  {s.weaknessTitle}
                </td>
                {VARIANTS.map((name) => {
                  const v = s.variants.find((x) => x.variant === name);
                  const rate = v?.failureRate ?? 0;
                  return (
                    <td key={name} className="p-1">
                      <div
                        className={cn(
                          "h-7 w-full rounded-md flex items-center justify-center tabular-nums font-medium",
                          rate >= 0.8 && "bg-[var(--green-soft)] text-[var(--green)]",
                          rate >= 0.4 && rate < 0.8 && "bg-[var(--amber-soft)] text-[var(--amber)]",
                          rate < 0.4 && "bg-[var(--red-soft)] text-[var(--red)]",
                        )}
                        title={`${Math.round(rate * 100)}% fail`}
                      >
                        {Math.round(rate * 100)}
                      </div>
                    </td>
                  );
                })}
                <td className="py-2 pl-2 text-right tabular-nums font-semibold text-[var(--fg)]">
                  {Math.round(avg * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProbeScaleViz({
  summary,
  summaries,
}: {
  summary?: ProbeSummary;
  summaries: ProbeSummary[];
}) {
  const display = summary ?? summaries[0];
  const totalTrials = summaries.reduce(
    (acc, s) => acc + s.variants.reduce((a, v) => a + v.trials, 0),
    0,
  );
  const totalFailures = summaries.reduce(
    (acc, s) => acc + s.variants.reduce((a, v) => a + v.failures, 0),
    0,
  );
  const promoteCount = summaries.filter((s) => s.verdict === "promote").length;

  if (!display && summaries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-6 text-center">
        <p className="text-body text-[var(--fg-muted)]">No probe data yet</p>
        <p className="mt-1 text-caption text-[var(--fg-faint)]">
          Approve candidates and run batch probes to see difficulty curves.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-center">
          <p className="text-micro text-[var(--fg-muted)]">Trials</p>
          <p className="text-display tabular-nums text-[var(--fg)]">{totalTrials || (display?.variants[0]?.trials ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-center">
          <p className="text-micro text-[var(--fg-muted)]">Failures</p>
          <p className="text-display tabular-nums text-[var(--red)]">{totalFailures}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 text-center">
          <p className="text-micro text-[var(--fg-muted)]">Promote</p>
          <p className="text-display tabular-nums text-[var(--green)]">{promoteCount}</p>
        </div>
      </div>

      {summaries.length > 1 ? (
        <ProbeHeatmap summaries={summaries} />
      ) : display ? (
        <DifficultyCurve summary={display} />
      ) : null}

      {display && summaries.length <= 1 && (
        <div className="space-y-1.5">
          {display.variants.map((v) => (
            <div key={v.variant} className="flex items-center gap-2">
              <span className="mono w-16 text-micro text-[var(--fg-muted)] truncate">{v.variant}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-active)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{ width: `${v.failureRate * 100}%` }}
                />
              </div>
              <span className="mono w-10 text-right text-micro tabular-nums">{Math.round(v.failureRate * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
