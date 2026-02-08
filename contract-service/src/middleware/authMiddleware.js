//src/middleware/authMiddleware.js

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_ISS = process.env.JWT_ISS || 'aegisops.api';
const JWT_AUD = process.env.JWT_AUD || 'aegisops.app';

function getTokenFromRequest(req) {
  const authHeader = req.headers['authorization'] || req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Optional cookie fallback if you set it in login
  if (req.cookies?.auth) return req.cookies.auth;
  return null;
}

export function authenticateToken(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    // In test mode, allow bypassing auth for convenience
    req.user = {
      id: 'test-user',
      role: 'admin',
    };
    return next();
  }
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Access denied, token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      // Uncomment if you added iss/aud when signing:
      // issuer: JWT_ISS,
      // audience: JWT_AUD,
      // clockTolerance: 5 // seconds of skew if needed
    });

    // Normalize into a consistent shape for the rest of the app
    // prefer standard `sub`, but fall back to legacy/custom ids if present
    const userId = decoded.sub || decoded.userId || decoded.id || decoded._id;

    req.user = {
      id: userId?.toString?.() || String(userId),
      role: decoded.role || 'admin',
      facilityId: decoded.facilityId,
      departmentId: decoded.departmentId || null,
      facilities: decoded.facilities || [],

      // Ensure the user ALWAYS has access to their default facility
      facilities: [
        ...(decoded.facilities || []).map(f => 
        typeof f === 'object' ? f._id?.toString() : f.toString()
        ),
        decoded.facilityId?.toString()
      ],

      // Keep raw claims you might care about:
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    // Avoid logging tokens in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('req.user:', req.user);
    }

    next();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('JWT verify failed:', err.message);
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Simple role gate: authorizeRoles('admin'), authorizeRoles('admin', 'user')
export function authorizeRoles(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
      // need to be directed to another Biden page ... "You're not authorized" or be challenged to do push ups!
    }
    next();
  };
}