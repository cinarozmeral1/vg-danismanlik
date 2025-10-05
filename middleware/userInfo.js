const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'venture-global-secret-key-2024';

// User info middleware for layout
const userInfoMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.userToken || req.cookies.adminToken;
        
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            if (decoded.userId) {
                // Regular user or admin user
                const result = await pool.query(
                    'SELECT id, first_name, last_name, email, email_verified, is_admin FROM users WHERE id = $1',
                    [decoded.userId]
                );
                
                if (result.rows.length > 0) {
                    const user = result.rows[0];
                    console.log('🔍 User found:', { id: user.id, email: user.email, is_admin: user.is_admin, email_verified: user.email_verified });
                    // Soft enforcement: kullanıcıyı her durumda oturum sahibi yap
                    res.locals.currentUser = user;
                    res.locals.isLoggedIn = true;
                    res.locals.isAdmin = user.is_admin || false;
                    console.log('✅ User authenticated:', { isLoggedIn: res.locals.isLoggedIn, isAdmin: res.locals.isAdmin });
                }
            } else if (decoded.adminId) {
                // Admin user
                const result = await pool.query(
                    'SELECT id, email, name FROM admins WHERE id = $1',
                    [decoded.adminId]
                );
                
                if (result.rows.length > 0) {
                    const admin = result.rows[0];
                    res.locals.currentUser = admin;
                    res.locals.isLoggedIn = true;
                    res.locals.isAdmin = true;
                }
            }
        }
        
        // Set default values if not logged in
        if (!res.locals.isLoggedIn) {
            res.locals.isLoggedIn = false;
            res.locals.isAdmin = false;
            res.locals.currentUser = null;
        }
        
        next();
    } catch (error) {
        // If token is invalid, clear it
        res.clearCookie('userToken');
        res.clearCookie('adminToken');
        res.locals.isLoggedIn = false;
        res.locals.isAdmin = false;
        res.locals.currentUser = null;
        next();
    }
};

module.exports = userInfoMiddleware; 