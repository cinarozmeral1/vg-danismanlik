-- Add payment-related columns to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS paid_currency VARCHAR(3),
ADD COLUMN IF NOT EXISTS wise_transferred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wise_transfer_date DATE,
ADD COLUMN IF NOT EXISTS wise_transfer_notes TEXT;

-- Create payment_logs table for tracking all payment attempts and webhook events
CREATE TABLE IF NOT EXISTS payment_logs (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_event_type VARCHAR(100),
    stripe_event_id VARCHAR(255) UNIQUE,
    status VARCHAR(50),
    amount DECIMAL(10,2),
    currency VARCHAR(3),
    metadata TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_services_stripe_payment_intent ON services(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_services_stripe_status ON services(stripe_payment_status);
CREATE INDEX IF NOT EXISTS idx_services_wise_transferred ON services(wise_transferred);
CREATE INDEX IF NOT EXISTS idx_payment_logs_service_id ON payment_logs(service_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_stripe_event_id ON payment_logs(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at);

-- Add comments for documentation
COMMENT ON COLUMN services.stripe_payment_intent_id IS 'Stripe Payment Intent ID for tracking payments';
COMMENT ON COLUMN services.stripe_payment_status IS 'Current status from Stripe (requires_payment_method, requires_confirmation, requires_action, processing, succeeded, canceled)';
COMMENT ON COLUMN services.payment_method IS 'Payment method used (card, bank_transfer, etc.)';
COMMENT ON COLUMN services.transaction_id IS 'Internal transaction tracking ID';
COMMENT ON COLUMN services.paid_amount IS 'Actual amount paid (may differ from service amount due to currency conversion)';
COMMENT ON COLUMN services.paid_currency IS 'Currency used for payment';
COMMENT ON COLUMN services.wise_transferred IS 'Whether payment has been transferred to Wise account';
COMMENT ON COLUMN services.wise_transfer_date IS 'Date when payment was transferred to Wise';
COMMENT ON TABLE payment_logs IS 'Log of all payment attempts and Stripe webhook events';

