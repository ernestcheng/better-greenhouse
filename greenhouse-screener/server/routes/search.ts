import { Router } from 'express';
import { greenhouseAPI } from '../services/greenhouse.js';
import { 
  checkEmbeddingStatus, 
  indexCandidate, 
  searchCandidates, 
  getIndexStatus,
  clearIndex,
} from '../services/embeddings.js';
import { generateHighlights } from '../services/claude.js';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import type { LightweightApplication, HighlightedCandidate } from '../types.js';

const router = Router();

// Helper: sleep with promise
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Fetch all applications for a job with 429 retry handling (FULL - with candidate enrichment)
// Use this for the UI where we need email/phone information
async function fetchAllApplications(
  jobId: number, 
  status: 'active' | 'hired' | 'rejected' = 'active',
  logPrefix: string = '',
  onProgress?: (page: number, fetchedCount: number) => void
): Promise<any[]> {
  const allApplications: any[] = [];
  let page = 1;
  const perPage = 100; // Max page size for Greenhouse API
  
  while (true) {
    let retries = 0;
    const maxRetries = 5;
    let result: any = null;
    
    while (retries < maxRetries) {
      try {
        console.log(`${logPrefix}Fetching page ${page} (${allApplications.length} fetched so far)...`);
        onProgress?.(page, allApplications.length);
        
        result = await greenhouseAPI.getApplications(jobId, { 
          page, 
          per_page: perPage,
          status 
        });
        break; // Success, exit retry loop
      } catch (error: any) {
        if (error.message?.includes('429')) {
          retries++;
          const backoffMs = Math.min(1000 * Math.pow(2, retries), 30000); // Exponential backoff, max 30s
          console.log(`${logPrefix}Rate limited (429). Retry ${retries}/${maxRetries} after ${backoffMs}ms...`);
          await sleep(backoffMs);
        } else {
          throw error; // Re-throw non-429 errors
        }
      }
    }
    
    if (!result) {
      throw new Error('Max retries exceeded due to rate limiting');
    }
    
    allApplications.push(...result.applications);
    
    if (result.applications.length < perPage) break;
    page++;
    
    // Small delay between pages to be nice to the API
    await sleep(500);
  }
  
  // Final progress update with total count
  onProgress?.(page, allApplications.length);
  
  return allApplications;
}

// Helper: Fetch all applications LIGHTWEIGHT (no candidate enrichment - ~90% fewer API calls)
// Use this for export/indexing where we only need resume URLs, not email/phone
async function fetchAllApplicationsLightweight(
  jobId: number,
  status: 'active' | 'hired' | 'rejected' = 'active',
  logPrefix: string = '',
  onProgress?: (page: number, fetchedCount: number) => void
): Promise<LightweightApplication[]> {
  const allApplications: LightweightApplication[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    let retries = 0;
    const maxRetries = 5;
    let result: { applications: LightweightApplication[]; hasMore: boolean } | null = null;
    
    while (retries < maxRetries) {
      try {
        console.log(`${logPrefix}Fetching page ${page} (${allApplications.length} fetched so far) [lightweight]...`);
        onProgress?.(page, allApplications.length);
        
        result = await greenhouseAPI.getApplicationsLightweight(jobId, { 
          page, 
          per_page: perPage,
          status 
        });
        break;
      } catch (error: any) {
        if (error.message?.includes('429')) {
          retries++;
          const backoffMs = Math.min(1000 * Math.pow(2, retries), 30000);
          console.log(`${logPrefix}Rate limited (429). Retry ${retries}/${maxRetries} after ${backoffMs}ms...`);
          await sleep(backoffMs);
        } else {
          throw error;
        }
      }
    }
    
    if (!result) {
      throw new Error('Max retries exceeded due to rate limiting');
    }
    
    allApplications.push(...result.applications);
    
    if (!result.hasMore) break;
    page++;
    
    // Small delay between pages
    await sleep(300);
  }
  
  // Final progress update
  onProgress?.(page, allApplications.length);
  
  return allApplications;
}

// GET /api/search/status - Check if embedding service is available
router.get('/status', async (req, res) => {
  try {
    const status = await checkEmbeddingStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ available: false, error: error.message });
  }
});

