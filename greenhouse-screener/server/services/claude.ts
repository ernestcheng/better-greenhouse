import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { CONFIG } from '../config.js';
import type { ScreeningRequest, ScreeningResult, HighlightedCandidate } from '../types.js';

const anthropic = new Anthropic({
  apiKey: CONFIG.ANTHROPIC_API_KEY,
  timeout: 300000, // 5 minute timeout for large requests
  maxRetries: 0, // We handle retries ourselves
});

const SYSTEM_PROMPT = `You are an extremely critical technical recruiter screening candidates for: {job_title}

## Job Requirements
{job_requirements}

## Your Mindset
You are HIGHLY SELECTIVE. Your job is to protect the hiring team's time by filtering out anyone who isn't an exceptional fit. 

- Assume most candidates are NOT qualified until proven otherwise
- A generic resume with buzzwords is a RED flag, not neutral
- "Potential" doesn't count - you need EVIDENCE of relevant accomplishments  
- Missing information = assume the worst (if they had it, they'd mention it)
- Years of experience at mediocre companies < 1 year at a top company with impact
- Be skeptical of inflated titles and vague job descriptions

## Response Format (JSON)
Respond with a JSON array containing an object for each candidate:

\`\`\`json
[
  {
    "application_id": 12345,
    "recommendation": "GREEN",
    "confidence": "HIGH",
    "summary": "Senior data scientist from Google with 5 years ML experience, built recommendation systems serving 100M users",
    "key_factors": [
      "Led A/B testing platform at Stripe, ran 200+ experiments",
      "Built customer segmentation model at Airbnb increasing conversion 15%",
      "Expert in Python, SQL, Spark - published paper on causal inference"
    ],
    "concerns": ["No direct marketing analytics experience"],
    "reasoning": "Strong technical foundation from top companies. Google and Stripe experience shows ability to work at scale. A/B testing expertise directly relevant."
  }
]
\`\`\`

## BE SPECIFIC - Include Real Details
- summary: Mention their current/most impressive company, years of experience, and ONE concrete achievement
- key_factors: Name actual companies, specific projects, real metrics, and concrete skills they demonstrated
- concerns: Be brutally honest about gaps, red flags, and missing qualifications
- reasoning: Explain exactly why they pass or fail the bar

AVOID generic statements like "strong technical skills" or "good communication". Instead write "built fraud detection system at PayPal processing $1B/day" or "presented quarterly insights to C-suite at Salesforce".

## RED FLAGS to watch for
- Vague descriptions without metrics or outcomes
- Job hopping without progression
- No evidence of the specific skills required
- Buzzword-heavy resume with no substance
- Projects that sound impressive but lack detail on their actual contribution
- "Familiar with" or "exposure to" instead of hands-on experience

## Rules
- recommendation: "GREEN" or "RED" only
- confidence: "HIGH", "MEDIUM", or "LOW"  
- GREEN = Exceptional candidate who clearly meets requirements with EVIDENCE
- RED = Anyone who doesn't clearly prove they're qualified
- When in doubt, RED. The hiring team's time is precious.
- Include ALL candidates in your response
- Return valid JSON`;

// Document content types
type DocumentContent = 
  | { type: 'pdf'; base64: string }
  | { type: 'text'; content: string };

