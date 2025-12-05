-- Migration: Switch from Stripe to GoPay and remove Wise transfer columns
-- This migration updates the services table for GoPay payment gateway

-- Drop Wise-related columns (we don't need them anymore)
ALTER TABLE services DROP COLUMN IF EXISTS wise_transferred CASCADE;
ALTER TABLE services DROP COLUMN IF EXISTS wise_transfer_date CASCADE;
ALTER TABLE services DROP COLUMN IF EXISTS wise_transfer_notes CASCADE;

-- Drop Stripe-related columns
ALTER TABLE services DROP COLUMN IF EXISTS stripe_payment_intent_id CASCADE;
ALTER TABLE services DROP COLUMN IF EXISTS stripe_payment_status CASCADE;

-- Add GoPay-related columns
ALTER TABLE services ADD COLUMN IF NOT EXISTS gopay_payment_id VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS gopay_payment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS paid_currency VARCHAR(3);

-- Update payment_logs table to support GoPay (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_logs') THEN
        -- Rename columns if they exist
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment_logs' AND column_name = 'stripe_event_type') THEN
            ALTER TABLE payment_logs RENAME COLUMN stripe_event_type TO payment_event_type;
        END IF;
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment_logs' AND column_name = 'stripe_event_id') THEN
            ALTER TABLE payment_logs RENAME COLUMN stripe_event_id TO payment_event_id;
        END IF;
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment_logs' AND column_name = 'payment_intent_id') THEN
            ALTER TABLE payment_logs RENAME COLUMN payment_intent_id TO payment_id;
        END IF;
    END IF;
END $$;

-- Add index for GoPay payment ID
CREATE INDEX IF NOT EXISTS idx_services_gopay_payment_id ON services(gopay_payment_id);

-- Add index for payment status
CREATE INDEX IF NOT EXISTS idx_services_gopay_payment_status ON services(gopay_payment_status);

-- Update existing records to use GoPay status
UPDATE services SET gopay_payment_status = 'paid' WHERE is_paid = true AND gopay_payment_status IS NULL;
UPDATE services SET gopay_payment_status = 'pending' WHERE is_paid = false AND gopay_payment_status IS NULL;

