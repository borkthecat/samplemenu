import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../config/database';
import dotenv from 'dotenv';
import { clearMenuCache } from './menu';

dotenv.config();

const router = Router();
const WP_API_URL = process.env.WP_API_URL || '';

router.post('/wordpress', async (req: Request, res: Response) => {
  try {
    clearMenuCache();
    res.json({ success: true, message: 'WordPress sync initiated. Cache cleared.' });
    syncMenuItems().catch(err => console.error('Sync error:', err));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/wordpress', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'WordPress sync initiated.' });
    syncMenuItems().catch(err => console.error('Sync error:', err));
    syncTableNumbers().catch(err => console.error('Table numbers sync error:', err));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/table-numbers', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Table numbers sync initiated.' });
    syncTableNumbers().catch(err => console.error('Table numbers sync error:', err));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/table-numbers', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Table numbers sync initiated.' });
    syncTableNumbers().catch(err => console.error('Table numbers sync error:', err));
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function syncMenuItems() {
  if (!WP_API_URL) {
    console.error('WP_API_URL not set');
    return;
  }
  try {
    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const headers: any = { 'Accept': 'application/json' };
    if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
    }
    const response = await axios.get(`${WP_API_URL}/wp/v2/menu_item`, {
      timeout: 10000,
      httpsAgent: WP_API_URL.startsWith('https') ? agent : undefined,
      params: { per_page: 100, _embed: true },
      headers
    });
    const menuItems = response.data;
    let synced = 0;
    for (const item of menuItems) {
      try {
        const acf = item.acf || {};
        if (!acf.venue_id) continue;
        const venueIds = Array.isArray(acf.venue_id) ? acf.venue_id : [acf.venue_id];
        let imageUrl = null;
        if (item._embedded?.['wp:featuredmedia']?.[0]) {
          const m = item._embedded['wp:featuredmedia'][0];
          imageUrl = m.source_url || m.media_details?.sizes?.full?.source_url || m.media_details?.sizes?.large?.source_url || null;
        }
        const title = item.title?.rendered || item.title || 'Untitled';
        const description = acf.description || '';
        for (const venueId of venueIds) {
          if (!venueId || typeof venueId !== 'string') continue;
          await pool.query(
            `INSERT INTO menu_items (wp_id, venue_id, name, description, price, category, image_url, is_available, display_order, subheader)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (wp_id, venue_id) DO UPDATE SET
               name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price,
               category = EXCLUDED.category, image_url = EXCLUDED.image_url,
               is_available = EXCLUDED.is_available, display_order = EXCLUDED.display_order,
               subheader = EXCLUDED.subheader, synced_at = CURRENT_TIMESTAMP`,
            [item.id, venueId, title, description, parseFloat(acf.price || '0'), acf.category || 'other',
             imageUrl, acf.is_available !== false, parseInt(acf.display_order || '0') || 0, acf.subheader || '']
          );
        }
        synced++;
      } catch (e: any) {
        console.error('Error syncing item', item.id, e.message);
      }
    }
    console.log('Sync complete:', synced, 'items');
  } catch (error: any) {
    console.error('Sync failed:', error.message);
    throw error;
  }
}

async function syncTableNumbers() {
  if (!WP_API_URL) return;
  try {
    const headers: any = { 'Accept': 'application/json' };
    if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
    }
    const https = require('https');
    const config: any = { timeout: 10000, headers };
    if (WP_API_URL.startsWith('https')) config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.get(`${WP_API_URL}/curo/v1/table-numbers`, config);
    const tableNumbers = response.data || [];
    for (const table of tableNumbers) {
      try {
        await pool.query(
          `INSERT INTO table_numbers (id, table_number, venue_id, qr_token, qr_code_url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::timestamp)
           ON CONFLICT (venue_id, table_number) DO UPDATE SET qr_token = EXCLUDED.qr_token, qr_code_url = EXCLUDED.qr_code_url`,
          [table.id, table.table_number, table.venue_id, table.qr_token, table.qr_code_url || null, table.created_at || new Date().toISOString()]
        );
      } catch (e: any) {
        console.error('Error syncing table', table?.table_number, e.message);
      }
    }
    console.log('Table numbers sync complete:', tableNumbers.length);
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.warn('Table numbers endpoint not found. Add WORDPRESS-TABLE-MANAGEMENT plugin to WordPress.');
    } else {
      console.error('Table numbers sync failed:', error.message);
    }
  }
}

export { syncMenuItems, syncTableNumbers };
export default router;
