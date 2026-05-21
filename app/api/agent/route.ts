import { runScriptedAgent } from "@/lib/agent/scripted-runtime";
import { runLlmAgent } from "@/lib/agent/llm-runtime";
import { buildDemoWorkspace } from "@/lib/agent/seed-workspace";
import { defaultAuditorFor } from "@/lib/ai/providers";
import type {
  AgentEvent,
  Artifact,
  ChatMessage,
  WorkspaceState,
} from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type RequestBody = {
  input?: string;
  mode?: "live" | "demo";
  history?: ChatMessage[];
  workspace?: {
    phase?: WorkspaceState["phase"];
    artifacts?: Artifact[];
  };
};

function pickDefaultProviders(workspace: WorkspaceState) {
  const targetModelSlug = workspace.targetModel;
  let targetProvider: "google" | "anthropic" | "openai" = "google";
  if (targetModelSlug.startsWith("claude")) targetProvider = "anthropic";
  else if (targetModelSlug.startsWith("gpt")) targetProvider = "openai";
  else if (!targetModelSlug.startsWith("google")) targetProvider = "google";

  const auditorSlug = defaultAuditorFor(targetProvider);
  const auditorProvider: "google" | "anthropic" | "openai" =
    auditorSlug.startsWith("claude") ? "anthropic" : auditorSlug.startsWith("gpt") ? "openai" : "google";

  return { targetProvider, auditorProvider, auditorSlug };
}

function hasAnyKey() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  );
}

export async function POST(request: Request) {
  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  const workspace = buildDemoWorkspace();
  if (body.workspace?.phase) workspace.phase = body.workspace.phase;
  if (body.workspace?.artifacts) {
    for (const artifact of body.workspace.artifacts) {
      workspace.artifacts[artifact.path] = artifact;
    }
  }

  const input = (body.input ?? "").toString();
  const requestedMode = body.mode ?? "live";
  const mode: "live" | "demo" = requestedMode === "live" && hasAnyKey() ? "live" : "demo";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        if (mode === "demo") {
          for await (const event of runScriptedAgent(input, workspace)) {
            send(event);
          }
        } else {
          const { targetProvider, auditorProvider, auditorSlug } =
            pickDefaultProviders(workspace);

          for await (const event of runLlmAgent({
            input,
            history: body.history ?? [],
            workspace,
            targetProvider,
            targetModelSlug: workspace.targetModel,
            judgeProvider: auditorProvider,
            judgeModelSlug: auditorSlug,
            scaffoldProvider: auditorProvider,
            scaffoldModelSlug: auditorSlug,
            intakeProvider: auditorProvider,
            intakeModelSlug: auditorSlug,
            trialsPerVariant: 4,
          })) {
            send(event);
          }
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
