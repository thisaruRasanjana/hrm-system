/**
 * Centralised constants for the HRM Recruitment Module Frontend.
 * Replaces hardcoded magic strings across components.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const VACANCY_STATUS = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  CLOSED: "Closed",
} as const;

export const CANDIDATE_STATUS = {
  UPLOADED: "Uploaded",
  CALLED: "Called",
  FIRST_ROUND: "First Round",
  SECOND_ROUND_PENDING: "Second Round Pending",
  SECOND_ROUND: "Second Round",
  JOB_OFFERED: "Job Offered",
  REJECTED: "Rejected",
} as const;

export const FINAL_DECISION = {
  PROCEED_TO_NEXT_ROUND: "Proceed to Next Round",
  JOB_OFFERED: "Job Offered",
  REJECTED: "Rejected",
} as const;
