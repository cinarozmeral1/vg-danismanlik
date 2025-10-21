-- Remove category constraint from user_documents table
-- This allows category to be NULL since we removed category selection from the UI

-- First, drop the existing constraint
ALTER TABLE user_documents DROP CONSTRAINT IF EXISTS user_documents_category_check;

-- Make category column nullable
ALTER TABLE user_documents ALTER COLUMN category DROP NOT NULL;

-- Optionally, you can also remove the category column entirely if not needed
-- ALTER TABLE user_documents DROP COLUMN IF EXISTS category;
