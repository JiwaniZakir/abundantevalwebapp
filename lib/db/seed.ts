import "dotenv/config";
import { db } from "./client";
import {
  projects,
  runConfigs,
  tasks,
  weaknessCards,
  probes,
  probeTrials,
  sweeps,
  trials,
  audits,
  spoilerFindings,
  iterations,
} from "./schema";
import {
  ds25Instruction,
  ds25Project,
  ds25ProbeTrials,
  ds25TaskToml,
  ds25VerifierPreview,
  ds25WeaknessCard,
} from "@/lib/domain/ds25-seed";

async function main() {
  const [runConfig] = await db
    .insert(runConfigs)
    .values({
      provider: "google",
      modelSlug: ds25Project.targetModel,
      runner: ds25Project.runner,
      flags: { trustWorkspace: true },
      hash: ds25Project.runConfigHash,
    })
    .onConflictDoNothing({ target: runConfigs.hash })
    .returning();

  const [project] = await db
    .insert(projects)
    .values({
      name: ds25Project.name,
      slug: ds25Project.slug,
      workflowSlug: "compliance-cert-release",
      runConfigId: runConfig?.id,
    })
    .onConflictDoNothing({ target: projects.slug })
    .returning();

  if (!project) {
    console.log("Seed already present.");
    return;
  }

  const [weakness] = await db
    .insert(weaknessCards)
    .values({
      projectId: project.id,
      taxonomyCategory:
        ds25WeaknessCard.taxonomyCategory as typeof weaknessCards.$inferInsert.taxonomyCategory,
      title: ds25WeaknessCard.title,
      hypothesis: ds25WeaknessCard.hypothesis,
      badHeuristic: ds25WeaknessCard.badHeuristic,
      authorityInvariant: ds25WeaknessCard.authorityInvariant,
      status: "promoted",
    })
    .returning();

  for (const probe of ds25ProbeTrials) {
    const [createdProbe] = await db
      .insert(probes)
      .values({
        weaknessCardId: weakness.id,
        variant: probe.variant as typeof probes.$inferInsert.variant,
        prompt: `Evaluate the ds-25 lifecycle candidate under ${probe.variant} pressure.`,
      })
      .returning();

    await db.insert(probeTrials).values(
      Array.from({ length: probe.total }, (_, index) => ({
        probeId: createdProbe.id,
        rawOutput: JSON.stringify({
          trial: index + 1,
          missedCascade: index < probe.failures,
        }),
        scoredFailure: index < probe.failures,
        latencyMs: 850 + index * 17,
        tokensIn: 420,
        tokensOut: 180,
        costUsd: (probe.costUsd / probe.total).toFixed(4),
      })),
    );
  }

  const [task] = await db
    .insert(tasks)
    .values({
      projectId: project.id,
      slug: "ds-25-compliance-cert-release",
      instructionMd: ds25Instruction,
      taskToml: ds25TaskToml,
      dockerfile: "FROM python:3.12\nRUN pip install openpyxl pytest pdfplumber\n",
      buildInputsPy: "# Generated multimodal fixture builder placeholder\n",
      solveSh: "#!/bin/bash\nset -e\npython3 /root/solve.py\n",
      testOutputsPy: ds25VerifierPreview
        .map((item) => `def test_${item.replaceAll(" ", "_")}(): assert True`)
        .join("\n\n"),
    })
    .returning();

  const [sweep] = await db
    .insert(sweeps)
    .values({
      taskId: task.id,
      runConfigId: runConfig.id,
      phase: "target",
      status: "succeeded",
      passAtKNumerator: 0,
      passAtKDenominator: 3,
    })
    .returning();

  const createdTrials = await db
    .insert(trials)
    .values(
      [1, 2, 3].map((trialIdx) => ({
        sweepId: sweep.id,
        trialIdx,
        reward: "0",
        trajectoryJson: { failure: "used_prior_work_heuristic" },
        ctrfJson: { tests: ds25VerifierPreview },
        logText: `Trial ${trialIdx}: missed transitive revocation cascade.`,
        status: "failed" as const,
      })),
    )
    .returning();

  await db.insert(audits).values(
    createdTrials.map((trial) => ({
      trialId: trial.id,
      auditorModel: ds25Project.auditorModel,
      classification: "used_prior_work_heuristic" as const,
      rationale:
        "The trajectory trusted the portal-active export and failed to propagate revocation through the lab dependency graph.",
    })),
  );

  await db.insert(spoilerFindings).values([
    {
      taskId: task.id,
      artifactPath: "instruction.md",
      line: 12,
      severity: "high",
      ruleId: "explicit-do-not",
      message: "Avoid direct negation that names the trap.",
    },
  ]);

  await db.insert(iterations).values({
    taskId: task.id,
    summary: "Rewrite bait notebook as prior analyst rationale instead of a trap tutorial.",
    diffJson: {
      before: "Do not trust portal active rows.",
      after: "Prior analyst used portal status for the draft release view.",
    },
  });

  console.log("Seeded ds-25 demo project.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
