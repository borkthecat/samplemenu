import { generateAllVenueTokens } from '../utils/tokenValidator';

/**
 * Generate secure tokens for all venues
 * Run this script to get tokens for QR codes
 */
console.log('🔐 Generating secure venue tokens...\n');

const tokens = generateAllVenueTokens();

console.log('✅ Venue Tokens Generated:\n');
console.log('Venue 001 (Tipsy Tavern):');
console.log(`  Token: ${tokens['001']}`);
console.log(`  QR URL: http://localhost:5173/menu?token=${tokens['001']}\n`);

console.log('Venue 002 (Hidden Bar):');
console.log(`  Token: ${tokens['002']}`);
console.log(`  QR URL: http://localhost:5173/menu?token=${tokens['002']}\n`);

console.log('Venue 003 (Rooftop Lounge):');
console.log(`  Token: ${tokens['003']}`);
console.log(`  QR URL: http://localhost:5173/menu?token=${tokens['003']}\n`);

console.log('📋 Save these tokens for your QR codes!');
console.log('⚠️  These tokens are tied to specific venues and cannot be tampered with.');

