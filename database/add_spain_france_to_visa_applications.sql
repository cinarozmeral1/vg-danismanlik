-- Migration: extend visa_applications.country CHECK constraint to include Spain and France
-- Run this once on production after deploying the Spain/France integration.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'visa_applications' AND constraint_name = 'visa_applications_country_check'
    ) THEN
        ALTER TABLE visa_applications DROP CONSTRAINT visa_applications_country_check;
    END IF;
END $$;

ALTER TABLE visa_applications
    ADD CONSTRAINT visa_applications_country_check
    CHECK (country IN (
        'Germany',
        'Czech Republic',
        'Italy',
        'Austria',
        'UK',
        'Poland',
        'Hungary',
        'Netherlands',
        'Spain',
        'France'
    ));
