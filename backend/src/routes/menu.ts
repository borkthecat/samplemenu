import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../config/database';
import { validateVenueToken } from '../utils/tokenValidator';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const WP_API_URL = process.env.WP_API_URL || '';

const menuCache: { [venueId: string]: { data: any[]; timestamp: number } } = {};
const CACHE_DURATION = 1 * 60 * 1000;

function parseOptionalInt(value: any): number | null {
  if (value === null || value === undefined) return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function deriveDisplayOrder(acf: any, item: any, title: string): number {
  const normalizedTitle = String(title || '').trim();
  const leadingCodeMatch = normalizedTitle.match(/^[A-Za-z]+\s*[- ]?\s*0*(\d+)/);
  if (leadingCodeMatch?.[1]) {
    const parsed = parseOptionalInt(leadingCodeMatch[1]);
    if (parsed !== null) return parsed;
  }
  const anyNumberMatch = normalizedTitle.match(/(\d+)/);
  if (anyNumberMatch?.[1]) {
    const parsed = parseOptionalInt(anyNumberMatch[1]);
    if (parsed !== null) return parsed;
  }
  return 999999;
}

export function clearMenuCache(venueId?: string) {
  if (venueId) delete menuCache[venueId];
  else Object.keys(menuCache).forEach(key => delete menuCache[key]);
}

const VENUE_SLUG_TO_ID: Record<string, string> = {
  'proost': '001',
  'thepublichouse': '002',
  'publichouse': '002',
  'rockshots': '003',
};

const VALID_VENUE_IDS = ['001', '002', '003'];

router.get('/', async (req: Request, res: Response) => {
  try {
    let venueParam: string | null = null;
    const token = req.query.token as string | undefined;
    if (token) {
      venueParam = validateVenueToken(token);
      if (!venueParam) return res.status(403).json({ error: 'Invalid token' });
    }
    if (!venueParam) {
      for (const [slug, id] of Object.entries(VENUE_SLUG_TO_ID)) {
        if (req.query[slug] !== undefined) { venueParam = id; break; }
      }
    }
    if (!venueParam) venueParam = (req.query.venue_id || req.query.venue) as string || null;
    const table = req.query.table;

    if (!venueParam) return res.status(400).json({ error: 'venue_id, venue slug, or token required' });
    const venueIdStr = String(venueParam).trim();
    if (!VALID_VENUE_IDS.includes(venueIdStr)) return res.status(403).json({ error: 'Invalid venue ID' });
    if (!table || String(table).trim() === '') {
      return res.status(400).json({ error: 'Table number is required', message: 'Table parameter is required to access the menu' });
    }
    const tableStr = String(table).trim();

    try {
      const tableCheck = await pool.query(
        'SELECT id, venue_id, table_number FROM table_numbers WHERE venue_id = $1 AND table_number = $2',
        [venueIdStr, tableStr]
      );
      if (tableCheck.rows.length === 0) {
        const otherVenueCheck = await pool.query('SELECT venue_id FROM table_numbers WHERE table_number = $1 LIMIT 1', [tableStr]);
        if (otherVenueCheck.rows.length > 0) {
          return res.status(404).json({ error: 'Table not found for this venue', message: `Table ${tableStr} exists for venue ${otherVenueCheck.rows[0].venue_id}, not venue ${venueIdStr}.` });
        }
        try {
          const syncModule = await import('./sync');
          const syncTableNumbers = (syncModule as any).syncTableNumbers;
          if (syncTableNumbers) await syncTableNumbers();
          const retryCheck = await pool.query(
            'SELECT id, venue_id, table_number FROM table_numbers WHERE venue_id = $1 AND table_number = $2',
            [venueIdStr, tableStr]
          );
          if (retryCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Table not found', message: `Table ${tableStr} does not exist for venue ${venueIdStr}. Create it in WordPress first.` });
          }
        } catch (syncError: any) {
          return res.status(404).json({ error: 'Table not found', message: `Table ${tableStr} does not exist for venue ${venueIdStr}.` });
        }
      }
    } catch (dbError: any) {
      return res.status(500).json({ error: 'Table validation failed', message: 'Unable to validate table number.' });
    }

    if (!WP_API_URL) {
      return res.status(503).json({ error: 'WordPress not configured', details: 'Set WP_API_URL in backend environment variables.' });
    }

    const cacheKey = venueIdStr;
    const cached = menuCache[cacheKey];
    const now = Date.now();
    let allMenuItems: any[];

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      allMenuItems = cached.data;
    } else {
      const headers: any = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
      if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
      }
      const axiosConfig: any = { timeout: 15000, params: { per_page: 100, _embed: true }, headers };
      if (WP_API_URL.startsWith('https://')) {
        const https = require('https');
        axiosConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      }
      const response = await axios.get(`${WP_API_URL}/wp/v2/menu_item`, axiosConfig);
      if (typeof response.data === 'string' && response.data.trim().startsWith('<html')) {
        throw new Error('WordPress REST API is blocked. The API returns HTML instead of JSON.');
      }
      allMenuItems = response.data;
      menuCache[cacheKey] = { data: allMenuItems, timestamp: now };
    }

    const filteredItemsPromises = allMenuItems
      .filter((item: any) => {
        const acf = item.acf || {};
        const venueIds = Array.isArray(acf.venue_id) ? acf.venue_id : (acf.venue_id ? [acf.venue_id] : []);
        return venueIds.includes(venueIdStr) && acf.is_available !== false;
      })
      .map(async (item: any) => {
        const acf = item.acf || {};
        let imageUrl: string | null = null;
        const acfImage = acf.image || acf.menu_image || acf.featured_image;
        if (acfImage) {
          if (typeof acfImage === 'string') imageUrl = acfImage;
          else if (acfImage.url) imageUrl = acfImage.url;
          else if (acfImage.sizes?.large) imageUrl = acfImage.sizes.large;
          else if (acfImage.sizes?.full) imageUrl = acfImage.sizes.full;
        }
        if (!imageUrl && item.featured_image_url) imageUrl = item.featured_image_url;
        else if (!imageUrl && item.featured_image_large_url) imageUrl = item.featured_image_large_url;
        else if (!imageUrl && item.featured_image_medium_url) imageUrl = item.featured_image_medium_url;

        const featuredMediaId = item.featured_media || item.featured_image || null;
        if (!imageUrl && featuredMediaId > 0) {
          try {
            const mediaHeaders: any = { 'Accept': 'application/json' };
            if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
              mediaHeaders['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
            }
            const mediaConfig: any = { timeout: 5000, headers: mediaHeaders };
            if (WP_API_URL.startsWith('https://')) mediaConfig.httpsAgent = new (require('https')).Agent({ rejectUnauthorized: false });
            const mediaResponse = await axios.get(`${WP_API_URL}/wp/v2/media/${featuredMediaId}`, mediaConfig);
            const m = mediaResponse.data;
            imageUrl = m.source_url || m.media_details?.sizes?.full?.source_url || m.media_details?.sizes?.large?.source_url || null;
          } catch {
            if (item._embedded?.['wp:featuredmedia']?.[0]) {
              const em = item._embedded['wp:featuredmedia'][0];
              imageUrl = em.source_url || em.media_details?.sizes?.full?.source_url || em.media_details?.sizes?.large?.source_url || null;
            }
          }
        }
        if (!imageUrl && item._embedded?.['wp:featuredmedia']?.[0]) {
          const em = item._embedded['wp:featuredmedia'][0];
          imageUrl = em.source_url || em.media_details?.sizes?.full?.source_url || em.media_details?.sizes?.large?.source_url || null;
        }

        if (imageUrl && imageUrl.includes('/wp-content/')) {
          const imagePath = imageUrl.split('/wp-content/')[1];
          if (imagePath) {
            let API_BASE = process.env.API_BASE_URL || process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
            API_BASE = API_BASE.replace(/\/+$/, '');
            if (!API_BASE.startsWith('http')) API_BASE = 'https://' + API_BASE;
            imageUrl = `${API_BASE}/api/images/wp-image/${imagePath}`;
          }
        } else if (imageUrl && !imageUrl.startsWith('http')) {
          const wpBaseUrl = WP_API_URL.replace('/wp-json', '');
          imageUrl = wpBaseUrl + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl);
        }

        const title = item.title?.rendered || item.title || 'Untitled';
        return {
          id: item.id,
          wp_id: item.id,
          venue_id: venueIdStr,
          name: title,
          description: acf.description || '',
          price: parseFloat(acf.price || '0'),
          category: acf.category || 'other',
          image_url: imageUrl,
          is_available: acf.is_available !== false,
          display_order: deriveDisplayOrder(acf, item, title),
          subheader: acf.subheader || ''
        };
      });

    const filteredItems = (await Promise.all(filteredItemsPromises)).sort((a: any, b: any) => {
      const orderA = a?.display_order ?? 0, orderB = b?.display_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a?.name || '').toString().localeCompare((b?.name || '').toString(), undefined, { numeric: true });
    });
    res.json(filteredItems);
  } catch (error: any) {
    const msg = (error.message || 'Failed to load menu').replace(/WordPress/gi, '').replace(/wp-json/gi, '').trim() || 'Failed to load menu.';
    res.status(error.response?.status || 500).json({ error: 'Failed to load menu', details: msg });
  }
});

