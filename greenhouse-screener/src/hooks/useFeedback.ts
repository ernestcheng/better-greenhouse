import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface DisagreementRecord {
  application_id: number;
  candidate_name: string;
  job_id: number;
  llm_recommendation: 'GREEN' | 'RED';
  llm_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  llm_summary: string;
  user_decision: 'ADVANCE' | 'REJECT';
  user_reason: string;
  timestamp: string;
}

const FEEDBACK_STORAGE_KEY = 'greenhouse-feedback';

function loadFeedback(): DisagreementRecord[] {
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFeedback(records: DisagreementRecord[]) {
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(records));
}

export function useFeedback() {
  const queryClient = useQueryClient();

  const { data: feedback = [] } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => loadFeedback(),
    staleTime: Infinity,
  });

  const addDisagreement = useCallback((record: Omit<DisagreementRecord, 'timestamp'>) => {
    const newRecord: DisagreementRecord = {
      ...record,
      timestamp: new Date().toISOString(),
    };
    
    const current = loadFeedback();
    // Keep only last 50 disagreements to avoid prompt bloat
    const updated = [...current, newRecord].slice(-50);
    saveFeedback(updated);
    queryClient.setQueryData(['feedback'], updated);
  }, [queryClient]);

  const getJobFeedback = useCallback((jobId: number): DisagreementRecord[] => {
    return feedback.filter(f => f.job_id === jobId);
  }, [feedback]);

  const clearFeedback = useCallback(() => {
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
    queryClient.setQueryData(['feedback'], []);
  }, [queryClient]);

  return {
    feedback,
    addDisagreement,
    getJobFeedback,
    clearFeedback,
  };
}

// Format feedback for inclusion in Claude prompt
export function formatFeedbackForPrompt(feedback: DisagreementRecord[]): string {
  if (feedback.length === 0) return '';

  const examples = feedback.slice(-10).map(f => {
    const action = f.user_decision === 'ADVANCE' ? 'ADVANCED (you said RED)' : 'REJECTED (you said GREEN)';
    return `- ${f.candidate_name}: You recommended ${f.llm_recommendation} (${f.llm_confidence}), but I ${action}. Reason: "${f.user_reason}"`;
  });

  return `
## Calibration from Your Past Decisions
I've disagreed with some of your past recommendations. Learn from these corrections:

${examples.join('\n')}

Adjust your calibration based on this feedback. If you've been too lenient or too strict on certain criteria, correct accordingly.
`;
}
