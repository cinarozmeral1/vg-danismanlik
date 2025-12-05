/**
 * GoPay Configuration
 * GoPay is the leading payment gateway in Czech Republic
 * https://www.gopay.com/
 */

const axios = require('axios');

// GoPay API Configuration
const gopayConfig = {
    // GoPay API credentials (will be set when company is registered)
    goid: process.env.GOPAY_GOID || '', // GoPay ID
    clientId: process.env.GOPAY_CLIENT_ID || '',
    clientSecret: process.env.GOPAY_CLIENT_SECRET || '',
    
    // Environment: 'test' or 'production'
    environment: process.env.GOPAY_ENVIRONMENT || 'test',
    
    // API URLs
    testUrl: 'https://gw.sandbox.gopay.com',
    productionUrl: 'https://gate.gopay.cz',
    
    // Get base URL based on environment
    getBaseUrl() {
        return this.environment === 'production' ? this.productionUrl : this.testUrl;
    },
    
    // Check if GoPay is configured
    isConfigured() {
        return !!(this.goid && this.clientId && this.clientSecret);
    },
    
    // Supported currencies
    supportedCurrencies: ['CZK', 'EUR', 'USD', 'GBP'],
    
    // Default currency
    defaultCurrency: 'EUR'
};

/**
 * GoPay Payment Service
 */
class GoPayService {
    constructor() {
        this.config = gopayConfig;
        this.accessToken = null;
        this.tokenExpiry = null;
    }
    
    /**
     * Get OAuth access token
     */
    async getAccessToken() {
        // If token exists and not expired, return it
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        
        if (!this.config.isConfigured()) {
            throw new Error('GoPay is not configured yet');
        }
        
        try {
            const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
            
            const response = await axios.post(
                `${this.config.getBaseUrl()}/api/oauth2/token`,
                'grant_type=client_credentials&scope=payment-all',
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            
            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            return this.accessToken;
        } catch (error) {
            console.error('GoPay authentication error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with GoPay');
        }
    }
    
    /**
     * Create a payment
     */
    async createPayment({ amount, currency, orderId, description, returnUrl, notifyUrl, customerEmail }) {
        if (!this.config.isConfigured()) {
            throw new Error('GoPay is not configured yet. Please add your credentials.');
        }
        
        const token = await this.getAccessToken();
        
        // Convert amount to smallest unit (cents/halers)
        const amountInCents = Math.round(amount * 100);
        
        const paymentData = {
            payer: {
                contact: {
                    email: customerEmail
                }
            },
            target: {
                type: 'ACCOUNT',
                goid: this.config.goid
            },
            amount: amountInCents,
            currency: currency,
            order_number: orderId.toString(),
            order_description: description,
            items: [
                {
                    name: description,
                    amount: amountInCents,
                    count: 1
                }
            ],
            callback: {
                return_url: returnUrl,
                notification_url: notifyUrl
            },
            lang: 'EN' // Can be: CS, EN, SK, DE, RU, etc.
        };
        
        try {
            const response = await axios.post(
                `${this.config.getBaseUrl()}/api/payments/payment`,
                paymentData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return {
                id: response.data.id,
                gw_url: response.data.gw_url, // URL to redirect user to payment gateway
                state: response.data.state
            };
        } catch (error) {
            console.error('GoPay create payment error:', error.response?.data || error.message);
            throw new Error('Failed to create GoPay payment');
        }
    }
    
    /**
     * Get payment status
     */
    async getPaymentStatus(paymentId) {
        if (!this.config.isConfigured()) {
            throw new Error('GoPay is not configured yet');
        }
        
        const token = await this.getAccessToken();
        
        try {
            const response = await axios.get(
                `${this.config.getBaseUrl()}/api/payments/payment/${paymentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return response.data;
        } catch (error) {
            console.error('GoPay get status error:', error.response?.data || error.message);
            throw new Error('Failed to get payment status from GoPay');
        }
    }
}

// Export singleton instance
const goPayService = new GoPayService();

module.exports = {
    gopayConfig,
    goPayService
};

