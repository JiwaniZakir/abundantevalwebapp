import {
  DEFAULT_TRIALS_PER_VARIANT,
  runLlmAgent,
} from "@/lib/agent/llm-runtime";
import {
  isAutopilotContinuation,
  isAutopilotInput,
  runAutopilot,
} from "@/lib/agent/autopilot";
import { buildEmptyWorkspace } from "@/lib/agent/seed-workspace";
import { resolveAgentProviders } from "@/lib/ai/providers";
import { hasLlmApiKey, LIVE_SETUP_MESSAGE } from "@/lib/env/live";
import type {
  AgentEvent,
  Artifact,
  ChatMessage,
  WorkspaceState,
} from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  input?: string;
  history?: ChatMessage[];
  workspace?: {
    phase?: WorkspaceState["phase"];
    artifacts?: Artifact[];
  };
  trialsPerVariant?: number;
};

export async function POST(request: Request) {
  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  const workspace = buildEmptyWorkspace();
  if (body.workspace?.phase) workspace.phase = body.workspace.phase;
  if (body.workspace?.artifacts) {
    for (const artifact of body.workspace.artifacts) {
      workspace.artifacts[artifact.path] = artifact;
    }
  }
  const input = (body.input ?? "").toString();
  const liveAvailable = hasLlmApiKey();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        if (!liveAvailable) {
          send({
            type: "notice",
            level: "error",
            reason: "live_setup_required",
            message: LIVE_SETUP_MESSAGE,
          });
          send({ type: "error", message: LIVE_SETUP_MESSAGE });
          send({ type: "done" });
          return;
        }

        const resolved = resolveAgentProviders(workspace);
        const useAutopilot = isAutopilotInput(input) || isAutopilotContinuation(input);

        if (useAutopilot) {
          for await (const event of runAutopilot({
            input,
            workspace,
            bindings: {
              targetProvider: resolved.targetProvider,
              targetModelSlug: resolved.targetModelSlug,
              judgeProvider: resolved.auditorProvider,
              judgeModelSlug: resolved.auditorSlug,
              scaffoldProvider: resolved.auditorProvider,
              scaffoldModelSlug: resolved.auditorSlug,
              intakeProvider: resolved.auditorProvider,
              intakeModelSlug: resolved.auditorSlug,
              trialsPerVariant: body.trialsPerVariant ?? DEFAULT_TRIALS_PER_VARIANT,
            },
          })) {
            send(event);
          }
          return;
        }

        for await (const event of runLlmAgent({
          input,
          history: body.history ?? [],
          workspace,
          targetProvider: resolved.targetProvider,
          targetModelSlug: resolved.targetModelSlug,
          judgeProvider: resolved.auditorProvider,
          judgeModelSlug: resolved.auditorSlug,
          scaffoldProvider: resolved.auditorProvider,
          scaffoldModelSlug: resolved.auditorSlug,
          intakeProvider: resolved.auditorProvider,
          intakeModelSlug: resolved.auditorSlug,
          trialsPerVariant: body.trialsPerVariant ?? DEFAULT_TRIALS_PER_VARIANT,
        })) {
          send(event);
        }
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "agent failed",
        });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
