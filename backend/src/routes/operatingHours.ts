import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../config/database';
import { authenticate, ensureVenueAccess, AuthRequest } from '../middleware/auth';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const WP_API_URL = process.env.WP_API_URL || '';

const DEFAULT_HOURS = {
  closed_all_day: false,
  mon_thu_sat: { hours: '3:00 PM - 11:00 PM', last_order: '10:45 PM', open_time: '3:00 PM' },
  friday: { hours: '3:00 PM - 1:00 AM', last_order: '12:45 AM', open_time: '3:00 PM' }
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const venue = (req.query.venue as string) || '001';
    if (!['001', '002', '003'].includes(venue)) return res.status(400).json({ error: 'Invalid venue ID' });
    if (WP_API_URL) {
      try {
        const https = require('https');
        const config: any = { timeout: 5000, headers: {} };
        if (WP_API_URL.startsWith('https')) config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
        if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
          config.headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
        }
        const r = await axios.get(`${WP_API_URL}/curo/v1/operating-hours?venue=${venue}`, config);
        return res.json(r.data);
      } catch {
        const result = await pool.query('SELECT operating_hours FROM venues WHERE id = $1', [venue]);
        if (result.rows.length > 0 && result.rows[0].operating_hours) return res.json(result.rows[0].operating_hours);
      }
    } else {
      const result = await pool.query('SELECT operating_hours FROM venues WHERE id = $1', [venue]);
      if (result.rows.length > 0 && result.rows[0].operating_hours) return res.json(result.rows[0].operating_hours);
    }
    return res.json(DEFAULT_HOURS);
  } catch (error: any) {
    res.json(DEFAULT_HOURS);
  }
});

router.put('/:venueId', authenticate, ensureVenueAccess, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { venueId } = req.params;
    const { operating_hours } = req.body;
    if (!['001', '002', '003'].includes(venueId)) return res.status(400).json({ error: 'Invalid venue ID' });
    if (user.role !== 'admin' && user.venue_id !== venueId) return res.status(403).json({ error: 'Access denied' });
    if (!operating_hours?.mon_thu_sat || !operating_hours?.friday) return res.status(400).json({ error: 'Invalid operating hours format' });
    await pool.query('UPDATE venues SET operating_hours = $1 WHERE id = $2', [JSON.stringify(operating_hours), venueId]);
    res.json({ success: true, operating_hours });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