// Fetch document and process based on type
async function fetchDocument(url: string): Promise<DocumentContent | null> {
  try {
    console.log('Fetching document:', url.substring(0, 100) + '...');
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Failed to fetch document:', response.status);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const urlLower = url.toLowerCase();
    const contentType = response.headers.get('content-type') || '';
    
    // Handle PDF - send as document attachment
    if (urlLower.includes('.pdf') || contentType.includes('pdf')) {
      const base64 = Buffer.from(buffer).toString('base64');
      console.log('PDF document fetched, size:', buffer.byteLength, 'bytes');
      return { type: 'pdf', base64 };
    }
    
    // Handle DOCX - extract text using mammoth
    if (urlLower.includes('.docx') || contentType.includes('wordprocessingml')) {
      console.log('DOCX document fetched, extracting text...');
      try {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        console.log('Extracted text length:', result.value.length, 'chars');
        return { type: 'text', content: result.value };
      } catch (e) {
        console.error('Failed to extract text from DOCX:', e);
        return null;
      }
    }
    
    // Handle DOC - try mammoth (works for some .doc files)
    if (urlLower.includes('.doc') || contentType.includes('msword')) {
      console.log('DOC document fetched, attempting to extract text...');
      try {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        console.log('Extracted text length:', result.value.length, 'chars');
        return { type: 'text', content: result.value };
      } catch (e) {
        console.error('Failed to extract text from DOC:', e);
        return null;
      }
    }
    
    // Handle plain text
    if (urlLower.includes('.txt') || contentType.includes('text/plain')) {
      const text = new TextDecoder().decode(buffer);
      return { type: 'text', content: text };
    }
    
    // Unknown format - try to read as text
    console.log('Unknown document format, attempting to read as text');
    try {
      const text = new TextDecoder().decode(buffer);
      if (text && text.length > 0) {
        return { type: 'text', content: text };
      }
    } catch {
      // Ignore
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching document:', error);
    return null;
  }
}

interface ApplicationWithDocs {
  application: ScreeningRequest['applications'][number];
  resumeDoc: DocumentContent | null;
  coverLetterDoc: DocumentContent | null;
}

async function prepareApplicationDocs(
  applications: ScreeningRequest['applications']
): Promise<ApplicationWithDocs[]> {
  return Promise.all(
    applications.map(async (application) => {
      const resumeDoc = application.resume_url 
        ? await fetchDocument(application.resume_url)
        : null;
      const coverLetterDoc = application.cover_letter_url
        ? await fetchDocument(application.cover_letter_url)
        : null;
      
      return { application, resumeDoc, coverLetterDoc };
    })
  );
}

function buildUserPrompt(
  application: ScreeningRequest['applications'][number],
  resumeDoc: DocumentContent | null,
  coverLetterDoc: DocumentContent | null
): string {
  let prompt = `## Candidate: ${application.candidate_name}
Application ID: ${application.application_id}

### Application Answers`;

  if (application.answers.length > 0) {
    for (const qa of application.answers) {
      prompt += `\n**${qa.question}**\n${qa.answer}\n`;
    }
  } else {
    prompt += '\nNo application answers provided.\n';
  }

  // Handle resume
  if (resumeDoc) {
    if (resumeDoc.type === 'pdf') {
      prompt += `\n### Resume\nThe candidate's resume PDF is attached above. Please analyze it carefully.`;
    } else {
      // For text-extracted content (from DOCX), include it inline
      prompt += `\n### Resume Content\n${resumeDoc.content}`;
    }
  } else if (application.resume_url) {
    prompt += `\n### Resume\nResume file could not be processed.`;
  } else {
    prompt += `\n### Resume\nNo resume provided.`;
  }

  // Handle cover letter
  if (coverLetterDoc) {
    if (coverLetterDoc.type === 'pdf') {
      prompt += `\n### Cover Letter\nThe candidate's cover letter PDF is attached above.`;
    } else {
      prompt += `\n### Cover Letter Content\n${coverLetterDoc.content}`;
    }
  }

  return prompt;
}

function parseScreeningResponse(content: string): ScreeningResult[] {
  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/);
  const jsonContent = jsonMatch ? jsonMatch[1] : content;

  try {
    const parsed = JSON.parse(jsonContent.trim());
    
    // Handle both single object and array formats
    const results = Array.isArray(parsed) ? parsed : [parsed];
    
    return results.map((result: Record<string, unknown>) => ({
      application_id: Number(result.application_id),
      recommendation: (result.recommendation as string)?.toUpperCase() as 'GREEN' | 'RED',
      confidence: (result.confidence as string)?.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
      summary: String(result.summary || ''),
      key_factors: Array.isArray(result.key_factors)
        ? result.key_factors.map(String)
        : [],
      concerns: Array.isArray(result.concerns)
        ? result.concerns.map(String)
        : [],
      reasoning: String(result.reasoning || ''),
    }));
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    console.error('Content:', content);
    throw new Error('Failed to parse screening response');
  }
}