// GET /api/search/index/:jobId - Get index status for a job
router.get('/index/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const status = getIndexStatus(jobId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch and extract text from resume URL
async function extractResumeText(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Failed to fetch resume: ${response.status}`);
      return '';
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const urlLower = url.toLowerCase();
    
    // Handle PDF
    if (urlLower.includes('.pdf')) {
      try {
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = result.pages.map(p => p.text).join('\n');
        console.log(`Extracted ${text.length} chars from PDF`);
        await parser.destroy();
        return text;
      } catch (error) {
        console.error('PDF extraction failed:', error);
        return '';
      }
    }
    
    // Handle DOCX
    if (urlLower.includes('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        console.log(`Extracted ${result.value.length} chars from DOCX`);
        return result.value;
      } catch (error) {
        console.error('DOCX extraction failed:', error);
        return '';
      }
    }
    
    // Handle DOC
    if (urlLower.includes('.doc')) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        console.log(`Extracted ${result.value.length} chars from DOC`);
        return result.value;
      } catch (error) {
        console.error('DOC extraction failed:', error);
        return '';
      }
    }
    
    // Plain text
    const text = new TextDecoder().decode(buffer);
    console.log(`Extracted ${text.length} chars as plain text`);
    return text;
  } catch (error) {
    console.error('Error extracting resume text:', error);
    return '';
  }
}

// POST /api/search/index/:jobId - Build index for all candidates with SSE progress
router.post('/index/:jobId', async (req, res) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const jobId = parseInt(req.params.jobId, 10);
    
    sendEvent('status', { phase: 'init', message: 'Checking embedding service...' });
    
    // Check embedding service status first
    const embeddingStatus = await checkEmbeddingStatus();
    if (!embeddingStatus.available) {
      sendEvent('error', { message: embeddingStatus.error || 'Embedding service not available' });
      res.end();
      return;
    }
    
    sendEvent('status', { phase: 'init', message: 'Loading embedding model...' });
    
    // Get job info
    const jobs = await greenhouseAPI.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      sendEvent('error', { message: 'Job not found' });
      res.end();
      return;
    }
    
    sendEvent('status', { phase: 'fetching', message: 'Fetching applications (lightweight)...' });
    
    // Get all applications for the job using LIGHTWEIGHT fetch (no candidate enrichment needed)
    // This reduces API calls by ~90% since we don't fetch /candidates for each application
    const allApplications = await fetchAllApplicationsLightweight(
      jobId, 
      'active', 
      '[Index] ',
      (page, count) => {
        sendEvent('fetching', { page, fetched: count, message: `Fetching page ${page}... (${count} applications)` });
      }
    );
    
    // Filter to Application Review stage (like the UI does)
    const filteredApplications = allApplications.filter(app => {
      const stageName = app.current_stage?.name?.toLowerCase() || '';
      return stageName.includes('application review');
    });
    
    const total = filteredApplications.length;
    console.log(`[Index] Filtered ${allApplications.length} applications to ${total} in Application Review`);
    
    sendEvent('status', { 
      phase: 'processing', 
      message: `Indexing ${total} candidates...`,
      total 
    });
    
    // Clear existing index
    clearIndex(jobId);
    
    // Process in parallel batches
    // Now that we've eliminated per-candidate API calls, we can be more aggressive with parallelism
    const BATCH_SIZE = 25; // PDF extraction + embedding generation
    let indexed = 0;
    let failed = 0;
    
    for (let i = 0; i < filteredApplications.length; i += BATCH_SIZE) {
      const batch = filteredApplications.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (app) => {
          // Extract resume text if available
          let resumeText = '';
          if (app.resume_url) {
            resumeText = await extractResumeText(app.resume_url);
          }
          
          await indexCandidate(
            jobId,
            job.name,
            app.id,
            app.candidate_name,
            resumeText,
            app.answers
          );
          
          return app.candidate_name;
        })
      );
      
      // Count results
      const batchNames: string[] = [];
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          indexed++;
          batchNames.push(result.value);
        } else {
          failed++;
          console.error('Failed to index:', result.reason);
        }
      }
      
      // Send progress update
      const processed = Math.min(i + BATCH_SIZE, total);
      sendEvent('progress', { 
        processed, 
        total,
        percent: Math.round((processed / total) * 100),
        indexed,
        failed,
        current: batchNames.join(', ')
      });
      
      console.log(`[Index] Processed ${processed}/${total}`);
    }
    
    sendEvent('status', { phase: 'complete', message: 'Indexing complete!' });
    sendEvent('complete', { 
      success: true, 
      indexed, 
      failed, 
      total 
    });
    res.end();
    
  } catch (error: any) {
    console.error('Error building index:', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// POST /api/search/:jobId - Search candidates
router.post('/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const { query, limit = 20 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await searchCandidates(jobId, query, limit);
    res.json({ results });
  } catch (error: any) {
    console.error('Error searching:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/search/index/:jobId - Clear index for a job
router.delete('/index/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    clearIndex(jobId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/search/export/:jobId - Export all resumes as JSON with SSE progress
router.get('/export/:jobId', async (req, res) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const jobId = parseInt(req.params.jobId, 10);
    
    sendEvent('status', { phase: 'init', message: 'Starting export...' });
    
    // Get job info
    const jobs = await greenhouseAPI.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      sendEvent('error', { message: 'Job not found' });
      res.end();
      return;
    }
    
    sendEvent('status', { phase: 'fetching', message: 'Fetching applications (lightweight)...' });
    
    // Get all applications for the job using LIGHTWEIGHT fetch (no candidate enrichment needed)
    // This reduces API calls by ~90% since we don't fetch /candidates for each application
    const allApplications = await fetchAllApplicationsLightweight(
      jobId, 
      'active', 
      '[Export] ',
      (page, count) => {
        sendEvent('fetching', { page, fetched: count, message: `Fetching page ${page}... (${count} applications)` });
      }
    );
    
    // Filter to Application Review stage (like the UI does)
    const filteredApplications = allApplications.filter(app => {
      const stageName = app.current_stage?.name?.toLowerCase() || '';
      return stageName.includes('application review');
    });
    
    console.log(`[Export] Filtered ${allApplications.length} applications to ${filteredApplications.length} in Application Review`);
    const total = filteredApplications.length;
    
    sendEvent('status', { 
      phase: 'processing', 
      message: `Processing ${total} candidates...`,
      total 
    });
    
    console.log(`[Export] Processing ${total} candidates for job: ${job.name}`);
    
    // Process in parallel batches
    // Now that we've eliminated per-candidate API calls, we can be more aggressive with parallelism
    const BATCH_SIZE = 50; // PDF/docx extraction is I/O bound, can parallelize heavily
    const exportData: Array<{
      application_id: number;
      candidate_id: number;
      candidate_name: string;
      greenhouse_url: string;
      resume_text: string;
      cover_letter_text: string;
      answers: Array<{ question: string; answer: string }>;
      current_stage: string | null;
    }> = [];
    
    for (let i = 0; i < filteredApplications.length; i += BATCH_SIZE) {
      const batch = filteredApplications.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (app) => {
          // Extract resume and cover letter in parallel
          const [resumeText, coverLetterText] = await Promise.all([
            app.resume_url ? extractResumeText(app.resume_url) : Promise.resolve(''),
            app.cover_letter_url ? extractResumeText(app.cover_letter_url) : Promise.resolve(''),
          ]);
          
          return {
            application_id: app.id,
            candidate_id: app.candidate_id,
            candidate_name: app.candidate_name,
            greenhouse_url: `https://app4.greenhouse.io/people/${app.candidate_id}/applications/${app.id}`,
            resume_text: resumeText,
            cover_letter_text: coverLetterText,
            answers: app.answers,
            current_stage: app.current_stage?.name || null,
          };
        })
      );
      
      exportData.push(...batchResults);
      
      // Send progress update
      const processed = Math.min(i + BATCH_SIZE, total);
      sendEvent('progress', { 
        processed, 
        total,
        percent: Math.round((processed / total) * 100),
        current: batchResults.map(r => r.candidate_name).join(', ')
      });
      
      console.log(`[Export] Processed ${processed}/${total}`);
    }
    
    // Build final result
    const result = {
      job_id: jobId,
      job_name: job.name,
      exported_at: new Date().toISOString(),
      total_candidates: exportData.length,
      candidates: exportData,
    };
    
    sendEvent('status', { phase: 'complete', message: 'Export complete!' });
    sendEvent('complete', result);
    res.end();
    
  } catch (error: any) {
    console.error('Error exporting resumes:', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// GET /api/search/highlights/:jobId - Generate AI highlights (top candidates) with SSE progress
router.get('/highlights/:jobId', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const jobId = parseInt(req.params.jobId, 10);
    const topN = parseInt(req.query.top_n as string) || 100;
    const jobRequirements = req.query.requirements as string || '';
    
    sendEvent('status', { phase: 'init', message: 'Starting highlights generation...' });
    
    // Get job info
    const jobs = await greenhouseAPI.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      sendEvent('error', { message: 'Job not found' });
      res.end();
      return;
    }
    
    sendEvent('status', { phase: 'fetching', message: 'Fetching applications...' });
    
    // Fetch all applications lightweight
    const allApplications = await fetchAllApplicationsLightweight(
      jobId, 
      'active', 
      '[Highlights] ',
      (page, count) => {
        sendEvent('fetching', { page, fetched: count, message: `Fetching page ${page}... (${count} applications)` });
      }
    );
    
    // Filter to Application Review stage
    const filteredApplications = allApplications.filter(app => {
      const stageName = app.current_stage?.name?.toLowerCase() || '';
      return stageName.includes('application review');
    });
    
    const total = filteredApplications.length;
    console.log(`[Highlights] Filtered to ${total} candidates in Application Review`);
    
    sendEvent('status', { 
      phase: 'extracting', 
      message: `Extracting resumes from ${total} candidates...`,
      total 
    });
    
    // Extract resume text for all candidates
    const BATCH_SIZE = 50;
    const candidatesData: Array<{
      application_id: number;
      candidate_id: number;
      candidate_name: string;
      greenhouse_url: string;
      resume_text: string;
      answers: Array<{ question: string; answer: string }>;
    }> = [];
    
    for (let i = 0; i < filteredApplications.length; i += BATCH_SIZE) {
      const batch = filteredApplications.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (app) => {
          const resumeText = app.resume_url ? await extractResumeText(app.resume_url) : '';
          
          return {
            application_id: app.id,
            candidate_id: app.candidate_id,
            candidate_name: app.candidate_name,
            greenhouse_url: `https://app4.greenhouse.io/people/${app.candidate_id}/applications/${app.id}`,
            resume_text: resumeText,
            answers: app.answers,
          };
        })
      );
      
      candidatesData.push(...batchResults);
      
      const processed = Math.min(i + BATCH_SIZE, total);
      sendEvent('progress', { 
        processed, 
        total,
        percent: Math.round((processed / total) * 100),
        message: `Extracted ${processed}/${total} resumes`
      });
    }
    
    sendEvent('status', { 
      phase: 'analyzing', 
      message: `Analyzing ${total} candidates in batches...` 
    });
    
    // Generate highlights with Claude using batched tournament approach
    const highlights = await generateHighlights({
      job_title: job.name,
      job_requirements: jobRequirements,
      candidates: candidatesData,
      top_n: Math.min(topN, total),
      onBatchProgress: (batch, totalBatches, winnersFound) => {
        sendEvent('batch', { 
          batch, 
          totalBatches, 
          winnersFound,
          message: `Batch ${batch}/${totalBatches}: ${winnersFound} potential winners found`
        });
      },
    });
    
    const result = {
      job_id: jobId,
      job_name: job.name,
      total_candidates: total,
      highlighted_count: highlights.length,
      generated_at: new Date().toISOString(),
      highlights,
    };
    
    sendEvent('status', { phase: 'complete', message: `Found ${highlights.length} top candidates!` });
    sendEvent('complete', result);
    res.end();
    
  } catch (error: any) {
    console.error('Error generating highlights:', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
});

export default router;
