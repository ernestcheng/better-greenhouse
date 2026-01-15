import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import { CONFIG } from '../config.js';
import type { ScreeningRequest, ScreeningResult } from '../types.js';

const anthropic = new Anthropic({
  apiKey: CONFIG.ANTHROPIC_API_KEY,
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
  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

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
