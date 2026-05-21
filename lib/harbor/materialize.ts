import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceState } from "@/lib/agent/types";

const DEFAULT_FILES: Record<string, string> = {
  "tests/test.sh": `#!/bin/bash
set -e
pip install --break-system-packages pytest pytest-json-ctrf openpyxl >/dev/null 2>&1 || true
mkdir -p /logs/verifier
pytest tests/test_outputs.py --ctrf /logs/verifier/ctrf.json -q || true
if [ -f /logs/verifier/reward.txt ]; then
  cat /logs/verifier/reward.txt
fi
exit 0
`,
};

export async function materializeWorkspace({
  workspace,
  destDir,
  taskSlug,
}: {
  workspace: WorkspaceState;
  destDir: string;
  taskSlug: string;
}): Promise<{ taskDir: string; files: string[] }> {
  const taskDir = path.resolve(destDir, taskSlug);
  await rm(taskDir, { recursive: true, force: true });
  await mkdir(taskDir, { recursive: true });

  const wroteFiles: string[] = [];

  for (const artifact of Object.values(workspace.artifacts)) {
    const fullPath = path.join(taskDir, artifact.path);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, artifact.content, "utf8");
    wroteFiles.push(artifact.path);
  }

  for (const [relPath, content] of Object.entries(DEFAULT_FILES)) {
    if (workspace.artifacts[relPath]) continue;
    const fullPath = path.join(taskDir, relPath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
    if (relPath.endsWith(".sh")) {
      try {
        const { chmod } = await import("node:fs/promises");
        await chmod(fullPath, 0o755);
      } catch {
        // ignore on platforms without chmod
      }
    }
    wroteFiles.push(relPath);
  }

  return { taskDir, files: wroteFiles };
}
