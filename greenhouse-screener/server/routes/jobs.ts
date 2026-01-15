import { Router } from 'express';
import { greenhouseAPI } from '../services/greenhouse.js';

const router = Router();

// GET /api/jobs - List all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await greenhouseAPI.getJobs();
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:jobId/stages - Get stages for a job
router.get('/:jobId/stages', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const stages = await greenhouseAPI.getJobStages(jobId);
    res.json(stages);
  } catch (error) {
    console.error('Error fetching job stages:', error);
    res.status(500).json({ error: 'Failed to fetch job stages' });
  }
});

// GET /api/jobs/:jobId/applications - Get applications for a job
router.get('/:jobId/applications', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.per_page as string) || 20;
    const status = (req.query.status as string) || 'active';
    const stageId = req.query.stage_id ? parseInt(req.query.stage_id as string) : undefined;

    console.log(`Fetching applications for job ${jobId}, page ${page}, stage ${stageId || 'all'}`);

    const result = await greenhouseAPI.getApplications(jobId, {
      page,
      per_page: perPage,
      status,
      stage_id: stageId,
    });

    console.log(`Found ${result.applications.length} applications, total: ${result.total}`);

    const hasMore = result.applications.length === perPage;

    res.json({
      applications: result.applications,
      total: result.total,
      per_page: perPage,
      page,
      nextPage: hasMore ? page + 1 : undefined,
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

export default router;
