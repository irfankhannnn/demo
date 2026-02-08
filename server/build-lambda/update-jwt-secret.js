import { readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');

// Generate a strong JWT secret
const newSecret = randomBytes(64).toString('base64');

console.log('Updating JWT_SECRET in .env file...');
console.log('New JWT_SECRET:', newSecret.substring(0, 30) + '...');

try {
  // Read current .env file
  let envContent = readFileSync(envPath, 'utf8');
  
  // Update or add JWT_SECRET
  if (envContent.includes('JWT_SECRET=')) {
    // Replace existing JWT_SECRET
    envContent = envContent.replace(/JWT_SECRET=.*$/m, `JWT_SECRET=${newSecret}`);
    console.log('✅ Updated existing JWT_SECRET');
  } else {
    // Add JWT_SECRET if it doesn't exist
    envContent += `\nJWT_SECRET=${newSecret}\n`;
    console.log('✅ Added new JWT_SECRET');
  }
  
  // Write back to .env
  writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ .env file updated successfully');
  console.log('\n⚠️  IMPORTANT: You must restart the server and re-login to the frontend!');
  
} catch (error) {
  console.error('❌ Error updating .env file:', error.message);
  process.exit(1);
}
