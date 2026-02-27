import { CONFIG } from '../config.js';
import type {
  GreenhouseJob,
  GreenhouseApplication,
  GreenhouseCandidate,
  GreenhouseStage,
  GreenhouseRejectionReason,
  Job,
  Application,
  LightweightApplication,
} from '../types.js';

// Helper to add delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Process items in batches with delay between batches
async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number = 5,
  delayMs: number = 500
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }
  return results;
}

class GreenhouseAPI {
  private baseUrl = CONFIG.GREENHOUSE_BASE_URL;
  private auth: string;

  constructor() {
    this.auth = Buffer.from(`${CONFIG.GREENHOUSE_API_KEY}:`).toString('base64');
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Basic ${this.auth}`,
      'On-Behalf-Of': CONFIG.GREENHOUSE_USER_ID,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = 5;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retries < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, retries + 1), 30000);
        console.log(`Rate limited (429) on ${endpoint}. Retry ${retries + 1}/${maxRetries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
        return this.request<T>(endpoint, options, retries + 1);
      }
      
      const errorText = await response.text();
      throw new Error(`Greenhouse API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private async requestWithHeaders<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 0
  ): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = 5;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retries < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, retries + 1), 30000);
        console.log(`Rate limited (429) on ${endpoint}. Retry ${retries + 1}/${maxRetries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
        return this.requestWithHeaders<T>(endpoint, options, retries + 1);
      }
      
      const errorText = await response.text();
      throw new Error(`Greenhouse API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { data, headers: response.headers };
  }

  // Parse total count from Link header
  private parseTotalFromLinkHeader(linkHeader: string | null, perPage: number): number | null {
    if (!linkHeader) return null;
    
    // Link header format: <url>; rel="last", <url>; rel="next", etc.
    const lastMatch = linkHeader.match(/page=(\d+)[^>]*>;\s*rel="last"/);
    if (lastMatch) {
      const lastPage = parseInt(lastMatch[1], 10);
      return lastPage * perPage;
    }
    return null;
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    const jobs = await this.request<GreenhouseJob[]>('/jobs?per_page=500');
    
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      departments: job.departments,
      offices: job.offices,
    }));
  }

  async getJobStages(jobId: number): Promise<GreenhouseStage[]> {
    return this.request<GreenhouseStage[]>(`/jobs/${jobId}/stages`);
  }

  // Candidates
  async getCandidate(candidateId: number): Promise<GreenhouseCandidate> {
    return this.request<GreenhouseCandidate>(`/candidates/${candidateId}`);
  }

  // Get total count for applications with given filters
  private async getApplicationsCount(
    jobId: number,
    status: string,
    stageId?: number
  ): Promise<number> {
    const queryParams = new URLSearchParams({
      job_id: jobId.toString(),
      per_page: '1',
      page: '1',
      status,
    });

    if (stageId) {
      queryParams.set('stage_id', stageId.toString());
    }

    const { data, headers } = await this.requestWithHeaders<GreenhouseApplication[]>(
      `/applications?${queryParams}`
    );

    const linkHeader = headers.get('link');
    
    // If there's a Link header with "last", use that
    if (linkHeader) {
      const lastMatch = linkHeader.match(/page=(\d+)[^>]*>;\s*rel="last"/);
      if (lastMatch) {
        return parseInt(lastMatch[1], 10);
      }
    }
    
    // If no Link header, check if we got data
    return data.length;
  }

  // Applications
  // NOTE: Greenhouse API stage_id filter is broken - doesn't actually filter.
  // We filter client-side after fetching.
  async getApplications(
    jobId: number,
    options: { page?: number; per_page?: number; status?: string; stage_id?: number } = {}
  ): Promise<{ applications: Application[]; total: number }> {
    const { page = 1, per_page = 20, status = 'active', stage_id } = options;
    
    const queryParams = new URLSearchParams({
      job_id: jobId.toString(),
      page: page.toString(),
      per_page: per_page.toString(),
      status,
    });

    const [applicationsResult, total] = await Promise.all([
      this.requestWithHeaders<GreenhouseApplication[]>(`/applications?${queryParams}`),
      this.getApplicationsCount(jobId, status, stage_id),
    ]);

    const applications = applicationsResult.data;

    // Process in batches to avoid rate limiting
    const enrichedApplications = await batchProcess(
      applications,
      async (app) => {
        const candidate = await this.getCandidate(app.candidate_id);
        return this.transformApplication(app, candidate);
      },
      5,  // 5 candidates at a time
      300 // 300ms delay between batches
    );

    // Client-side filter by stage (Greenhouse API filter is broken)
    const filtered = stage_id
      ? enrichedApplications.filter(app => app.current_stage?.id === stage_id)
      : enrichedApplications;

    // Sort by applied_at descending (newest first)
    filtered.sort((a, b) => {
      const dateA = a.applied_at ? new Date(a.applied_at).getTime() : 0;
      const dateB = b.applied_at ? new Date(b.applied_at).getTime() : 0;
      return dateB - dateA;
    });

    console.log(`Fetched ${enrichedApplications.length}, filtered to ${filtered.length} for stage ${stage_id || 'all'}`);

    return {
      applications: filtered,
      total,
    };
  }

  // Lightweight fetch for export/indexing - no candidate enrichment needed
  // Uses attachments directly from the /applications endpoint (available since Sept 2020)
  async getApplicationsLightweight(
    jobId: number,
    options: { page?: number; per_page?: number; status?: string } = {}
  ): Promise<{ applications: LightweightApplication[]; hasMore: boolean }> {
    const { page = 1, per_page = 100, status = 'active' } = options;
    
    const queryParams = new URLSearchParams({
      job_id: jobId.toString(),
      page: page.toString(),
      per_page: per_page.toString(),
      status,
    });

    const rawApplications = await this.request<GreenhouseApplication[]>(
      `/applications?${queryParams}`
    );

    const applications: LightweightApplication[] = rawApplications.map(app => {
      // Get candidate name from embedded candidate object or fall back to IDs
      const firstName = app.candidate?.first_name || '';
      const lastName = app.candidate?.last_name || '';
      const candidateName = firstName || lastName 
        ? `${firstName} ${lastName}`.trim()
        : `Candidate ${app.candidate_id}`;

      // Get attachments directly from application response
      const resume = app.attachments?.find(a => a.type === 'resume');
      const coverLetter = app.attachments?.find(a => a.type === 'cover_letter');

      return {
        id: app.id,
        candidate_id: app.candidate_id,
        candidate_name: candidateName,
        current_stage: app.current_stage,
        resume_url: resume?.url,
        cover_letter_url: coverLetter?.url,
        answers: app.answers || [],
      };
    });

    return {
      applications,
      hasMore: rawApplications.length === per_page,
    };
  }

  private transformApplication(
    app: GreenhouseApplication,
    candidate: GreenhouseCandidate
  ): Application {
    const primaryEmail = candidate.email_addresses.find((e) => e.type === 'personal')
      || candidate.email_addresses[0];
    const primaryPhone = candidate.phone_numbers.find((p) => p.type === 'mobile')
      || candidate.phone_numbers[0];

    const resume = candidate.attachments.find((a) => a.type === 'resume');
    const coverLetter = candidate.attachments.find((a) => a.type === 'cover_letter');

    return {
      id: app.id,
      candidate_id: app.candidate_id,
      candidate: {
        id: candidate.id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        email: primaryEmail?.value || '',
        phone: primaryPhone?.value,
      },
      applied_at: app.applied_at,
      source: app.source
        ? { id: app.source.id, name: app.source.public_name }
        : null,
      current_stage: app.current_stage,
      answers: app.answers,
      attachments: {
        resume: resume?.url,
        cover_letter: coverLetter?.url,
      },
    };
  }

  // Rejection Reasons
  async getRejectionReasons(): Promise<GreenhouseRejectionReason[]> {
    return this.request<GreenhouseRejectionReason[]>('/rejection_reasons');
  }

  // Email Templates
  async getEmailTemplates(): Promise<Array<{ id: number; name: string; type: string }>> {
    const templates = await this.request<Array<{ id: number; name: string; type: string }>>(
      '/email_templates?per_page=500'
    );
    // Filter to only rejection-type templates
    return templates.filter(t => 
      t.type === 'candidate_rejection' || 
      t.type === 'rejection' ||
      t.name.toLowerCase().includes('reject')
    );
  }

  // Actions
  async rejectApplication(
    applicationId: number,
    rejectionReasonId: number,
    emailTemplateId?: number
  ): Promise<void> {
    const body: Record<string, unknown> = {
      rejection_reason_id: rejectionReasonId,
    };

    if (emailTemplateId) {
      body.rejection_email = {
        email_template_id: emailTemplateId,
        send_email_at: null, // Send immediately
      };
    }

    await this.request(`/applications/${applicationId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async advanceApplication(
    applicationId: number,
    fromStageId: number
  ): Promise<void> {
    await this.request(`/applications/${applicationId}/advance`, {
      method: 'POST',
      body: JSON.stringify({ from_stage_id: fromStageId }),
    });
  }
}

export const greenhouseAPI = new GreenhouseAPI();
