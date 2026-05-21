export type AutopilotStage =
  | "idle"
  | "mapped"
  | "probed"
  | "decided"
  | "built"
  | "validated"
  | "ready_publish";

export function isAutopilotInput(input: string): boolean {
  const t = input.trim();
  if (t.startsWith("__autopilot:")) return true;
  if (t.startsWith("/")) return false;
  if (t.length < 12) return false;
  if (/^(yes|approve|continue|ok|go ahead|reject|no|stop)$/i.test(t)) return false;
  return true;
}

export function isAutopilotContinuation(input: string): boolean {
  return input.trim().startsWith("__autopilot:");
}

export function buildAutopilotContinuation(
  gateId: string,
  stage: AutopilotStage,
  decision: "approve" | "reject",
): string {
  return `__autopilot:${gateId}:${stage}:${decision}`;
}

export function parseAutopilotContinuation(input: string) {
  const parts = input.trim().split(":");
  if (parts[0] !== "__autopilot" || parts.length < 4) return null;
  return {
    gateId: parts[1],
    stage: parts[2] as AutopilotStage,
    decision: parts[3] as "approve" | "reject",
  };
}
