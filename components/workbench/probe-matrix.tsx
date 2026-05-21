"use client";

import type { ProbeSummary } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

export function ProbeMatrix({ summary }: { summary: ProbeSummary }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[var(--fg-muted)]">
            <th className="text-left py-2 pr-3 font-medium">Variant</th>
            <th className="text-left py-2 pr-3 font-medium">Failures</th>
            <th className="text-left py-2 font-medium">Rate</th>
          </tr>
        </thead>
        <tbody>
          {summary.variants.map((v) => (
            <tr key={v.variant} className="border-t border-[var(--border)]">
              <td className="py-2 pr-3 mono text-[var(--fg-secondary)]">{v.variant}</td>
              <td className="py-2 pr-3">
                {v.failures}/{v.trials}
              </td>
              <td className="py-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                    v.failureRate >= 0.8 && "bg-[var(--green-soft)] text-[var(--green)]",
                    v.failureRate >= 0.4 && v.failureRate < 0.8 && "bg-[var(--amber-soft)] text-[var(--amber)]",
                    v.failureRate < 0.4 && "bg-[var(--red-soft)] text-[var(--red)]",
                  )}
                >
                  {Math.round(v.failureRate * 100)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
