const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY environment variable is not set');
}

// Initialize Stripe with the secret key
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

module.exports = {
    stripe,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    
    // Currency configuration
    supportedCurrencies: ['TRY', 'EUR', 'USD'],
    defaultCurrency: 'EUR',
    
    // Payment configuration
    paymentMethods: ['card'],
    
    // Webhook configuration
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    
    // Helper function to create payment intent
    async createPaymentIntent(amount, currency, metadata = {}) {
        if (!stripe) {
            throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.');
        }
        
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency.toLowerCase(),
                payment_method_types: this.paymentMethods,
                metadata: metadata,
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never'
                }
            });
            
            return paymentIntent;
        } catch (error) {
            console.error('Error creating payment intent:', error);
            throw error;
        }
    },
    
    // Helper function to retrieve payment intent
    async retrievePaymentIntent(paymentIntentId) {
        if (!stripe) {
            throw new Error('Stripe is not configured.');
        }
        
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            return paymentIntent;
        } catch (error) {
            console.error('Error retrieving payment intent:', error);
            throw error;
        }
    },
    
    // Helper function to confirm payment intent
    async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
        if (!stripe) {
            throw new Error('Stripe is not configured.');
        }
        
        try {
            const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: paymentMethodId
            });
            return paymentIntent;
        } catch (error) {
            console.error('Error confirming payment intent:', error);
            throw error;
        }
    },
    
    // Helper function to cancel payment intent
    async cancelPaymentIntent(paymentIntentId) {
        if (!stripe) {
            throw new Error('Stripe is not configured.');
        }
        
        try {
            const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
            return paymentIntent;
        } catch (error) {
            console.error('Error canceling payment intent:', error);
            throw error;
        }
    },
    
    // Helper function to verify webhook signature
    constructWebhookEvent(payload, signature) {
        if (!stripe) {
            throw new Error('Stripe is not configured.');
        }
        
        if (!this.webhookSecret) {
            throw new Error('Stripe webhook secret is not configured.');
        }
        
        try {
            const event = stripe.webhooks.constructEvent(
                payload,
                signature,
                this.webhookSecret
            );
            return event;
        } catch (error) {
            console.error('Error verifying webhook signature:', error);
            throw error;
        }
    }
};

