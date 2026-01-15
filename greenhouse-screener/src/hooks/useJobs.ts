import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Job, Stage } from '@/types';

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get<Job[]>('/jobs'),
  });
}

export function useJobStages(jobId: number | null) {
  return useQuery({
    queryKey: ['jobs', jobId, 'stages'],
    queryFn: () => api.get<Stage[]>(`/jobs/${jobId}/stages`),
    enabled: jobId !== null,
  });
}
