-- Google OAuth Fields Migration
-- Add fields needed for Google OAuth authentication

-- Add google_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Add registered_via column (email, google)
ALTER TABLE users ADD COLUMN IF NOT EXISTS registered_via VARCHAR(50) DEFAULT 'email';

-- Add personal_info_completed flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_info_completed BOOLEAN DEFAULT false;

-- Create index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create index for registered_via
CREATE INDEX IF NOT EXISTS idx_users_registered_via ON users(registered_via);

-- Update existing users to have personal_info_completed = true if they have required fields
UPDATE users 
SET personal_info_completed = true 
WHERE tc_number IS NOT NULL 
  AND tc_number != '' 
  AND phone IS NOT NULL 
  AND phone != ''
  AND personal_info_completed IS NULL;

-- Comment: Run this migration with:
-- node database/run_google_oauth_migration.js
























