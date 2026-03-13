import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_change_in_production';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    venue_id: string | null;
    role: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      venue_id: decoded.venue_id,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to ensure user can only access their own venue's data (unless admin)
export function ensureVenueAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Admins can access all venues
  if (req.user.role === 'admin') {
    return next();
  }

  const requestedVenueId = req.params.venue_id || req.body.venue_id || req.query.venue_id;

  if (requestedVenueId && requestedVenueId !== req.user.venue_id) {
    return res.status(403).json({ error: 'Access denied to this venue' });
  }

  next();
}

