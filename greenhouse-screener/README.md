# Greenhouse Resume Screener

AI-powered bulk resume screening for Greenhouse ATS, powered by Claude.

![Greenhouse Screener](https://img.shields.io/badge/Status-Ready-green)

## Features

- **Bulk Screening**: Review 20+ candidates at once with AI-powered recommendations
- **Claude Integration**: Intelligent resume analysis with GREEN/RED recommendations
- **Semantic Search**: Find candidates by skills/experience using local embeddings (no external services)
- **Batch Actions**: Reject or advance multiple candidates simultaneously
- **Keyboard Shortcuts**: Navigate and take actions quickly (j/k/x/Enter/Esc)
- **Smart Filtering**: Filter by screening result, stage, and sort options
- **Detailed Views**: Full resume, cover letter, and application answers

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Express.js, TypeScript
- **APIs**: Greenhouse Harvest API v1, Anthropic Claude API
- **State Management**: TanStack Query (React Query)

## Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```env
# Greenhouse API Configuration
GREENHOUSE_API_KEY=your_harvest_api_key
GREENHOUSE_USER_ID=12345

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Server Configuration
PORT=3001
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Development

Run both frontend and backend in development mode:

```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Express API server on `http://localhost:3333`

The first time you use semantic search, it will download the embedding model (~30MB). This happens automatically.

### 4. Production Build

```bash
npm run build
npm start
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` | Move to next card |
| `k` | Move to previous card |
| `x` | Toggle selection on focused card |
| `Enter` | Open detail panel for focused card |
| `Esc` | Close detail panel / clear selection |
| `s` | Screen selected (or all if none selected) |
| `r` | Reject selected (opens confirmation) |
| `a` | Select all visible |
| `?` | Show keyboard shortcuts |

## Architecture

```
greenhouse-screener/
├── server/               # Express backend
│   ├── routes/          # API endpoints
│   ├── services/        # Greenhouse & Claude clients
│   └── types.ts         # Server types
├── src/                  # React frontend
│   ├── components/      # UI components
│   ├── hooks/           # React Query hooks
│   ├── lib/             # Utilities
│   └── types/           # Frontend types
└── data/                 # Local data storage
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET | List all open jobs |
| `/api/jobs/:id/stages` | GET | Get stages for a job |
| `/api/jobs/:id/applications` | GET | List applications for a job |
| `/api/rejection-reasons` | GET | List rejection reasons |
| `/api/applications/:id/reject` | POST | Reject an application |
| `/api/applications/:id/advance` | POST | Advance an application |
| `/api/applications/bulk-reject` | POST | Bulk reject applications |
| `/api/screen` | POST | Screen applications with Claude |
| `/api/search/status` | GET | Check Ollama availability |
| `/api/search/index/:jobId` | GET | Get index status for a job |
| `/api/search/index/:jobId` | POST | Build search index for a job |
| `/api/search/:jobId` | POST | Semantic search candidates |

## License

MIT
