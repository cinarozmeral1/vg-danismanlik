-- Add file_data column to user_documents table for base64 storage
-- This migration adds a TEXT column to store base64 encoded file data

ALTER TABLE user_documents 
ADD COLUMN IF NOT EXISTS file_data TEXT;

-- Make file_path nullable since we'll use file_data instead
ALTER TABLE user_documents 
ALTER COLUMN file_path DROP NOT NULL;

-- Update existing records: set file_path to empty string if null
UPDATE user_documents 
SET file_path = '' 
WHERE file_path IS NULL;

-- Add comment
COMMENT ON COLUMN user_documents.file_data IS 'Base64 encoded file data';

