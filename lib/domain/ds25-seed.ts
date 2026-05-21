import type { FailureModeSlug } from "./taxonomy";

export const ds25Project = {
  id: "demo-ds25",
  name: "Compliance Cert Release - Q2",
  slug: "compliance-cert-release-q2",
  targetModel: "google/gemini-3-flash-preview",
  runner: "gemini-cli",
  auditorModel: "claude-4.6-sonnet",
  runConfigHash: "rcfg_9b2f4f_gemini_cli_gemini3flash",
  passThreshold: 0.6,
  hardThreshold: 0.3,
};

export const ds25WeaknessCard = {
  taxonomyCategory: "lifecycle" satisfies FailureModeSlug,
  title: "Compliance certificate release with transitive revocation",
  hypothesis:
    "Gemini will trust portal active states or direct certificate status and miss revocation propagated through a two-hop lab dependency graph.",
  badHeuristic:
    "Use the supplier portal export as the release source of truth when it says a certificate is active.",
  authorityInvariant:
    "A certificate can publish only if its dependency trace has no revoked or pending upstream lab event before close.",
  status: "promoted",
};

export const ds25ProbeTrials = [
  { variant: "plain", total: 15, failures: 12, costUsd: 0.48 },
  { variant: "prior_work", total: 15, failures: 14, costUsd: 0.51 },
  { variant: "schema", total: 15, failures: 11, costUsd: 0.44 },
  { variant: "audit", total: 15, failures: 13, costUsd: 0.49 },
  { variant: "speed", total: 15, failures: 15, costUsd: 0.53 },
];

export const ds25DependencyNodes = [
  { id: "LAB-1044", label: "Lab event LAB-1044", status: "revoked" },
  { id: "CERT-A17", label: "Cert A17", status: "blocked" },
  { id: "BATCH-22", label: "Supplier batch 22", status: "blocked" },
  { id: "CERT-C02", label: "Cert C02", status: "active" },
  { id: "PORTAL", label: "Portal export", status: "conflict" },
  { id: "RELEASE", label: "Release workbook", status: "manual_review" },
];

export const ds25DependencyEdges = [
  ["LAB-1044", "CERT-A17"],
  ["CERT-A17", "BATCH-22"],
  ["BATCH-22", "RELEASE"],
  ["CERT-C02", "RELEASE"],
  ["PORTAL", "RELEASE"],
] as const;

export const ds25Instruction = `I need the Q2 compliance certificate release workbook written to /root/compliance_cert_release.xlsx.

Use the authority files under /root/data and produce these sheets exactly:

1. Release Decisions
2. Dependency Trace
3. Revocation Cascade
4. Conflict Log
5. Executive Summary

Numeric counts must be stored as numbers. Source labels must match the input file names.`;

export const ds25TaskToml = `[metadata]
difficulty = "hard"
failure_mode = "lifecycle_revocation_propagation"

[environment]
cpus = 1
memory_mb = 4096
storage_mb = 10240

[agent]
timeout_sec = 1800

[verifier]
timeout_sec = 900
`;

export const ds25VerifierPreview = [
  "required workbook exists",
  "required sheets and headers match",
  "each active certificate routed exactly once",
  "transitive revocations appear in Dependency Trace",
  "portal-active conflicts appear in Conflict Log",
  "executive summary counts match verifier recomputation",
];
