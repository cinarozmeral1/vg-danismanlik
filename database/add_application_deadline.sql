-- Add application_deadline column to universities table
-- This is a safe migration that won't affect existing data
ALTER TABLE universities ADD COLUMN IF NOT EXISTS application_deadline DATE;

