import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { validateVenueToken } from '../utils/tokenValidator';

const router = Router();

// GET /api/venue/settings?token=xxx OR /api/venue/:venueId/settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    let venueId: string | null = null;

    // If token is provided, validate and extract venueId
    if (token && typeof token === 'string') {
      venueId = validateVenueToken(token);
      if (!venueId) {
        return res.status(403).json({ error: 'Invalid token' });
      }
    } else {
      return res.status(400).json({ error: 'token or venueId is required' });
    }

    const result = await pool.query(
      'SELECT require_customer_name, require_phone_number FROM venues WHERE id = $1',
      [venueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching venue settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/venue/:venueId/settings (backwards compatibility)
router.get('/:venueId/settings', async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;

    const result = await pool.query(
      'SELECT require_customer_name, require_phone_number FROM venues WHERE id = $1',
      [venueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching venue settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/venue/:venueId/settings
router.put('/:venueId/settings', async (req: Request, res: Response) => {
  try {
    const { venueId } = req.params;
    const { require_customer_name, require_phone_number } = req.body;

    // Validate venue ID
    if (!['001', '002', '003'].includes(venueId)) {
      return res.status(400).json({ error: 'Invalid venue ID' });
    }

    // Get venue name mapping
    const venueNames: Record<string, string> = {
      '001': 'PROOST',
      '002': 'THE PUBLIC HOUSE',
      '003': 'ROCKSHOTS'
    };

    // Upsert venue (create if doesn't exist, update if exists)
    await pool.query(
      `INSERT INTO venues (id, name, require_customer_name, require_phone_number)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) 
       DO UPDATE SET 
         require_customer_name = EXCLUDED.require_customer_name,
         require_phone_number = EXCLUDED.require_phone_number`,
      [
        venueId,
        venueNames[venueId] || `Venue ${venueId}`,
        require_customer_name || false,
        require_phone_number || false
      ]
    );

    console.log(`✅ Venue ${venueId} settings updated: require_name=${require_customer_name}, require_phone=${require_phone_number}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating venue settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/venue/:venueId/status
router.get('/:venueId/status', async (req, res: Response) => {
  try {
    const { venueId } = req.params;

    const result = await pool.query(
      'SELECT closing_time FROM venues WHERE id = $1',
      [venueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const isClosed = result.rows[0].closing_time !== null;
    res.json({ isClosed, closing_time: result.rows[0].closing_time });
  } catch (error) {
    console.error('Error fetching venue status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
