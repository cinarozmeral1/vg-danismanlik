const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'venture-global-secret-key-2024';

// User info middleware for layout
const userInfoMiddleware = async (req, res, next) => {
    // Prevent caching of authenticated pages
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');

    try {
        const token = req.cookies.userToken || req.cookies.adminToken;
        
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            if (decoded.userId) {
                // Regular user or admin user
                const result = await pool.query(
                    'SELECT id, first_name, last_name, email, phone, email_verified, is_admin, admin_role FROM users WHERE id = $1',
                    [decoded.userId]
                );
                
                if (result.rows.length > 0) {
                    const user = result.rows[0];
                    console.log('🔍 User found:', { id: user.id, email: user.email, is_admin: user.is_admin, admin_role: user.admin_role, email_verified: user.email_verified });
                    // Soft enforcement: kullanıcıyı her durumda oturum sahibi yap
                    res.locals.currentUser = user;
                    res.locals.isLoggedIn = true;
                    res.locals.isAdmin = user.is_admin || false;
                    res.locals.isSuperAdmin = user.admin_role === 'super_admin';
                    res.locals.isCoAdmin = user.admin_role === 'co_admin';
                    res.locals.adminRole = user.admin_role || null;
                    console.log('✅ User authenticated:', { isLoggedIn: res.locals.isLoggedIn, isAdmin: res.locals.isAdmin, adminRole: res.locals.adminRole });
                }
            } else if (decoded.adminId) {
                // Admin user (legacy admins table)
                const result = await pool.query(
                    'SELECT id, email, name FROM admins WHERE id = $1',
                    [decoded.adminId]
                );
                
                if (result.rows.length > 0) {
                    const admin = result.rows[0];
                    res.locals.currentUser = admin;
                    res.locals.isLoggedIn = true;
                    res.locals.isAdmin = true;
                    res.locals.isSuperAdmin = true; // Legacy admins are super_admin
                    res.locals.isCoAdmin = false;
                    res.locals.adminRole = 'super_admin';
                }
            }
        }
        
        // Set default values if not logged in
        if (!res.locals.isLoggedIn) {
            res.locals.isLoggedIn = false;
            res.locals.isAdmin = false;
            res.locals.isSuperAdmin = false;
            res.locals.isCoAdmin = false;
            res.locals.adminRole = null;
            res.locals.currentUser = null;
        }
        
        next();
    } catch (error) {
        // If token is invalid, clear it
        res.clearCookie('userToken');
        res.clearCookie('adminToken');
        res.locals.isLoggedIn = false;
        res.locals.isAdmin = false;
        res.locals.isSuperAdmin = false;
        res.locals.isCoAdmin = false;
        res.locals.adminRole = null;
        res.locals.currentUser = null;
        next();
    }
};

module.exports = userInfoMiddleware; 