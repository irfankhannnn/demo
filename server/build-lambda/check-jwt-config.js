import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';

dotenv.config();

console.log('\n=== JWT Configuration Check ===\n');

const jwtSecret = process.env.JWT_SECRET;
console.log('Current JWT_SECRET:', jwtSecret ? `${jwtSecret.substring(0, 20)}...` : 'NOT SET');
console.log('JWT_SECRET length:', jwtSecret ? jwtSecret.length : 0);

if (!jwtSecret || jwtSecret === 'change-this-secret') {
  console.log('\n⚠️  WARNING: JWT_SECRET is not properly configured!');
  console.log('   Please update the JWT_SECRET in your .env file to a secure random string.');
}

// Test token from request (paste your token here for testing)
const testToken = process.argv[2];

if (testToken) {
  console.log('\n=== Testing Provided Token ===\n');
  try {
    const decoded = jwt.verify(testToken, jwtSecret);
    console.log('✅ Token is VALID');
    console.log('Decoded payload:', JSON.stringify(decoded, null, 2));
  } catch (error) {
    console.log('❌ Token is INVALID');
    console.log('Error:', error.message);
    
    // Try to decode without verification to see the payload
    try {
      const decoded = jwt.decode(testToken, { complete: true });
      console.log('\nToken Header:', JSON.stringify(decoded.header, null, 2));
      console.log('Token Payload (unverified):', JSON.stringify(decoded.payload, null, 2));
      console.log('\n💡 The token was likely signed with a different JWT_SECRET');
    } catch (e) {
      console.log('Could not decode token:', e.message);
    }
  }
}

console.log('\n=== Recommended Actions ===\n');
console.log('1. Update server/.env with a strong JWT_SECRET');
console.log('2. Restart the backend server');
console.log('3. Log in again from the frontend to get a new valid token');
console.log('');
