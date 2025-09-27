const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'venture-global-secret-key-2024';

// User authentication middleware
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.cookies.userToken || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user exists and is verified
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, email_verified FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        const user = result.rows[0];
        
        if (!user.email_verified) {
            return res.status(403).json({ 
                success: false, 
                message: 'Email verification required' 
            });
        }
        
        req.user = user;
        next();
        
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
        });
    }
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.cookies.userToken || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin authentication required' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user exists and is admin
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, is_admin FROM users WHERE id = $1 AND is_admin = true',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin not found' 
            });
        }
        
        req.admin = result.rows[0];
        next();
        
    } catch (error) {
        console.error('Admin authentication error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid admin token' 
        });
    }
};

// Generate JWT token for user
const generateUserToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Generate JWT token for admin
const generateAdminToken = (adminId) => {
    return jwt.sign({ adminId }, JWT_SECRET, { expiresIn: '24h' });
};

module.exports = {
    authenticateUser,
    authenticateAdmin,
    generateUserToken,
    generateAdminToken,
    JWT_SECRET
}; 