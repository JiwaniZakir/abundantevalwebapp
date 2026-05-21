import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full items-center justify-center bg-[var(--cream)] px-6">
      <div className="max-w-md rounded-2xl border border-[var(--hairline-strong)] bg-[var(--paper-pure)] p-8 text-center shadow-[var(--shadow-soft)]">
        <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
          404
        </p>
        <h1 className="display mt-3 text-2xl font-semibold tracking-[-0.025em]">
          No artifact at that path.
        </h1>
        <p className="mt-3 text-[13px] leading-6 text-[var(--ink-muted)]">
          Head back to the workbench and continue the eval-design loop.
        </p>
        <Link
          href="/"
          className="mono mt-6 inline-flex rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-medium text-[var(--paper-pure)] hover:bg-[var(--ink-soft)]"
        >
          Open workbench
        </Link>
      </div>
    </main>
  );
}
