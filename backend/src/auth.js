const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'comunidad-salud-dev-secret';
const JWT_EXPIRES_IN = '30d';

function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function getUserIdFromToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

module.exports = { createToken, getUserIdFromToken };
