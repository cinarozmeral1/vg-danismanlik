-- Allow NULL values for earning_date in partner_earnings table
-- This is needed because earning_date should only be set when payment is made

ALTER TABLE partner_earnings ALTER COLUMN earning_date DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'partner_earnings' AND column_name = 'earning_date';
