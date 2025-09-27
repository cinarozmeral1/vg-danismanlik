-- Update university_programs table to match frontend
-- Remove unused columns and update data types

-- Remove unused columns
ALTER TABLE university_programs DROP COLUMN IF EXISTS requirements;
ALTER TABLE university_programs DROP COLUMN IF EXISTS requirements_en;
ALTER TABLE university_programs DROP COLUMN IF EXISTS description;
ALTER TABLE university_programs DROP COLUMN IF EXISTS description_en;

-- Change tuition_fee from numeric(12,2) to integer (remove decimals)
ALTER TABLE university_programs ALTER COLUMN tuition_fee TYPE integer USING ROUND(tuition_fee);

-- Update level CHECK constraint to match frontend options
ALTER TABLE university_programs DROP CONSTRAINT IF EXISTS university_programs_level_check;

-- Add new CHECK constraint for level
ALTER TABLE university_programs ADD CONSTRAINT university_programs_level_check 
CHECK (level IN ('Bachelor', 'Master', 'PhD', 'Diploma', 'Certificate'));

-- Update existing data to match new level values
UPDATE university_programs SET level = 'Bachelor' WHERE level = 'Lisans';
UPDATE university_programs SET level = 'Master' WHERE level = 'Yüksek Lisans';
UPDATE university_programs SET level = 'Diploma' WHERE level = 'Dil Okulu';

-- Add comment
COMMENT ON TABLE university_programs IS 'Updated to match frontend requirements - removed unused columns, changed tuition_fee to integer, updated level options';

-- Show final table structure
\d university_programs;
