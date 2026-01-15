import { Router } from 'express';
import { CONFIG } from '../config.js';

const router = Router();

// GET /api/attachments/proxy?url=... - Proxy attachment with inline headers
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Proxying attachment:', url);

    // Greenhouse attachment URLs are pre-signed and don't need auth
    // Try fetching without auth first (most attachment URLs are pre-signed S3 URLs)
    let response = await fetch(url);

    // If that fails, try with Greenhouse auth
    if (!response.ok && response.status === 401) {
      console.log('Trying with Greenhouse auth...');
      const auth = Buffer.from(`${CONFIG.GREENHOUSE_API_KEY}:`).toString('base64');
      response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });
    }

    if (!response.ok) {
      console.error('Failed to fetch attachment:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response body:', text.substring(0, 500));
      return res.status(response.status).json({ 
        error: 'Failed to fetch attachment',
        status: response.status,
        statusText: response.statusText 
      });
    }

    // Get content type from response
    const originalContentType = response.headers.get('content-type') || '';
    const contentDisposition = response.headers.get('content-disposition') || '';
    
    console.log('Original Content-Type:', originalContentType);
    console.log('Original Content-Disposition:', contentDisposition);
    
    // Determine the actual content type
    let contentType = originalContentType;
    let filename = 'document';
    
    // Extract filename from URL or content-disposition
    const urlFilename = url.split('/').pop()?.split('?')[0] || '';
    if (urlFilename) {
      filename = decodeURIComponent(urlFilename);
    }
    
    // Determine content type based on file extension
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf' || url.toLowerCase().includes('.pdf')) {
      contentType = 'application/pdf';
    } else if (ext === 'doc') {
      contentType = 'application/msword';
    } else if (ext === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (!contentType || contentType === 'application/octet-stream' || contentType === 'binary/octet-stream') {
      // Default to PDF if we can't determine type
      contentType = 'application/pdf';
    }
    
    console.log('Using Content-Type:', contentType);
    console.log('Filename:', filename);
    
    // Get the response buffer
    const buffer = await response.arrayBuffer();
    
    // Set headers for inline display
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error proxying attachment:', error);
    res.status(500).json({ error: 'Failed to proxy attachment', details: String(error) });
  }
});

export default router;
