export type FailureModeSlug =
  | "authority_ambiguity"
  | "false_recency"
  | "wrong_source"
  | "phantom_join"
  | "tie_breaking"
  | "null_cascade"
  | "provenance"
  | "lifecycle";

export type FailureMode = {
  slug: FailureModeSlug;
  name: string;
  shortName: string;
  description: string;
  badHeuristic: string;
  authorityInvariant: string;
  exampleTask: string;
};

export const failureModes: FailureMode[] = [
  {
    slug: "authority_ambiguity",
    name: "Authority Ambiguity",
    shortName: "Authority",
    description:
      "The authority chain covers most conflicts but leaves a sanctioned subset unresolved.",
    badHeuristic: "Invent precedence to publish a confident release decision.",
    authorityInvariant: "Uncovered conflicts route to manual review with source labels.",
    exampleTask: "ds-18 Supplier Authority Review",
  },
  {
    slug: "false_recency",
    name: "False Recency",
    shortName: "Recency",
    description:
      "Fresh-looking artifacts are plausible, visible, and wrong for the decision.",
    badHeuristic: "Use the most recent source or max-of-recent rule.",
    authorityInvariant: "Planning policy names the authorized forecast source.",
    exampleTask: "ds-19 Replenishment Recency",
  },
  {
    slug: "wrong_source",
    name: "Wrong / Stale Source",
    shortName: "Source",
    description:
      "Similar values exist across broker workpapers, supplier estimates, and policy sources.",
    badHeuristic: "Pick the complete or convenient source.",
    authorityInvariant: "Score value and source attribution independently.",
    exampleTask: "ds-20 Customs Duty Source",
  },
  {
    slug: "phantom_join",
    name: "Phantom Joins",
    shortName: "Joins",
    description:
      "Near-matching identifiers invite normalization that no bridge policy authorizes.",
    badHeuristic: "Strip suffixes, pad zeroes, and substitute delimiters.",
    authorityInvariant: "Only sanctioned bridge rows can create matches.",
    exampleTask: "ds-21 Inventory PO Reconciliation",
  },
  {
    slug: "tie_breaking",
    name: "Silent Tie-Breaking",
    shortName: "Ties",
    description:
      "The hierarchy resolves most rows but exhausts itself on active ties.",
    badHeuristic: "Pick the first eligible row to complete the workbook.",
    authorityInvariant: "Unresolved ties route to a price desk queue.",
    exampleTask: "ds-22 Sales Pricing Tie-Break",
  },
  {
    slug: "null_cascade",
    name: "Null / Invalid Cascade",
    shortName: "Cascade",
    description:
      "Invalid measurements tempt imputation that looks plausible downstream.",
    badHeuristic: "Impute, clamp, or default and keep rolling up.",
    authorityInvariant: "Invalid records must be excluded and traced.",
    exampleTask: "ds-23 Yield Rollup Cascade",
  },
  {
    slug: "provenance",
    name: "Provenance Confabulation",
    shortName: "Provenance",
    description:
      "The value is correct, but the cited source is a mirror or convenient artifact.",
    badHeuristic: "Cite any corroborating source.",
    authorityInvariant: "Field-level authoritative source maps are scored separately.",
    exampleTask: "ds-24 Customer Master Provenance",
  },
  {
    slug: "lifecycle",
    name: "Lifecycle / Revocation",
    shortName: "Lifecycle",
    description:
      "Direct revocation is easy; transitive revocation through dependency graphs is hard.",
    badHeuristic: "Trust portal active states and miss 2-hop revocation.",
    authorityInvariant: "Dependency traces determine release eligibility.",
    exampleTask: "ds-25 Compliance Cert Release",
  },
];
