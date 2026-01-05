-- AI Recommendations table for Student Wizard
-- Bu tablo öğrenci sihirbazı sonuçlarını saklar

CREATE TABLE IF NOT EXISTS ai_recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Temel Bilgiler
    education_level VARCHAR(20), -- bachelor/master
    english_level VARCHAR(10),
    english_exam_type VARCHAR(20),
    english_exam_score INTEGER,
    
    -- Lisans İçin
    high_school_gpa INTEGER,
    math_level INTEGER,
    high_school_activities TEXT[],
    
    -- Yüksek Lisans İçin
    bachelor_field VARCHAR(100),
    bachelor_gpa DECIMAL(3,2),
    bachelor_university_type VARCHAR(50),
    work_experience VARCHAR(20),
    bachelor_activities TEXT[],
    
    -- Ortak
    interests TEXT[],
    country_preferences TEXT[],
    budget_range VARCHAR(50),
    additional_notes TEXT,
    
    -- AI Sonuçları
    prep_school_needed BOOLEAN DEFAULT FALSE,
    prep_school_type VARCHAR(50), -- language/academic/both
    prep_school_suggestion TEXT,
    recommended_university_id INTEGER,
    recommended_program_id INTEGER,
    recommended_country VARCHAR(100),
    recommended_city VARCHAR(100),
    recommended_tuition VARCHAR(100),
    ai_reasoning TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created_at ON ai_recommendations(created_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_recommendations_updated_at ON ai_recommendations;
CREATE TRIGGER trigger_ai_recommendations_updated_at
    BEFORE UPDATE ON ai_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_recommendations_updated_at();

-- Hazırlık okulları referans tablosu
CREATE TABLE IF NOT EXISTS prep_schools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    prep_type VARCHAR(50), -- language/academic/both
    website VARCHAR(500),
    description TEXT,
    estimated_cost VARCHAR(100),
    duration_months INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default prep schools
INSERT INTO prep_schools (name, country, city, prep_type, description, estimated_cost, duration_months) VALUES
('Universita per Stranieri di Perugia', 'Italy', 'Perugia', 'language', 'İtalya''nın en prestijli dil okulu, yabancı öğrenciler için İtalyanca eğitimi', '3.000-5.000 EUR', 6),
('Politecnico Milano Foundation Year', 'Italy', 'Milan', 'academic', 'Mühendislik ve tasarım alanlarında hazırlık programı', '8.000-12.000 EUR', 12),
('Charles University Language Center', 'Czech Republic', 'Prague', 'language', 'Çekçe ve İngilizce dil hazırlık programları', '4.000-6.000 EUR', 10),
('Czech Technical University Prep', 'Czech Republic', 'Prague', 'academic', 'Teknik alanlarda akademik hazırlık', '5.000-7.000 EUR', 12),
('Kaplan International Pathways', 'UK', 'Various', 'both', 'İngiltere üniversitelerine pathway programları', '15.000-20.000 GBP', 12),
('INTO University Partnerships', 'UK', 'Various', 'both', 'Top İngiltere üniversitelerine hazırlık', '14.000-18.000 GBP', 12),
('Studienkolleg', 'Germany', 'Various', 'academic', 'Alman üniversitelerine akademik hazırlık', '0-500 EUR', 12),
('Goethe Institut', 'Germany', 'Various', 'language', 'Almanca dil eğitimi', '3.000-6.000 EUR', 6),
('Warsaw University Prep Course', 'Poland', 'Warsaw', 'both', 'Polonya üniversitelerine hazırlık', '3.000-5.000 EUR', 10),
('University of Vienna Prep', 'Austria', 'Vienna', 'both', 'Avusturya üniversitelerine hazırlık', '4.000-6.000 EUR', 12),
('Budapest Prep Academy', 'Hungary', 'Budapest', 'both', 'Macaristan üniversitelerine hazırlık', '3.500-5.500 EUR', 10)
ON CONFLICT DO NOTHING;

-- Index for prep_schools
CREATE INDEX IF NOT EXISTS idx_prep_schools_country ON prep_schools(country);
CREATE INDEX IF NOT EXISTS idx_prep_schools_prep_type ON prep_schools(prep_type);