// Format feedback for prompt inclusion
function formatFeedbackSection(feedback: ScreeningRequest['feedback']): string {
  if (!feedback || feedback.length === 0) return '';

  const examples = feedback.map(f => {
    const action = f.user_decision === 'ADVANCE' ? 'ADVANCED (you said RED)' : 'REJECTED (you said GREEN)';
    return `- ${f.candidate_name}: You recommended ${f.llm_recommendation}, but I ${action}. Reason: "${f.user_reason}"`;
  });

  return `

## CALIBRATION FROM PAST DECISIONS
I've disagreed with some of your past recommendations. LEARN FROM THESE CORRECTIONS:

${examples.join('\n')}

Adjust your calibration based on this feedback. If you've been too lenient or too strict on certain criteria, correct accordingly.
`;
}

export async function screenApplications(
  request: ScreeningRequest
): Promise<ScreeningResult[]> {
  const feedbackSection = formatFeedbackSection(request.feedback);
  const systemPrompt = SYSTEM_PROMPT
    .replace('{job_title}', request.job_title)
    .replace('{job_requirements}', request.job_requirements || 'No specific requirements provided.')
    + feedbackSection;

  // Fetch all documents in parallel
  console.log(`Preparing documents for ${request.applications.length} candidates...`);
  const appsWithDocs = await prepareApplicationDocs(request.applications);

  // Build content array with documents and text
  // Note: Using 'any' for content array because Anthropic SDK types may not include 'document' type yet
  const content: any[] = [];

  for (const { application, resumeDoc, coverLetterDoc } of appsWithDocs) {
    // Add resume PDF document if available (only PDFs can be attached)
    if (resumeDoc?.type === 'pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: resumeDoc.base64,
        },
      });
    }

    // Add cover letter PDF if available
    if (coverLetterDoc?.type === 'pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: coverLetterDoc.base64,
        },
      });
    }

    // Add text prompt for this candidate (includes extracted text for non-PDFs)
    const textPrompt = buildUserPrompt(application, resumeDoc, coverLetterDoc);
    content.push({
      type: 'text',
      text: textPrompt,
    });

    // Add separator between candidates
    content.push({
      type: 'text',
      text: '\n\n---\n\n',
    });
  }

  // Add final instruction
  content.push({
    type: 'text',
    text: `Please analyze all ${request.applications.length} candidates above and provide your screening recommendations in the specified YAML format.`,
  });

  console.log('Sending to Claude...');
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  });

  // Extract text content from response
  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  console.log('Parsing response...');
  const results = parseScreeningResponse(textContent.text);

  // Validate that we got results for all applications
  const resultIds = new Set(results.map((r) => r.application_id));
  const missingIds = request.applications
    .filter((a) => !resultIds.has(a.application_id))
    .map((a) => a.application_id);

  if (missingIds.length > 0) {
    console.warn(`Missing screening results for applications: ${missingIds.join(', ')}`);
  }

  return results;
}

// ============================================================================
// HIGHLIGHTS - Rank all candidates and return top N
// ============================================================================

const HIGHLIGHTS_SYSTEM_PROMPT = `You are an expert technical recruiter analyzing candidates for: {job_title}

## Job Requirements
{job_requirements}

## Your Task
I'm attaching a JSON file containing all candidate data (resumes and application answers).
Analyze ALL candidates and identify the TOP {top_n} based on fit for this role.

## Scoring (0-100)
- 90-100: Exceptional, must interview
- 80-89: Strong candidate
- 70-79: Good candidate
- Below 70: Don't include

## Response Format
Return JSON array ranked from best (#1) to #{top_n}:

\`\`\`json
[
  {
    "application_id": 12345,
    "rank": 1,
    "score": 95,
    "summary": "Senior ML Engineer from Google, built recommendation systems at scale",
    "tier": "TOP"
  }
]
\`\`\`

## Tiers
- "TOP": Rank 1-10
- "STRONG": Rank 11-25  
- "GOOD": Rank 26+

## Rules
- Only include candidates scoring 70+
- Be specific in summaries - companies, metrics, achievements
- Maximum {top_n} candidates
- Return valid JSON array`;

