import path from "node:path";

/** Repo root for Harbor/git subprocess cwd. */
export function repoRoot() {
  return process.cwd();
}

export function repoPath(...segments: string[]) {
  return path.join(/* turbopackIgnore: true */ repoRoot(), ...segments);
}
