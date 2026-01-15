import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ScreeningRequest, ScreeningResponse, ScreeningResult } from '@/types';
import { useState, useCallback } from 'react';

// Local storage key for screening results
const SCREENING_STORAGE_KEY = 'greenhouse-screening-results';

function loadScreeningResults(): Record<number, ScreeningResult> {
  try {
    const stored = localStorage.getItem(SCREENING_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveScreeningResults(results: Record<number, ScreeningResult>) {
  localStorage.setItem(SCREENING_STORAGE_KEY, JSON.stringify(results));
}

export function useScreeningResults() {
  return useQuery({
    queryKey: ['screening'],
    queryFn: () => loadScreeningResults(),
    staleTime: Infinity,
  });
}

export function useScreening() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const mutation = useMutation({
    mutationFn: async (request: ScreeningRequest): Promise<ScreeningResponse> => {
      const { applications, ...rest } = request;
      const batchSize = 5;
      const allResults: ScreeningResult[] = [];
      
      setProgress({ current: 0, total: applications.length });
      
      for (let i = 0; i < applications.length; i += batchSize) {
        const batch = applications.slice(i, i + batchSize);
        const response = await api.post<ScreeningResponse>('/screen', {
          ...rest,
          applications: batch,
        });
        allResults.push(...response.results);
        setProgress({ current: Math.min(i + batchSize, applications.length), total: applications.length });
      }
      
      setProgress(null);
      return { results: allResults };
    },
    onSuccess: (data) => {
      // Update local cache with new screening results
      const currentResults = queryClient.getQueryData<Record<number, ScreeningResult>>(['screening']) || {};
      const newResults = data.results.reduce((acc, result) => ({
        ...acc,
        [result.application_id]: result,
      }), currentResults);
      
      queryClient.setQueryData(['screening'], newResults);
      saveScreeningResults(newResults);
    },
  });

  const clearResults = useCallback(() => {
    localStorage.removeItem(SCREENING_STORAGE_KEY);
    queryClient.setQueryData(['screening'], {});
  }, [queryClient]);

  return {
    ...mutation,
    progress,
    clearResults,
  };
}

export function useScreeningResult(applicationId: number) {
  const { data: results } = useScreeningResults();
  return results?.[applicationId] || null;
}
