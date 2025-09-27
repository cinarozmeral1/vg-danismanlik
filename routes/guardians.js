const express = require('express');
const pool = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Get guardians page
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        // Get users for dropdown
        const usersResult = await pool.query(
            'SELECT id, first_name, last_name, email FROM users ORDER BY first_name, last_name'
        );
        
        res.render('admin/guardians', {
            title: 'Veli Yönetimi - Admin Panel',
            activePage: 'guardians',
            users: usersResult.rows
        });
    } catch (error) {
        console.error('Guardians page error:', error);
        res.status(500).render('error', { 
            title: 'Hata',
            message: 'Veli sayfası yüklenirken bir hata oluştu.' 
        });
    }
});

// Get guardians for a specific user
router.get('/user/:userId', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM guardians WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        
        res.json({
            success: true,
            guardians: result.rows
        });
    } catch (error) {
        console.error('Get guardians error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Veli bilgileri alınırken bir hata oluştu.' 
        });
    }
});

// Get all guardians (API)
router.get('/all', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT g.*, u.first_name, u.last_name, u.email as user_email
            FROM guardians g 
            JOIN users u ON g.user_id = u.id 
            ORDER BY g.created_at DESC
        `);
        
        res.json({
            success: true,
            guardians: result.rows
        });
    } catch (error) {
        console.error('Get all guardians error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Veli bilgileri alınırken bir hata oluştu.' 
        });
    }
});

// Add new guardian
router.post('/add', authenticateAdmin, async (req, res) => {
    try {
        const {
            user_id,
            full_name,
            relationship,
            email,
            phone,
            address,
            id_number,
            can_be_contacted = true
        } = req.body;

        // Validation
        if (!user_id || !full_name || !relationship) {
            return res.status(400).json({
                success: false,
                message: 'Kullanıcı ID, ad soyad ve yakınlık derecesi zorunludur.'
            });
        }

        const result = await pool.query(`
            INSERT INTO guardians (
                user_id, full_name, relationship, email, phone, 
                address, id_number, can_be_contacted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
        `, [
            user_id, full_name, relationship, email, phone,
            address, id_number, can_be_contacted
        ]);

        res.json({
            success: true,
            message: 'Veli bilgileri başarıyla eklendi!',
            guardian: result.rows[0]
        });
    } catch (error) {
        console.error('Add guardian error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Veli eklenirken bir hata oluştu: ' + error.message 
        });
    }
});

// Update guardian
router.put('/update/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            full_name,
            relationship,
            email,
            phone,
            address,
            id_number,
            can_be_contacted
        } = req.body;

        // Validation
        if (!full_name || !relationship) {
            return res.status(400).json({
                success: false,
                message: 'Ad soyad ve yakınlık derecesi zorunludur.'
            });
        }

        const result = await pool.query(`
            UPDATE guardians SET 
                full_name = $1, relationship = $2, email = $3, 
                phone = $4, address = $5, id_number = $6, 
                can_be_contacted = $7, updated_at = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        `, [
            full_name, relationship, email, phone,
            address, id_number, can_be_contacted, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Veli bulunamadı.'
            });
        }

        res.json({
            success: true,
            message: 'Veli bilgileri başarıyla güncellendi!',
            guardian: result.rows[0]
        });
    } catch (error) {
        console.error('Update guardian error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Veli güncellenirken bir hata oluştu: ' + error.message 
        });
    }
});

// Delete guardian
router.delete('/delete/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM guardians WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Veli bulunamadı.'
            });
        }

        res.json({
            success: true,
            message: 'Veli başarıyla silindi!'
        });
    } catch (error) {
        console.error('Delete guardian error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Veli silinirken bir hata oluştu: ' + error.message 
        });
    }
});

// Toggle can_be_contacted status
router.patch('/toggle-contact/:id', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { can_be_contacted } = req.body;

        const result = await pool.query(`
            UPDATE guardians SET 
                can_be_contacted = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [can_be_contacted, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Veli bulunamadı.'
            });
        }

        res.json({
            success: true,
            message: 'İletişim durumu güncellendi!',
            guardian: result.rows[0]
        });
    } catch (error) {
        console.error('Toggle contact error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'İletişim durumu güncellenirken bir hata oluştu: ' + error.message 
        });
    }
});

module.exports = router;
