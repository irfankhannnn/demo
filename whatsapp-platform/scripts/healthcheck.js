import http from 'http';

const port = process.env.PORT || 3003;

const req = http.get(`http://localhost:${port}/health`, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => process.exit(1));
req.setTimeout(5000, () => { req.destroy(); process.exit(1); });
