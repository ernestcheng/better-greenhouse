import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { 
  ApplicationsResponse, 
  Filters, 
  RejectRequest, 
  BulkRejectRequest,
  RejectionReason,
  EmailTemplate,
} from '@/types';

export function useApplications(
  jobId: number | null, 
  filters: Filters,
  page: number = 1,
  perPage: number = 20
) {
  return useQuery({
    queryKey: ['applications', jobId, filters, page, perPage],
    queryFn: () =>
      api.get<ApplicationsResponse>(`/jobs/${jobId}/applications`, {
        page,
        per_page: perPage,
        status: filters.status,
        stage_id: filters.stage_id,
      }),
    enabled: jobId !== null,
  });
}

export function useRejectionReasons() {
  return useQuery({
    queryKey: ['rejection-reasons'],
    queryFn: () => api.get<RejectionReason[]>('/rejection-reasons'),
  });
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api.get<EmailTemplate[]>('/email-templates'),
  });
}

export function useRejectApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RejectRequest) =>
      api.post(`/applications/${data.applicationId}/reject`, {
        rejection_reason_id: data.rejection_reason_id,
        email_template_id: data.email_template_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useBulkReject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkRejectRequest) =>
      api.post<{ success: boolean; rejected: number[]; failed: number[] }>(
        '/applications/bulk-reject',
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useAdvanceApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, fromStageId }: { applicationId: number; fromStageId: number }) =>
      api.post(`/applications/${applicationId}/advance`, { from_stage_id: fromStageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
