const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.header('Authorization');
    console.log('Request Headers:', req.headers); // Debugging all headers
    console.log('Authorization Header:', authHeader); // Log the Authorization header

    if(!authHeader)
        return res.status(401).json({ error: 'Access denied, token missing' });

    const token = authHeader.split(' ')[1];
    console.log('Extracted Token:', token); // Debugging the extracted token

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach decoded user to the request
        console.log('Token:', token); // Debug log
        console.log('Decoded user:', decoded); // Debugging decoded user info
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.log('Invalid token', error.message);
        res.status(403).json({ error: 'Invalid or expired token' });
    }
}


function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
}

// Export both functions
module.exports = { authenticateToken, authorizeRoles };