router.get('/item/:id', async (req: Request, res: Response) => {
  try {
    if (!WP_API_URL) return res.status(503).json({ error: 'WordPress not configured' });
    const { id } = req.params;
    const headers: any = { 'Accept': 'application/json' };
    if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
    }
    const config: any = { timeout: 15000, params: { _embed: true }, headers };
    if (WP_API_URL.startsWith('https://')) config.httpsAgent = new (require('https')).Agent({ rejectUnauthorized: false });
    const response = await axios.get(`${WP_API_URL}/wp/v2/menu_item/${id}`, config);
    const item = response.data;
    const acf = item.acf || {};
    let imageUrl: string | null = null;
    if (item._embedded?.['wp:featuredmedia']?.[0]) {
      const em = item._embedded['wp:featuredmedia'][0];
      imageUrl = em.source_url || em.media_details?.sizes?.full?.source_url || em.media_details?.sizes?.large?.source_url || null;
    }
    if (imageUrl && imageUrl.includes('/wp-content/')) {
      const imagePath = imageUrl.split('/wp-content/')[1];
      if (imagePath) {
        let API_BASE = process.env.API_BASE_URL || process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
        API_BASE = API_BASE.replace(/\/+$/, '');
        if (!API_BASE.startsWith('http')) API_BASE = 'https://' + API_BASE;
        imageUrl = `${API_BASE}/api/images/wp-image/${imagePath}`;
      }
    }
    res.json({
      id: item.id,
      wp_id: item.id,
      name: item.title?.rendered || item.title || 'Untitled',
      description: acf.description || '',
      price: parseFloat(acf.price || '0'),
      category: acf.category || 'other',
      image_url: imageUrl,
      is_available: acf.is_available !== false,
      display_order: deriveDisplayOrder(acf, item, item.title?.rendered || item.title || ''),
      subheader: acf.subheader || ''
    });
  } catch (error: any) {
    if (error.response?.status === 404) return res.status(404).json({ error: 'Menu item not found' });
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

export default router;
