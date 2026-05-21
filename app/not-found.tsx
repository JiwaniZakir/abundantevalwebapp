import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full items-center justify-center bg-[var(--color-background)] px-6">
      <div className="max-w-md rounded-xl border border-[var(--hairline)] bg-[var(--panel)] p-8 text-center">
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-xl font-semibold">No artifact at that path.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Head back to the workbench and continue the eval-design loop.
        </p>
        <Link
          href="/"
          className="mono mt-6 inline-flex rounded-md bg-[var(--accent-violet)] px-4 py-2 text-xs font-medium text-[#0c0d10]"
        >
          Open workbench
        </Link>
      </div>
    </main>
  );
}
