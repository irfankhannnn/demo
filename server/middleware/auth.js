import jwt from 'jsonwebtoken';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
};

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.set(CORS_HEADERS);
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    res.set(CORS_HEADERS);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Export as authMiddleware for consistency with new route files
export const authMiddleware = authenticateToken;
