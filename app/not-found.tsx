import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full items-center justify-center bg-[var(--bg)] px-6">
      <div className="max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 text-center shadow-md">
        <p className="mono text-[10px] uppercase tracking-wider text-[var(--fg-faint)]">
          404
        </p>
        <h1 className="mt-3 text-[20px] font-semibold tracking-tight text-[var(--fg)]">
          Page not found
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="mono mt-6 inline-flex rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white"
        >
          Back to workbench
        </Link>
      </div>
    </main>
  );
}
