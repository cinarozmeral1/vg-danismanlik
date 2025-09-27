-- Missing tables for universities functionality

-- University Programs table (for detailed program information)
CREATE TABLE IF NOT EXISTS university_programs (
    id SERIAL PRIMARY KEY,
    university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    level VARCHAR(50) NOT NULL CHECK (level IN ('Bachelor', 'Master', 'PhD', 'Diploma', 'Certificate')),
    field_of_study VARCHAR(100) NOT NULL,
    duration_months INTEGER NOT NULL,
    tuition_fee DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    language VARCHAR(50) DEFAULT 'English',
    requirements TEXT,
    requirements_en TEXT,
    description TEXT,
    description_en TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- University Images table
CREATE TABLE IF NOT EXISTS university_images (
    id SERIAL PRIMARY KEY,
    university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(200),
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to universities table
ALTER TABLE universities ADD COLUMN IF NOT EXISTS name_en VARCHAR(200);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS program_count INTEGER DEFAULT 0;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS application_fee DECIMAL(10,2);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS world_ranking INTEGER;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS country_ranking INTEGER;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_university_programs_university_id ON university_programs(university_id);
CREATE INDEX IF NOT EXISTS idx_university_programs_level ON university_programs(level);
CREATE INDEX IF NOT EXISTS idx_university_images_university_id ON university_images(university_id);
CREATE INDEX IF NOT EXISTS idx_university_images_primary ON university_images(is_primary);

-- Update trigger for university_programs
CREATE TRIGGER update_university_programs_updated_at BEFORE UPDATE ON university_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample university programs
INSERT INTO university_programs (university_id, name, name_en, level, field_of_study, duration_months, tuition_fee, currency, language, requirements, description) VALUES
(1, 'Computer Science', 'Computer Science', 'Bachelor', 'Computer Science', 36, 28000, 'GBP', 'English', 'IELTS 6.5, High School Diploma', 'Comprehensive computer science program'),
(1, 'Business Administration', 'Business Administration', 'Master', 'Business', 12, 32000, 'GBP', 'English', 'IELTS 7.0, Bachelor Degree', 'Advanced business management program'),
(2, 'Mechanical Engineering', 'Mechanical Engineering', 'Master', 'Engineering', 24, 2000, 'EUR', 'German', 'TestDaF 4, Bachelor in Engineering', 'German engineering excellence'),
(3, 'International Business', 'International Business', 'Bachelor', 'Business', 36, 1500, 'EUR', 'German', 'ÖSD B2, High School Diploma', 'International business in German'),
(4, 'Architecture', 'Architecture', 'Bachelor', 'Architecture', 36, 3000, 'EUR', 'Italian', 'CELI B2, High School Diploma', 'Classical architecture studies'),
(5, 'Medicine', 'Medicine', 'Bachelor', 'Medicine', 72, 5000, 'EUR', 'Czech', 'Czech B2, High School Diploma', 'Medical studies in Czech Republic'),
(6, 'Psychology', 'Psychology', 'Master', 'Psychology', 24, 3000, 'EUR', 'English', 'IELTS 6.5, Bachelor in Psychology', 'Psychology studies in English'),
(7, 'Civil Engineering', 'Civil Engineering', 'Bachelor', 'Engineering', 42, 3000, 'EUR', 'Polish', 'Polish B2, High School Diploma', 'Civil engineering in Poland')
ON CONFLICT DO NOTHING;

-- Update universities table with additional information
UPDATE universities SET 
    name_en = name,
    logo_url = '/images/logos/' || LOWER(REPLACE(country, ' ', '-')) || '-logo.png',
    website_url = 'https://www.' || LOWER(REPLACE(name, ' ', '')) || '.edu',
    program_count = 3,
    application_fee = 100.00,
    world_ranking = ranking,
    country_ranking = 1,
    is_featured = CASE WHEN ranking <= 100 THEN TRUE ELSE FALSE END,
    is_partner = TRUE
WHERE id > 0;

-- Insert sample university images
INSERT INTO university_images (university_id, image_url, alt_text, is_primary, sort_order) VALUES
(1, '/images/universities/manchester-campus.jpg', 'University of Manchester Campus', TRUE, 1),
(2, '/images/universities/tum-building.jpg', 'Technical University of Munich Building', TRUE, 1),
(3, '/images/universities/vienna-university.jpg', 'University of Vienna Building', TRUE, 1),
(4, '/images/universities/padua-university.jpg', 'University of Padua Building', TRUE, 1),
(5, '/images/universities/charles-university.jpg', 'Charles University Building', TRUE, 1),
(6, '/images/universities/pecs-university.jpg', 'University of Pecs Building', TRUE, 1),
(7, '/images/universities/warsaw-tech.jpg', 'Warsaw University of Technology Building', TRUE, 1)
ON CONFLICT DO NOTHING;
