-- Remove passport type constraint to allow any text input
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_passport_type_check;
