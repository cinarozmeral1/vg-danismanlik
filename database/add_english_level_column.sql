-- Add english_level column to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS english_level VARCHAR(20);

-- Add country column to applications table  
ALTER TABLE applications ADD COLUMN IF NOT EXISTS country VARCHAR(50);