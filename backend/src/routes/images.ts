import { Router, Request, Response } from 'express';
import axios from 'axios';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const WP_API_URL = process.env.WP_API_URL || '';

router.get('/wp-image/:path(*)', async (req: Request, res: Response) => {
  if (!WP_API_URL) {
    return res.status(503).json({ error: 'WP_API_URL not configured' });
  }
  try {
    const imagePath = req.params.path;
    const wpBaseUrl = WP_API_URL.replace('/wp-json', '');
    const imageUrl = `${wpBaseUrl}/wp-content/${imagePath}`;
    const headers: any = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' };
    if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
    }
    const config: any = { timeout: 10000, headers, responseType: 'arraybuffer', validateStatus: (s: number) => s < 500 };
    if (WP_API_URL.startsWith('https')) config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    else config.httpAgent = new http.Agent();
    const response = await axios.get(imageUrl, config);
    if (response.status === 200 && response.data?.length) {
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(response.data);
    } else {
      res.status(response.status || 500).json({ error: 'Failed to load image' });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load image', details: error.message });
  }
});

router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Image proxy OK', wpApiUrl: WP_API_URL || '(not set)', hasAuth: !!(process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) });
});

export default router;
