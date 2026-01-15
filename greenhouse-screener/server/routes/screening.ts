import { Router } from 'express';
import { screenApplications } from '../services/claude.js';

const router = Router();

// POST /api/screen - Screen applications with Claude
router.post('/', async (req, res) => {
  try {
    const { job_id, job_title, job_requirements, applications } = req.body;

    if (!job_id || !job_title) {
      return res.status(400).json({ error: 'job_id and job_title are required' });
    }

    if (!Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({ error: 'applications must be a non-empty array' });
    }

    const results = await screenApplications({
      job_id,
      job_title,
      job_requirements: job_requirements || '',
      applications,
    });

    res.json({ results });
  } catch (error) {
    console.error('Error screening applications:', error);
    res.status(500).json({ error: 'Failed to screen applications' });
  }
});

export default router;
