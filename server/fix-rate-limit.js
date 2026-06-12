const fs = require('fs');
const file = 'routes/grievance.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per IP per hour`,
  `const publicLimiter = rateLimit({
  windowMs: Number(process.env.GRIEVANCE_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
  max: Number(process.env.GRIEVANCE_RATE_LIMIT_MAX) || 5, // 5 requests per IP per hour`
);
fs.writeFileSync(file, content);
console.log('Done');
