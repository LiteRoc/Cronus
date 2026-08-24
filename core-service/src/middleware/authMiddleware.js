const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_ISS = process.env.JWT_ISS || 'cronus.api';
const JWT_AUD = process.env.JWT_AUD || 'cronus.app';

function getTokenFromRequest(req) {
  const authHeader = req.headers['authorization'] || req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Optional cookie fallback if you set it in login
  if (req.cookies?.auth) return req.cookies.auth;
  return null;
}

function authenticateToken(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Access denied, token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISS,
      audience: JWT_AUD,
    });

    // Normalize into a consistent shape for the rest of the app
    // prefer standard `sub`, but fall back to legacy/custom ids if present
    const userId = decoded.sub || decoded.userId || decoded.id || decoded._id;

    req.user = {
      id: userId?.toString?.() || String(userId),
      role: decoded.role || null,
      facilityId: decoded.facilityId,
      departmentId: decoded.departmentId || null,
      facilities: decoded.facilities || [],

      // Keep raw claims you might care about:
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('JWT verify failed:', err.message);
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Simple role gate: authorizeRoles('admin'), authorizeRoles('admin', 'user')
function authorizeRoles(...allowed) {
  const canonicalAllowedRoles = allowed.map((role) => (
    role === 'tech' ? 'technician' : role
  ));

  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !canonicalAllowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
      // need to be directed to another Biden page ... "You're not authorized" or be challenged to do push ups!
    }
    next();
  };
}

// Export both functions
module.exports = { authenticateToken, authorizeRoles };
