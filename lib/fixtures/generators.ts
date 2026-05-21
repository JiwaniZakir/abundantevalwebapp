import { z } from "zod";

export const fixtureSpecSchema = z.object({
  seed: z.number().default(25),
  activeCertificates: z.number().min(1).default(34),
  trapFamilies: z.array(z.string()).default([
    "single_revocation",
    "multi_dependency",
    "pending_upstream",
    "transitive_revocation",
    "portal_conflict",
  ]),
  baitArtifacts: z.array(z.string()).default([
    "prior_release_workbook.xlsx",
    "supplier_portal_export.csv",
  ]),
});

export type FixtureSpec = z.infer<typeof fixtureSpecSchema>;

export function createFixtureManifest(input: Partial<FixtureSpec> = {}) {
  const spec = fixtureSpecSchema.parse(input);

  return {
    spec,
    artifacts: [
      "compliance_policy.pdf",
      "lab_events.jsonl",
      "dependency_graph.json",
      "supplier_portal_export.csv",
      "prior_release_workbook.xlsx",
      "release_notes.eml",
    ],
  };
}
