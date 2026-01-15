import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamic import for @xenova/transformers (ESM compatibility)
let transformersModule: any = null;
async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@xenova/transformers');
    // Configure cache directory
    transformersModule.env.cacheDir = path.join(__dirname, '../../.cache/transformers');
    transformersModule.env.allowLocalModels = true;
    // Ensure cache directory exists
    if (!fs.existsSync(transformersModule.env.cacheDir)) {
      fs.mkdirSync(transformersModule.env.cacheDir, { recursive: true });
    }
  }
  return transformersModule;
}

const EMBEDDINGS_DIR = path.join(__dirname, '../../data/embeddings');

// Ensure embeddings directory exists
if (!fs.existsSync(EMBEDDINGS_DIR)) {
  fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
}

interface EmbeddingRecord {
  application_id: number;
  candidate_name: string;
  text: string;
  embedding: number[];
  indexed_at: string;
}

interface JobIndex {
  job_id: number;
  job_title: string;
  indexed_at: string;
  records: EmbeddingRecord[];
}

// Embedding model - cached after first load
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
let embedder: any = null;
let modelLoading: Promise<any> | null = null;

// Initialize the embedding pipeline (lazy load)
async function getEmbedder() {
  if (embedder) return embedder;
  
  if (!modelLoading) {
    console.log(`Loading embedding model: ${EMBEDDING_MODEL}...`);
    const { pipeline } = await getTransformers();
    modelLoading = pipeline('feature-extraction', EMBEDDING_MODEL);
  }
  
  embedder = await modelLoading;
  console.log('Embedding model loaded.');
  return embedder;
}

// Generate embedding using transformers.js
async function generateEmbedding(text: string): Promise<number[]> {
  const embed = await getEmbedder();
  const output = await embed(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Get index file path for a job
function getIndexPath(jobId: number): string {
  return path.join(EMBEDDINGS_DIR, `job-${jobId}.json`);
}

// Load job index from disk
function loadIndex(jobId: number): JobIndex | null {
  const indexPath = getIndexPath(jobId);
  if (!fs.existsSync(indexPath)) return null;
  
  try {
    const data = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Save job index to disk
function saveIndex(index: JobIndex): void {
  const indexPath = getIndexPath(index.job_id);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

// Check if embedding service is available
export async function checkEmbeddingStatus(): Promise<{ available: boolean; error?: string }> {
  try {
    // Try to load the model - this will download it if needed
    await getEmbedder();
    return { available: true };
  } catch (error: any) {
    return { available: false, error: error.message };
  }
}

// Index a single candidate
export async function indexCandidate(
  jobId: number,
  jobTitle: string,
  applicationId: number,
  candidateName: string,
  resumeText: string,
  answers: Array<{ question: string; answer: string }>
): Promise<void> {
  // Combine resume and answers into searchable text
  const answerText = answers.map(a => `${a.question}: ${a.answer}`).join('\n');
  const fullText = `${candidateName}\n\n${resumeText}\n\n${answerText}`.trim();
  
  if (!fullText || fullText.length < 50) {
    console.log(`Skipping ${candidateName} - insufficient text`);
    return;
  }

  // Truncate to avoid token limits (roughly 8000 chars)
  const truncatedText = fullText.slice(0, 8000);
  
  console.log(`Generating embedding for ${candidateName}...`);
  const embedding = await generateEmbedding(truncatedText);
  
  // Load or create index
  let index = loadIndex(jobId) || {
    job_id: jobId,
    job_title: jobTitle,
    indexed_at: new Date().toISOString(),
    records: [],
  };
  
  // Update or add record
  const existingIdx = index.records.findIndex(r => r.application_id === applicationId);
  const record: EmbeddingRecord = {
    application_id: applicationId,
    candidate_name: candidateName,
    text: truncatedText.slice(0, 500) + '...', // Store preview only
    embedding,
    indexed_at: new Date().toISOString(),
  };
  
  if (existingIdx >= 0) {
    index.records[existingIdx] = record;
  } else {
    index.records.push(record);
  }
  
  index.indexed_at = new Date().toISOString();
  saveIndex(index);
}

// Search candidates by query
export async function searchCandidates(
  jobId: number,
  query: string,
  limit: number = 20
): Promise<Array<{ application_id: number; candidate_name: string; score: number; preview: string }>> {
  const index = loadIndex(jobId);
  if (!index || index.records.length === 0) {
    return [];
  }
  
  console.log(`Searching ${index.records.length} candidates for: "${query}"`);
  const queryEmbedding = await generateEmbedding(query);
  
  // Calculate similarity scores
  const scored = index.records.map(record => ({
    application_id: record.application_id,
    candidate_name: record.candidate_name,
    score: cosineSimilarity(queryEmbedding, record.embedding),
    preview: record.text,
  }));
  
  // Sort by score and return top results
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// Get index status for a job
export function getIndexStatus(jobId: number): { 
  indexed: boolean; 
  count: number; 
  indexed_at?: string 
} {
  const index = loadIndex(jobId);
  if (!index) {
    return { indexed: false, count: 0 };
  }
  return {
    indexed: true,
    count: index.records.length,
    indexed_at: index.indexed_at,
  };
}

// Clear index for a job
export function clearIndex(jobId: number): void {
  const indexPath = getIndexPath(jobId);
  if (fs.existsSync(indexPath)) {
    fs.unlinkSync(indexPath);
  }
}
