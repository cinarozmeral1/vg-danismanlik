-- Remove columns from universities table
-- This script removes the min-max tuition fee structure and country ranking

-- Remove tuition_fee_min and tuition_fee_max columns
ALTER TABLE universities DROP COLUMN IF EXISTS tuition_fee_min;
ALTER TABLE universities DROP COLUMN IF EXISTS tuition_fee_max;

-- Remove country_ranking column  
ALTER TABLE universities DROP COLUMN IF EXISTS country_ranking;

-- Add single tuition_fee column if it doesn't exist
ALTER TABLE universities ADD COLUMN IF NOT EXISTS tuition_fee DECIMAL(12,2);

-- Update existing records to set a default tuition_fee value
-- This will set tuition_fee to the average of min/max if they existed, or NULL
UPDATE universities 
SET tuition_fee = CASE 
    WHEN tuition_fee_min IS NOT NULL AND tuition_fee_max IS NOT NULL 
    THEN (tuition_fee_min + tuition_fee_max) / 2
    WHEN tuition_fee_min IS NOT NULL 
    THEN tuition_fee_min
    WHEN tuition_fee_max IS NOT NULL 
    THEN tuition_fee_max
    ELSE NULL
END
WHERE tuition_fee IS NULL;

-- Add comment to document the change
COMMENT ON COLUMN universities.tuition_fee IS 'Single tuition fee amount in EUR';
