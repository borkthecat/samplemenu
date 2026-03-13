import { Router, Request, Response } from 'express';
import { clearMenuCache } from './menu';
import { syncMenuItems, syncTableNumbers } from './sync';

const router = Router();
const WEBHOOK_SECRET = process.env.WP_WEBHOOK_SECRET || 'change-me-in-production';

router.post('/wordpress-sync', async (req: Request, res: Response) => {
  try {
    const providedSecret = req.headers['x-webhook-secret'];
    if (providedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
    }
    clearMenuCache();
    syncTableNumbers().catch(err => console.error('Table numbers auto-sync error:', err.message));
    res.status(200).json({ success: true, message: 'Sync initiated, cache cleared' });
    syncMenuItems().catch(err => console.error('Sync error:', err.message));
  } catch (error: any) {
    res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
});

export default router;
