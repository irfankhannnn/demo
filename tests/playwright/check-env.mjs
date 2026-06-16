import 'dotenv/config';
console.log('TEST_TOKEN set:', process.env.TEST_TOKEN ? 'YES' : 'NO');
console.log('Length:', process.env.TEST_TOKEN?.length || 0);
