import { Router } from 'express';
import { createRequire } from 'module';
import { greenhouseAPI } from '../services/greenhouse.js';
import { 
  checkEmbeddingStatus, 
  indexCandidate, 
  searchCandidates, 
  getIndexStatus,
  clearIndex,
} from '../services/embeddings.js';
import mammoth from 'mammoth';

// pdf-parse doesn't support ESM, use require
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const router = Router();

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
        const data = await pdf(buffer);
        console.log(`Extracted ${data.text.length} chars from PDF`);
        return data.text;
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

// POST /api/search/index/:jobId - Build index for all candidates in a job
router.post('/index/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    
    // Check embedding service status first
    const embeddingStatus = await checkEmbeddingStatus();
    if (!embeddingStatus.available) {
      return res.status(503).json({ error: embeddingStatus.error });
    }
    
    // Get job info
    const jobs = await greenhouseAPI.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    // Get all applications for the job (paginate through all with rate limiting)
    let allApplications: any[] = [];
    let page = 1;
    const perPage = 20; // Smaller batches to avoid rate limits
    
    while (true) {
      console.log(`Fetching page ${page} of applications...`);
      const result = await greenhouseAPI.getApplications(jobId, { 
        page, 
        per_page: perPage,
        status: 'active' 
      });
      allApplications.push(...result.applications);
      
      if (result.applications.length < perPage) break;
      page++;
      // Delay between pages to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Indexing ${allApplications.length} candidates for job: ${job.name}`);
    
    // Clear existing index
    clearIndex(jobId);
    
    // Index each candidate
    let indexed = 0;
    let failed = 0;
    
    for (const app of allApplications) {
      try {
        const candidateName = `${app.candidate.first_name} ${app.candidate.last_name}`;
        
        // Extract resume text if available
        let resumeText = '';
        if (app.attachments.resume) {
          resumeText = await extractResumeText(app.attachments.resume);
        }
        
        await indexCandidate(
          jobId,
          job.name,
          app.id,
          candidateName,
          resumeText,
          app.answers || []
        );
        indexed++;
      } catch (error) {
        console.error(`Failed to index application ${app.id}:`, error);
        failed++;
      }
    }
    
    res.json({ 
      success: true, 
      indexed, 
      failed, 
      total: allApplications.length 
    });
  } catch (error: any) {
    console.error('Error building index:', error);
    res.status(500).json({ error: error.message });
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

export default router;
