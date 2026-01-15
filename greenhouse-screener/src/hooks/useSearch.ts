import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQueryClient used by useBuildIndex and useClearIndex
import { api } from '@/lib/api';

interface EmbeddingStatus {
  available: boolean;
  error?: string;
}

interface IndexStatus {
  indexed: boolean;
  count: number;
  indexed_at?: string;
}

interface SearchResult {
  application_id: number;
  candidate_name: string;
  score: number;
  preview: string;
}

interface IndexResponse {
  success: boolean;
  indexed: number;
  failed: number;
  total: number;
}

export function useEmbeddingStatus() {
  return useQuery({
    queryKey: ['embedding-status'],
    queryFn: () => api.get<EmbeddingStatus>('/search/status'),
    staleTime: 30000, // Check every 30s
    retry: false,
  });
}

export function useIndexStatus(jobId: number | null) {
  return useQuery({
    queryKey: ['index-status', jobId],
    queryFn: () => api.get<IndexStatus>(`/search/index/${jobId}`),
    enabled: jobId !== null,
  });
}

export function useBuildIndex() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: number) => 
      api.post<IndexResponse>(`/search/index/${jobId}`, {}),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['index-status', jobId] });
    },
  });
}

export function useSearch(jobId: number | null) {
  return useMutation({
    mutationFn: ({ query, limit = 50 }: { query: string; limit?: number }) => {
      if (!jobId) throw new Error('No job selected');
      return api.post<{ results: SearchResult[] }>(`/search/${jobId}`, { query, limit });
    },
  });
}

export function useClearIndex() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: number) => 
      api.delete(`/search/index/${jobId}`),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['index-status', jobId] });
    },
  });
}
