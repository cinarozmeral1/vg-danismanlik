-- Partner System Database Schema
-- Migration for adding partner functionality

-- Partners table
CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    company_name VARCHAR(200),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partner earnings table
CREATE TABLE IF NOT EXISTS partner_earnings (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    earning_type VARCHAR(20) NOT NULL CHECK (earning_type IN ('fixed', 'percentage')),
    amount DECIMAL(10,2) NOT NULL,
    percentage_value DECIMAL(5,2), -- For percentage type earnings (e.g., 10.00 for 10%)
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    is_paid BOOLEAN DEFAULT FALSE,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add partner_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partners_verification_token ON partners(verification_token);
CREATE INDEX IF NOT EXISTS idx_partner_earnings_partner_id ON partner_earnings(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_earnings_user_id ON partner_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_users_partner_id ON users(partner_id);

-- Update trigger for partners table
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_partners_updated_at ON partners;
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION update_partners_updated_at();

-- Update trigger for partner_earnings table
DROP TRIGGER IF EXISTS update_partner_earnings_updated_at ON partner_earnings;
CREATE TRIGGER update_partner_earnings_updated_at BEFORE UPDATE ON partner_earnings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

