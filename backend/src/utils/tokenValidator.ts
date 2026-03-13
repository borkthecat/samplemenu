import crypto from 'crypto';

// Secret key for token generation (should be in .env in production)
// Use JWT_SECRET if available, otherwise fallback
const TOKEN_SECRET = process.env.VENUE_TOKEN_SECRET || process.env.JWT_SECRET || 'curo-venue-secret-key-change-in-production';

/**
 * Generate a secure token for a venue
 * Token format: base64(venue_id + ':' + hash(venue_id + secret))
 */
export function generateVenueToken(venueId: string): string {
  // Create hash of venue_id + secret
  const hash = crypto
    .createHash('sha256')
    .update(venueId + TOKEN_SECRET)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars of hash
  
  // Combine venue_id and hash
  const tokenData = `${venueId}:${hash}`;
  
  // Encode to base64 for URL safety
  return Buffer.from(tokenData).toString('base64');
}

/**
 * Validate and extract venue ID from token
 * Returns venue_id if valid, null if invalid
 */
export function validateVenueToken(token: string): string | null {
  try {
    // Decode from base64
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [venueId, hash] = decoded.split(':');
    
    if (!venueId || !hash) {
      return null;
    }
    
    // Validate venue ID is in allowed list
    const VALID_VENUE_IDS = ['001', '002', '003'];
    if (!VALID_VENUE_IDS.includes(venueId)) {
      return null;
    }
    
    // Verify hash matches
    const expectedHash = crypto
      .createHash('sha256')
      .update(venueId + TOKEN_SECRET)
      .digest('hex')
      .substring(0, 16);
    
    if (hash !== expectedHash) {
      return null; // Token is invalid or tampered with
    }
    
    return venueId;
  } catch (error) {
    return null;
  }
}

/**
 * Generate tokens for all venues (for initial setup)
 */
export function generateAllVenueTokens(): Record<string, string> {
  return {
    '001': generateVenueToken('001'),
    '002': generateVenueToken('002'),
    '003': generateVenueToken('003'),
  };
}

