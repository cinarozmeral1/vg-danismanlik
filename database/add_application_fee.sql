-- Add application fee payment tracking to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_fee_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_fee_amount DECIMAL(10,2);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_fee_currency VARCHAR(3) DEFAULT 'EUR';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_fee_payment_date TIMESTAMP;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update existing applications to have default values
UPDATE applications SET application_fee_paid = FALSE WHERE application_fee_paid IS NULL;

