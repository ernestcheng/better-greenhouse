import express from 'express';
import cors from 'cors';
import { CONFIG, validateConfig } from './config.js';
import jobsRouter from './routes/jobs.js';
import applicationsRouter from './routes/applications.js';
import screeningRouter from './routes/screening.js';
import attachmentsRouter from './routes/attachments.js';
import searchRouter from './routes/search.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/jobs', jobsRouter);
app.use('/api', applicationsRouter);
app.use('/api/screen', screeningRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/search', searchRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = CONFIG.PORT;

validateConfig();

app.listen(PORT, () => {
  console.log(`
  🌿 Greenhouse Screener Server
  ────────────────────────────
  Local:    http://localhost:${PORT}
  API:      http://localhost:${PORT}/api
  
  Ready to screen candidates!
  `);
});