export interface CandidateData {
  application_id: number;
  candidate_id: number;
  candidate_name: string;
  greenhouse_url: string;
  resume_text: string;
  answers: Array<{ question: string; answer: string }>;
}

export interface HighlightsInput {
  job_title: string;
  job_requirements: string;
  candidates: CandidateData[];
  top_n: number;
  onBatchProgress?: (batch: number, totalBatches: number, winnersFound: number) => void;
}

// Retry wrapper for API calls
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  label: string = 'API call'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isConnectionError = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('Connection error') ||
        error.message?.includes('socket hang up') ||
        error.cause?.code === 'ECONNRESET';
        
      const isRetryable = 
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        isConnectionError;
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Longer backoff for connection errors (might be server overload)
      const baseBackoff = isConnectionError ? 5000 : 2000;
      const backoffMs = Math.min(baseBackoff * Math.pow(2, attempt - 1), 60000);
      console.log(`[Retry] ${label} failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs / 1000}s...`);
      console.log(`[Retry] Error type: ${isConnectionError ? 'connection' : 'api'}, message: ${error.message || error}`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  throw lastError;
}

// Process a single batch of candidates and return winners
async function processBatch(
  candidates: CandidateData[],
  jobTitle: string,
  jobRequirements: string,
  winnersPerBatch: number,
  batchNum: number,
  totalBatches: number
): Promise<Array<{ application_id: number; score: number; summary: string }>> {
  const systemPrompt = `You are an expert technical recruiter analyzing candidates for: ${jobTitle}

## Job Requirements
${jobRequirements || 'General technical role'}

## Your Task
This is batch ${batchNum} of ${totalBatches}. Analyze these candidates and identify the TOP ${winnersPerBatch} from this batch.

## Response Format
Return JSON array of winners with scores (0-100):

\`\`\`json
[
  {
    "application_id": 12345,
    "score": 95,
    "summary": "Senior ML Engineer from Google, built recommendation systems at scale"
  }
]
\`\`\`

## Rules
- Only include candidates scoring 70+
- Maximum ${winnersPerBatch} candidates
- Be specific in summaries
- Return valid JSON array`;

  // Build candidate text
  let candidateText = '';
  for (const c of candidates) {
    candidateText += `\n---\n### ${c.candidate_name} (ID: ${c.application_id})\n`;
    candidateText += c.resume_text || 'No resume';
    if (c.answers?.length) {
      candidateText += `\nAnswers: ${c.answers.slice(0, 3).map(a => `${a.question}: ${a.answer}`).join('; ')}`;
    }
  }

  const response = await withRetry(
    () => anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Analyze these ${candidates.length} candidates:\n${candidateText}\n\nReturn top ${winnersPerBatch} as JSON.` }],
    }),
    3,
    `Batch ${batchNum}/${totalBatches}`
  );

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  try {
    const jsonMatch = textContent.text.match(/```(?:json)?\n?([\s\S]*?)```/);
    const jsonContent = jsonMatch ? jsonMatch[1] : textContent.text;
    const parsed = JSON.parse(jsonContent.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn(`[Highlights] Failed to parse batch ${batchNum} response`);
    return [];
  }
}

// Final ranking of all winners using Opus
async function rankWinners(
  winners: Array<{ application_id: number; score: number; summary: string; candidate: CandidateData }>,
  jobTitle: string,
  jobRequirements: string,
  topN: number
): Promise<HighlightedCandidate[]> {
  const systemPrompt = HIGHLIGHTS_SYSTEM_PROMPT
    .replace('{job_title}', jobTitle)
    .replace('{job_requirements}', jobRequirements || 'General technical role')
    .replace(/\{top_n\}/g, topN.toString());

  // Build winner text with full details
  // Limit resume length based on number of winners to stay under token limits
  const maxResumePerWinner = Math.min(3000, Math.floor(500000 / winners.length));
  console.log(`[Highlights] Max ${maxResumePerWinner} chars per resume for ${winners.length} winners`);
  
  let winnerText = '';
  for (const w of winners) {
    winnerText += `\n---\n### ${w.candidate.candidate_name} (ID: ${w.application_id})\n`;
    winnerText += `Previous Score: ${w.score}\n`;
    winnerText += `Summary: ${w.summary}\n`;
    const resumeText = w.candidate.resume_text?.substring(0, maxResumePerWinner) || 'No resume';
    winnerText += `Resume: ${resumeText}`;
  }

  const userContent = `Rank these ${winners.length} pre-screened candidates:\n${winnerText}\n\nReturn top ${topN} ranked.`;
  
  console.log(`[Highlights] Final ranking of ${winners.length} winners with Opus 4.5...`);
  console.log(`[Highlights] Request size: system=${systemPrompt.length} chars, user=${userContent.length} chars, total=${(systemPrompt.length + userContent.length) / 1024} KB`);

  const response = await withRetry(
    () => anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
    5, // More retries for the final ranking
    'Final ranking'
  );

  console.log(`[Highlights] Opus response: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text in Claude response');
  }

  const jsonMatch = textContent.text.match(/```(?:json)?\n?([\s\S]*?)```/);
  const jsonContent = jsonMatch ? jsonMatch[1] : textContent.text;
  const parsed = JSON.parse(jsonContent.trim());

  if (!Array.isArray(parsed)) throw new Error('Expected array');

  // Build lookup for candidate info
  const candidateMap = new Map(winners.map(w => [w.application_id, w.candidate]));

  return parsed.map((item: any) => {
    const candidate = candidateMap.get(Number(item.application_id));
    return {
      rank: Number(item.rank),
      application_id: Number(item.application_id),
      candidate_id: candidate?.candidate_id || 0,
      candidate_name: candidate?.candidate_name || 'Unknown',
      greenhouse_url: candidate?.greenhouse_url || '',
      score: Number(item.score),
      summary: String(item.summary || ''),
      tier: (['TOP', 'STRONG', 'GOOD'].includes(item.tier) ? item.tier : 'GOOD') as 'TOP' | 'STRONG' | 'GOOD',
    };
  }).sort((a: HighlightedCandidate, b: HighlightedCandidate) => a.rank - b.rank);
}

export async function generateHighlights(input: HighlightsInput): Promise<HighlightedCandidate[]> {
  const { candidates, job_title, job_requirements, top_n, onBatchProgress } = input;
  
  // Batch size: ~100 candidates per batch to fit in context
  const BATCH_SIZE = 100;
  const numBatches = Math.ceil(candidates.length / BATCH_SIZE);
  const winnersPerBatch = Math.ceil((top_n * 1.5) / numBatches); // Get 1.5x winners to have buffer
  
  console.log(`[Highlights] Processing ${candidates.length} candidates in ${numBatches} batches, ${winnersPerBatch} winners/batch`);
  
  // Phase 1: Process batches to find winners
  const allWinners: Array<{ application_id: number; score: number; summary: string; candidate: CandidateData }> = [];
  
  for (let i = 0; i < numBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batch = candidates.slice(batchStart, batchStart + BATCH_SIZE);
    
    console.log(`[Highlights] Processing batch ${i + 1}/${numBatches} (${batch.length} candidates)...`);
    
    const batchWinners = await processBatch(batch, job_title, job_requirements, winnersPerBatch, i + 1, numBatches);
    
    // Enrich winners with full candidate data
    const candidateMap = new Map(batch.map(c => [c.application_id, c]));
    for (const winner of batchWinners) {
      const candidate = candidateMap.get(winner.application_id);
      if (candidate) {
        allWinners.push({ ...winner, candidate });
      }
    }
    
    console.log(`[Highlights] Batch ${i + 1}: found ${batchWinners.length} winners (total: ${allWinners.length})`);
    onBatchProgress?.(i + 1, numBatches, allWinners.length);
  }
  
  if (allWinners.length === 0) {
    console.log('[Highlights] No winners found in any batch');
    return [];
  }
  
  // Phase 2: Final ranking with Opus
  console.log(`[Highlights] Final ranking of ${allWinners.length} winners...`);
  const finalRanking = await rankWinners(allWinners, job_title, job_requirements, top_n);
  
  console.log(`[Highlights] Complete: ${finalRanking.length} top candidates`);
  return finalRanking;
}
