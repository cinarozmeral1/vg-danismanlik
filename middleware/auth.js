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
        
        // Soft enforcement: allow access but mark verification status
        if (!user.email_verified) {
            console.log('⚠️ User email not verified, but allowing access:', user.email);
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
        const token = req.cookies.userToken || req.cookies.adminToken || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Admin authentication required' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user exists and is admin
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, is_admin, admin_role FROM users WHERE id = $1 AND is_admin = true',
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

// Super Admin authentication middleware (for sensitive operations)
const authenticateSuperAdmin = async (req, res, next) => {
    try {
        const token = req.cookies.userToken || req.cookies.adminToken || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Super admin authentication required' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user exists and is super_admin
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, is_admin, admin_role FROM users WHERE id = $1 AND is_admin = true AND admin_role = $2',
            [decoded.userId, 'super_admin']
        );
        
        if (result.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Super admin access required' 
            });
        }
        
        req.admin = result.rows[0];
        next();
        
    } catch (error) {
        console.error('Super admin authentication error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token' 
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

// Partner authentication middleware
const authenticatePartner = async (req, res, next) => {
    try {
        const token = req.cookies.partnerToken || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            console.log('❌ No partner token provided');
            return res.status(401).json({ 
                success: false, 
                message: 'Partner authentication required' 
            });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if partner exists and is verified
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, company_name, phone, email_verified, is_active FROM partners WHERE id = $1',
            [decoded.partnerId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Partner not found' 
            });
        }
        
        const partnerData = result.rows[0];
        const partner = {
            ...partnerData,
            name: `${partnerData.first_name} ${partnerData.last_name}`
        };
        
        // Check if partner is active
        if (!partner.is_active) {
            return res.status(401).json({ 
                success: false, 
                message: 'Partner account is deactivated' 
            });
        }
        
        // Check if email is verified
        if (!partner.email_verified) {
            console.log('⚠️ Partner email not verified:', partner.email);
            return res.status(401).json({ 
                success: false, 
                message: 'Please verify your email address first' 
            });
        }
        
        req.partner = partner;
        next();
        
    } catch (error) {
        console.error('Partner authentication error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid partner token' 
        });
    }
};

// Generate JWT token for partner
const generatePartnerToken = (partnerId) => {
    return jwt.sign({ partnerId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = {
    authenticateUser,
    authenticateAdmin,
    authenticateSuperAdmin,
    authenticatePartner,
    generateUserToken,
    generateAdminToken,
    generatePartnerToken,
    JWT_SECRET
}; 