import { Router } from 'express';
import { greenhouseAPI } from '../services/greenhouse.js';

const router = Router();

// GET /api/rejection-reasons - List rejection reasons
router.get('/rejection-reasons', async (req, res) => {
  try {
    const reasons = await greenhouseAPI.getRejectionReasons();
    res.json(
      reasons.map((r) => ({
        id: r.id,
        name: r.name,
      }))
    );
  } catch (error) {
    console.error('Error fetching rejection reasons:', error);
    res.status(500).json({ error: 'Failed to fetch rejection reasons' });
  }
});

// GET /api/email-templates - List email templates for rejection
router.get('/email-templates', async (req, res) => {
  try {
    const templates = await greenhouseAPI.getEmailTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// POST /api/applications/:id/reject - Reject an application
router.post('/applications/:id/reject', async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    const { rejection_reason_id, email_template_id } = req.body;

    if (!rejection_reason_id) {
      return res.status(400).json({ error: 'rejection_reason_id is required' });
    }

    await greenhouseAPI.rejectApplication(
      applicationId,
      rejection_reason_id,
      email_template_id
    );

    res.json({ success: true, application_id: applicationId });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

// POST /api/applications/bulk-reject - Bulk reject applications
router.post('/applications/bulk-reject', async (req, res) => {
  try {
    const { application_ids, rejection_reason_id, email_template_id } = req.body;

    if (!Array.isArray(application_ids) || application_ids.length === 0) {
      return res.status(400).json({ error: 'application_ids must be a non-empty array' });
    }

    if (!rejection_reason_id) {
      return res.status(400).json({ error: 'rejection_reason_id is required' });
    }

    const rejected: number[] = [];
    const failed: number[] = [];

    await Promise.all(
      application_ids.map(async (applicationId: number) => {
        try {
          await greenhouseAPI.rejectApplication(
            applicationId,
            rejection_reason_id,
            email_template_id
          );
          rejected.push(applicationId);
        } catch (error) {
          console.error(`Failed to reject application ${applicationId}:`, error);
          failed.push(applicationId);
        }
      })
    );

    res.json({ success: true, rejected, failed });
  } catch (error) {
    console.error('Error in bulk reject:', error);
    res.status(500).json({ error: 'Failed to process bulk reject' });
  }
});

// POST /api/applications/:id/advance - Advance an application
router.post('/applications/:id/advance', async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id, 10);
    const { from_stage_id } = req.body;

    if (!from_stage_id) {
      return res.status(400).json({ error: 'from_stage_id is required' });
    }

    await greenhouseAPI.advanceApplication(applicationId, from_stage_id);

    res.json({ success: true, application_id: applicationId });
  } catch (error) {
    console.error('Error advancing application:', error);
    res.status(500).json({ error: 'Failed to advance application' });
  }
});

export default router;
