// Greenhouse API Types
export interface GreenhouseJob {
  id: number;
  name: string;
  status: 'open' | 'closed' | 'draft';
  departments: Array<{ id: number; name: string }>;
  offices: Array<{ id: number; name: string }>;
  custom_fields?: Record<string, unknown>;
}

export interface GreenhouseStage {
  id: number;
  name: string;
  priority: number;
}

export interface GreenhouseCandidate {
  id: number;
  first_name: string;
  last_name: string;
  email_addresses: Array<{ value: string; type: string }>;
  phone_numbers: Array<{ value: string; type: string }>;
  attachments: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
}

export interface GreenhouseApplication {
  id: number;
  candidate_id: number;
  applied_at: string;
  source: { id: number; public_name: string } | null;
  current_stage: { id: number; name: string } | null;
  answers: Array<{
    question: string;
    answer: string;
  }>;
  jobs: Array<{ id: number; name: string }>;
  // These fields are returned by the API but were previously fetched from /candidates
  candidate?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
  }>;
}

// Lightweight application for export/indexing (no candidate enrichment needed)
export interface LightweightApplication {
  id: number;
  candidate_id: number;
  candidate_name: string;
  current_stage: { id: number; name: string } | null;
  resume_url?: string;
  cover_letter_url?: string;
  answers: Array<{ question: string; answer: string }>;
}

export interface GreenhouseRejectionReason {
  id: number;
  name: string;
  type: { id: number; name: string };
}

// API Response Types
export interface Job {
  id: number;
  name: string;
  status: 'open' | 'closed' | 'draft';
  departments: Array<{ id: number; name: string }>;
  offices: Array<{ id: number; name: string }>;
}

export interface Candidate {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export interface Application {
  id: number;
  candidate_id: number;
  candidate: Candidate;
  applied_at: string;
  source: { id: number; name: string } | null;
  current_stage: { id: number; name: string } | null;
  answers: Array<{ question: string; answer: string }>;
  attachments: {
    resume?: string;
    cover_letter?: string;
  };
}

// Feedback for calibration
export interface DisagreementFeedback {
  candidate_name: string;
  llm_recommendation: 'GREEN' | 'RED';
  user_decision: 'ADVANCE' | 'REJECT';
  user_reason: string;
}

// Screening Types
export interface ScreeningRequest {
  job_id: number;
  job_title: string;
  job_requirements: string;
  applications: Array<{
    application_id: number;
    candidate_name: string;
    resume_url?: string;
    cover_letter_url?: string;
    answers: Array<{ question: string; answer: string }>;
  }>;
  feedback?: DisagreementFeedback[];
}

export interface ScreeningResult {
  application_id: number;
  recommendation: 'GREEN' | 'RED';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  key_factors: string[];
  concerns: string[];
  reasoning: string;
}

// Highlights Types - simplified output for easy navigation
export interface HighlightedCandidate {
  rank: number;
  application_id: number;
  candidate_id: number;
  candidate_name: string;
  greenhouse_url: string;
  score: number;
  summary: string;
  tier: 'TOP' | 'STRONG' | 'GOOD';
}
