import {
  ds25Instruction,
  ds25Project,
  ds25TaskToml,
  ds25VerifierPreview,
} from "@/lib/domain/ds25-seed";
import type { Artifact, WorkspaceState } from "./types";

const now = Date.now();

const artifacts: Artifact[] = [
  {
    path: "instruction.md",
    kind: "markdown",
    badge: "operational",
    content: ds25Instruction,
    updatedAt: now,
  },
  {
    path: "task.toml",
    kind: "toml",
    content: ds25TaskToml,
    updatedAt: now,
  },
  {
    path: "environment/Dockerfile",
    kind: "shell",
    content:
      "FROM python:3.12\n\nRUN pip install --no-cache-dir \\\n  openpyxl==3.1.5 \\\n  pandas==2.2.3 \\\n  pdfplumber==0.11.4 \\\n  fpdf2==2.8.2 \\\n  pytest==8.3.3\n",
    updatedAt: now,
  },
  {
    path: "environment/data/build_inputs.py",
    kind: "python",
    badge: "fixture builder",
    content:
      "# Synthesizes ds-25 multimodal fixtures. Generated lazily by the agent.\nimport json, random\n\nrng = random.Random(25)\n\nif __name__ == '__main__':\n    print('build_inputs placeholder - regenerate via the fixtures tool')\n",
    updatedAt: now,
  },
  {
    path: "solution/solve.sh",
    kind: "shell",
    content: "#!/bin/bash\nset -e\npython3 /root/solution.py\n",
    updatedAt: now,
  },
  {
    path: "tests/test_outputs.py",
    kind: "python",
    badge: "deterministic verifier",
    content: ds25VerifierPreview
      .map((line, index) => `def test_${index}_${line.replaceAll(" ", "_")}():\n    assert True\n`)
      .join("\n"),
    updatedAt: now,
  },
  {
    path: "policy/compliance_policy.pdf.txt",
    kind: "markdown",
    badge: "authority artifact",
    content:
      "Compliance Policy v3.2\n\n- Release is permitted only when every upstream lab event in the dependency trace is finalized.\n- Portal exports are advisory; the dependency trace is authoritative.\n- Manual review is required when an upstream event is pending or revoked.\n",
    updatedAt: now,
  },
];

export function buildDemoWorkspace(): WorkspaceState {
  const artifactMap: Record<string, Artifact> = {};
  for (const artifact of artifacts) {
    artifactMap[artifact.path] = artifact;
  }

  return {
    projectId: ds25Project.id,
    projectName: ds25Project.name,
    targetModel: ds25Project.targetModel,
    auditorModel: ds25Project.auditorModel,
    runner: ds25Project.runner,
    runConfigHash: ds25Project.runConfigHash,
    phase: "intake",
    artifacts: artifactMap,
  };
}
