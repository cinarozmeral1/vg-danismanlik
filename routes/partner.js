const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticatePartner } = require('../middleware/auth');

const router = express.Router();

// =====================================================
// PARTNER PANEL PAGES
// =====================================================

// Partner Dashboard Page
router.get('/dashboard', async (req, res) => {
    try {
        // Check if partner is logged in via cookie
        const token = req.cookies.partnerToken;
        if (!token) {
            return res.redirect('/login');
        }

        // Verify token and get partner
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'venture-global-secret-key-2024';
        
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.redirect('/login');
        }

        const partnerResult = await pool.query(
            'SELECT id, first_name, last_name, email, company_name, phone, email_verified, is_active FROM partners WHERE id = $1',
            [decoded.partnerId]
        );

        if (partnerResult.rows.length === 0 || !partnerResult.rows[0].is_active) {
            return res.redirect('/login');
        }

        const partnerData = partnerResult.rows[0];
        const partner = {
            ...partnerData,
            name: `${partnerData.first_name} ${partnerData.last_name}`
        };

        // Get partner's students with details
        const studentsResult = await pool.query(
            `SELECT id, first_name, last_name, email, phone, created_at 
             FROM users 
             WHERE partner_id = $1 
             ORDER BY created_at DESC`,
            [partner.id]
        );
        const students = studentsResult.rows;

        // Get all earnings with student info
        const earningsResult = await pool.query(
            `SELECT 
                pe.id,
                pe.user_id,
                pe.amount,
                pe.currency,
                pe.earning_date,
                pe.is_paid,
                pe.payment_date,
                pe.notes,
                pe.created_at,
                CONCAT(u.first_name, ' ', u.last_name) as student_name
             FROM partner_earnings pe
             JOIN users u ON pe.user_id = u.id
             WHERE pe.partner_id = $1
             ORDER BY pe.earning_date DESC`,
            [partner.id]
        );
        const earnings = earningsResult.rows;

        res.render('partner/dashboard', {
            title: 'Partner Dashboard - Venture Global',
            partner,
            students,
            earnings,
            currentLanguage: res.locals.currentLanguage || 'tr',
            t: res.locals.t
        });

    } catch (error) {
        console.error('Partner dashboard error:', error);
        res.redirect('/login');
    }
});

// =====================================================
// PARTNER API ENDPOINTS
// =====================================================

// Get partner's students
router.get('/api/students', authenticatePartner, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.created_at as registered_at,
                pe.amount as earning_amount,
                pe.currency,
                pe.earning_date,
                pe.is_paid,
                pe.payment_date,
                pe.notes as earning_notes
            FROM users u
            LEFT JOIN partner_earnings pe ON u.id = pe.user_id AND pe.partner_id = $1
            WHERE u.partner_id = $1
            ORDER BY u.created_at DESC
        `, [req.partner.id]);

        res.json({
            success: true,
            students: result.rows
        });

    } catch (error) {
        console.error('Get partner students error:', error);
        res.status(500).json({
            success: false,
            message: 'Öğrenciler yüklenirken bir hata oluştu'
        });
    }
});

// Get partner's earnings summary
router.get('/api/earnings', authenticatePartner, async (req, res) => {
    try {
        // Get all earnings with student info
        const earningsResult = await pool.query(`
            SELECT 
                pe.id,
                pe.user_id,
                pe.amount,
                pe.currency,
                pe.earning_date,
                pe.is_paid,
                pe.payment_date,
                pe.notes,
                pe.created_at,
                u.first_name,
                u.last_name
            FROM partner_earnings pe
            JOIN users u ON pe.user_id = u.id
            WHERE pe.partner_id = $1
            ORDER BY pe.earning_date DESC
        `, [req.partner.id]);

        // Calculate totals
        const totalsResult = await pool.query(`
            SELECT 
                currency,
                COALESCE(SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END), 0) as paid,
                COALESCE(SUM(CASE WHEN is_paid = false THEN amount ELSE 0 END), 0) as pending,
                COALESCE(SUM(amount), 0) as total
            FROM partner_earnings 
            WHERE partner_id = $1
            GROUP BY currency
        `, [req.partner.id]);

        res.json({
            success: true,
            earnings: earningsResult.rows,
            totals: totalsResult.rows
        });

    } catch (error) {
        console.error('Get partner earnings error:', error);
        res.status(500).json({
            success: false,
            message: 'Kazançlar yüklenirken bir hata oluştu'
        });
    }
});

// Get partner profile
router.get('/api/profile', authenticatePartner, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, company_name, phone, created_at FROM partners WHERE id = $1',
            [req.partner.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner bulunamadı'
            });
        }

        const partner = result.rows[0];
        res.json({
            success: true,
            partner: {
                ...partner,
                name: `${partner.first_name} ${partner.last_name}`
            }
        });

    } catch (error) {
        console.error('Get partner profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Profil bilgileri yüklenirken bir hata oluştu'
        });
    }
});

// Update partner password
router.put('/api/change-password', authenticatePartner, async (req, res) => {
    try {
        const { currentPassword, newPassword, language = 'tr' } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Mevcut şifre ve yeni şifre gerekli' : 'Current password and new password required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Yeni şifre en az 6 karakter olmalıdır' : 'New password must be at least 6 characters'
            });
        }

        // Get current password hash
        const result = await pool.query(
            'SELECT password_hash FROM partners WHERE id = $1',
            [req.partner.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Partner bulunamadı'
            });
        }

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!passwordMatch) {
            return res.status(400).json({
                success: false,
                message: language === 'tr' ? 'Mevcut şifre yanlış' : 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await pool.query(
            'UPDATE partners SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newPasswordHash, req.partner.id]
        );

        res.json({
            success: true,
            message: language === 'tr' ? 'Şifreniz başarıyla güncellendi' : 'Password updated successfully'
        });

    } catch (error) {
        console.error('Change partner password error:', error);
        res.status(500).json({
            success: false,
            message: 'Şifre değiştirilirken bir hata oluştu'
        });
    }
});

// Partner logout
router.post('/logout', (req, res) => {
    res.clearCookie('partnerToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    
    res.json({
        success: true,
        message: 'Çıkış başarılı'
    });
});

module.exports = router;

