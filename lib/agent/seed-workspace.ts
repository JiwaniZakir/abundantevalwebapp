import type { WorkspaceState } from "./types";

export function buildEmptyWorkspace(): WorkspaceState {
  return {
    projectId: `proj_${Date.now().toString(36)}`,
    projectName: "New Eval Task",
    targetModel: "gemini-2.0-flash",
    auditorModel: "gemini-2.0-flash",
    runner: "gemini-cli",
    runConfigHash: `rcfg_${Date.now().toString(36)}`,
    phase: "intake",
    artifacts: {},
  };
}
