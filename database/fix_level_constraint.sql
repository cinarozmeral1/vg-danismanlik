-- Fix level constraint in university_programs table
-- Update the CHECK constraint to match frontend values

-- First, drop the existing constraint
ALTER TABLE university_programs DROP CONSTRAINT IF EXISTS university_programs_level_check;

-- Add new CHECK constraint with frontend values
ALTER TABLE university_programs ADD CONSTRAINT university_programs_level_check 
CHECK (level IN ('Lisans', 'Yüksek Lisans', 'Dil Okulu'));

-- Update existing data to match new constraint (if needed)
UPDATE university_programs SET level = 'Yüksek Lisans' WHERE level = 'Master';

-- Show the updated constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'university_programs'::regclass AND contype = 'c';

-- Show current level values
SELECT DISTINCT level FROM university_programs;
