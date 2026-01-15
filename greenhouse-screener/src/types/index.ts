// Job Types
export interface Job {
  id: number;
  name: string;
  status: 'open' | 'closed' | 'draft';
  departments: Department[];
  offices: Office[];
}

export interface Department {
  id: number;
  name: string;
}

export interface Office {
  id: number;
  name: string;
}

export interface Stage {
  id: number;
  name: string;
  priority: number;
}

// Candidate Types
export interface Candidate {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export interface Answer {
  question: string;
  answer: string;
}

export interface Attachments {
  resume?: string;
  cover_letter?: string;
}

export interface Source {
  id: number;
  name: string;
}

export interface Application {
  id: number;
  candidate_id: number;
  candidate: Candidate;
  applied_at: string;
  source: Source | null;
  current_stage: Stage | null;
  answers: Answer[];
  attachments: Attachments;
}

export interface ApplicationsResponse {
  applications: Application[];
  total: number;
  per_page: number;
  page: number;
  nextPage?: number;
}

// Screening Types
export type Recommendation = 'GREEN' | 'RED';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ScreeningResult {
  application_id: number;
  recommendation: Recommendation;
  confidence: Confidence;
  summary: string;
  key_factors: string[];
  concerns: string[];
  reasoning: string;
}

export interface DisagreementFeedback {
  candidate_name: string;
  llm_recommendation: 'GREEN' | 'RED';
  user_decision: 'ADVANCE' | 'REJECT';
  user_reason: string;
}

export interface ScreeningRequest {
  job_id: number;
  job_title: string;
  job_requirements: string;
  applications: ApplicationToScreen[];
  feedback?: DisagreementFeedback[];
}

export interface ApplicationToScreen {
  application_id: number;
  candidate_name: string;
  resume_url?: string;
  cover_letter_url?: string;
  answers: Answer[];
}

export interface ScreeningResponse {
  results: ScreeningResult[];
}

// Rejection Types
export interface RejectionReason {
  id: number;
  name: string;
}

export interface EmailTemplate {
  id: number;
  name: string;
  type: string;
}

export interface RejectionSettings {
  rejectionReasonId?: number;
  emailTemplateId?: number;
}

export interface RejectRequest {
  applicationId: number;
  rejection_reason_id: number;
  email_template_id?: number;
}

export interface BulkRejectRequest {
  application_ids: number[];
  rejection_reason_id: number;
  email_template_id?: number;
}

// Filter Types
export interface Filters {
  status?: 'active' | 'rejected' | 'hired';
  stage_id?: number;
  screening?: 'all' | 'green' | 'red' | 'unscreened';
  sort?: 'applied_at' | 'name' | 'screening';
}

// Screening History
export interface ScreeningDecision {
  application_id: number;
  llm_recommendation: Recommendation;
  llm_confidence: Confidence;
  user_decision: 'ADVANCE' | 'REJECT' | 'SKIP';
  user_reason?: string;
  timestamp: string;
}

export interface JobScreeningHistory {
  decisions: ScreeningDecision[];
}

export interface ScreeningHistory {
  [jobId: string]: JobScreeningHistory;
}
