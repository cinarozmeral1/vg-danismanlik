-- Migration: Guardians System + New Profile Fields
-- Adds: current_school, home_address to users
-- Creates: proper guardians table
-- Migrates: existing mother/father data from users to guardians

-- 1. Add new profile fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_school VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_reminder_sent BOOLEAN DEFAULT FALSE;

-- 2. Drop old guardians table if exists (SQLite-era schema)
DROP TABLE IF EXISTS guardians;

-- 3. Create new guardians table (PostgreSQL)
CREATE TABLE IF NOT EXISTS guardians (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('Anne', 'Baba', 'Kardes', 'Diger')),
    tc_number VARCHAR(11),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_guardians_user_id ON guardians(user_id);
CREATE INDEX IF NOT EXISTS idx_guardians_relationship ON guardians(relationship);

-- 5. Create update trigger
CREATE OR REPLACE FUNCTION update_guardians_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_guardians_updated_at ON guardians;
CREATE TRIGGER update_guardians_updated_at BEFORE UPDATE ON guardians
    FOR EACH ROW EXECUTE FUNCTION update_guardians_updated_at();

-- 6. Migrate existing mother/father data from users table to guardians
INSERT INTO guardians (user_id, full_name, relationship, tc_number, phone, is_required, sort_order)
SELECT 
    id,
    TRIM(COALESCE(mother_name, '') || ' ' || COALESCE(mother_surname, '')),
    'Anne',
    mother_tc,
    mother_phone,
    TRUE,
    1
FROM users
WHERE (mother_name IS NOT NULL AND mother_name != '') 
   OR (mother_surname IS NOT NULL AND mother_surname != '');

INSERT INTO guardians (user_id, full_name, relationship, tc_number, phone, is_required, sort_order)
SELECT 
    id,
    TRIM(COALESCE(father_name, '') || ' ' || COALESCE(father_surname, '')),
    'Baba',
    father_tc,
    father_phone,
    TRUE,
    2
FROM users
WHERE (father_name IS NOT NULL AND father_name != '') 
   OR (father_surname IS NOT NULL AND father_surname != '');

