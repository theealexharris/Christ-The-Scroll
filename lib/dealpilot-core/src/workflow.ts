export const WORKFLOW_STATUSES = ["queued", "running", "needs_input", "needs_review", "completed", "failed"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const STEP_STATUSES = ["pending", "running", "completed", "failed", "skipped", "waiting"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const WORKFLOW_STEPS = [
  { key: "validate_inputs", label: "Validate property inputs" },
  { key: "gather_sources", label: "Gather available, permitted source data" },
  { key: "run_calculations", label: "Run deterministic calculations" },
  { key: "ai_explanation", label: "Generate AI explanation from validated results" },
  { key: "flag_missing_evidence", label: "Flag missing evidence" },
  { key: "create_tasks", label: "Create due-diligence tasks" },
  { key: "present_review", label: "Present results for your review" },
  { key: "save_report", label: "Save report and next steps" },
] as const;
export type WorkflowStepKey = (typeof WORKFLOW_STEPS)[number]["key"];

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  queued: "Queued",
  running: "Running",
  needs_input: "Needs input",
  needs_review: "Needs review",
  completed: "Completed",
  failed: "Failed",
};
