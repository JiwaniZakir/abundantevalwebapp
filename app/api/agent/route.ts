import { runAgent } from "@/lib/agent/runtime";
import { buildDemoWorkspace } from "@/lib/agent/seed-workspace";
import type { Artifact, WorkspaceState } from "@/lib/agent/types";

export const runtime = "nodejs";

type RequestBody = {
  input?: string;
  workspace?: {
    phase?: WorkspaceState["phase"];
    artifacts?: Artifact[];
  };
};

export async function POST(request: Request) {
  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  const workspace = buildDemoWorkspace();
  if (body.workspace?.phase) {
    workspace.phase = body.workspace.phase;
  }
  if (body.workspace?.artifacts) {
    for (const artifact of body.workspace.artifacts) {
      workspace.artifacts[artifact.path] = artifact;
    }
  }

  const input = (body.input ?? "").toString();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runAgent(input, workspace)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              message:
                error instanceof Error ? error.message : "Unknown agent error",
            })}\n\n`,
          ),
        );
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
