const express = require('express');
const pool = require('../config/database');
const stripeConfig = require('../config/stripe');

const router = express.Router();

// Webhook endpoint - must use raw body for signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    
    let event;
    
    try {
        // Verify webhook signature
        event = stripeConfig.constructWebhookEvent(
            req.body,
            signature
        );
        
        console.log('✅ Stripe webhook received:', event.type);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;
                
            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;
                
            case 'payment_intent.canceled':
                await handlePaymentIntentCanceled(event.data.object);
                break;
                
            case 'payment_intent.processing':
                await handlePaymentIntentProcessing(event.data.object);
                break;
                
            case 'payment_intent.requires_action':
                await handlePaymentIntentRequiresAction(event.data.object);
                break;
                
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        
        // Log the webhook event
        const metadata = event.data.object.metadata || {};
        await pool.query(
            `INSERT INTO payment_logs 
             (service_id, user_id, stripe_event_type, stripe_event_id, status, amount, currency, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (stripe_event_id) DO NOTHING`,
            [
                metadata.service_id || null,
                metadata.user_id || null,
                event.type,
                event.id,
                event.data.object.status,
                event.data.object.amount ? event.data.object.amount / 100 : null,
                event.data.object.currency,
                JSON.stringify(metadata)
            ]
        );
        
        // Return 200 to acknowledge receipt of the event
        res.json({ received: true });
        
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// Handle successful payment
async function handlePaymentIntentSucceeded(paymentIntent) {
    console.log('💰 Payment succeeded:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata || {};
    
    // Check if this is an installment payment
    if (metadata.installment_id) {
        // Update installment
        await pool.query(
            `UPDATE installments 
             SET is_paid = true, 
                 payment_date = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [metadata.installment_id]
        );
        
        console.log(`✅ Installment ${metadata.installment_id} marked as paid`);
        
        // Check if all installments for the service are paid
        const installmentsCheck = await pool.query(
            `SELECT COUNT(*) as total, 
                    SUM(CASE WHEN is_paid = true THEN 1 ELSE 0 END) as paid
             FROM installments 
             WHERE service_id = $1`,
            [metadata.service_id]
        );
        
        const { total, paid } = installmentsCheck.rows[0];
        
        // If all installments are paid, mark service as paid
        if (parseInt(total) === parseInt(paid)) {
            await pool.query(
                `UPDATE services 
                 SET is_paid = true,
                     payment_date = CURRENT_TIMESTAMP,
                     stripe_payment_status = 'succeeded',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [metadata.service_id]
            );
            
            console.log(`✅ Service ${metadata.service_id} fully paid (all installments)`);
        }
        
    } else if (metadata.service_id) {
        // Update service directly
        await pool.query(
            `UPDATE services 
             SET is_paid = true,
                 payment_date = CURRENT_TIMESTAMP,
                 stripe_payment_status = $1,
                 stripe_payment_intent_id = $2,
                 payment_method = $3,
                 paid_amount = $4,
                 paid_currency = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [
                paymentIntent.status,
                paymentIntent.id,
                paymentIntent.payment_method_types?.[0] || 'card',
                paymentIntent.amount / 100,
                paymentIntent.currency.toUpperCase(),
                metadata.service_id
            ]
        );
        
        console.log(`✅ Service ${metadata.service_id} marked as paid`);
    }
}

// Handle failed payment
async function handlePaymentIntentFailed(paymentIntent) {
    console.log('❌ Payment failed:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata || {};
    
    if (metadata.service_id) {
        await pool.query(
            `UPDATE services 
             SET stripe_payment_status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [paymentIntent.status, metadata.service_id]
        );
        
        // Log the error
        await pool.query(
            `INSERT INTO payment_logs 
             (service_id, user_id, stripe_event_type, status, amount, currency, error_message, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                metadata.service_id,
                metadata.user_id,
                'payment_intent.payment_failed',
                paymentIntent.status,
                paymentIntent.amount / 100,
                paymentIntent.currency,
                paymentIntent.last_payment_error?.message || 'Payment failed',
                JSON.stringify(metadata)
            ]
        );
    }
}

// Handle canceled payment
async function handlePaymentIntentCanceled(paymentIntent) {
    console.log('🚫 Payment canceled:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata || {};
    
    if (metadata.service_id) {
        await pool.query(
            `UPDATE services 
             SET stripe_payment_status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [paymentIntent.status, metadata.service_id]
        );
    }
}

// Handle processing payment
async function handlePaymentIntentProcessing(paymentIntent) {
    console.log('⏳ Payment processing:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata || {};
    
    if (metadata.service_id) {
        await pool.query(
            `UPDATE services 
             SET stripe_payment_status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [paymentIntent.status, metadata.service_id]
        );
    }
}

// Handle payment requires action (e.g., 3D Secure)
async function handlePaymentIntentRequiresAction(paymentIntent) {
    console.log('🔐 Payment requires action:', paymentIntent.id);
    
    const metadata = paymentIntent.metadata || {};
    
    if (metadata.service_id) {
        await pool.query(
            `UPDATE services 
             SET stripe_payment_status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [paymentIntent.status, metadata.service_id]
        );
    }
}

module.exports = router;

