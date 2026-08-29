const fs = require('fs');
const file = 'middleware/validateToken.js';
let c = fs.readFileSync(file, 'utf8');

// Find and replace the missing comma
const target = 'Authorization: `Bearer ${token}`\n        ...(requestId';
const replacement = 'Authorization: `Bearer ${token}`,\n        ...(requestId';

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync(file, c);
  console.log('Fixed!');
} else {
  console.log('Target not found, checking if already fixed...');
  if (c.includes(replacement)) {
    console.log('Already fixed!');
  } else {
    console.log('Unexpected content around line 46:');
    const lines = c.split('\n');
    for (let i = 43; i < 50 && i < lines.length; i++) {
      console.log(`Line ${i+1}: ${JSON.stringify(lines[i])}`);
    }
  }
}
