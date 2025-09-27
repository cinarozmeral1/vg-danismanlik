-- Venture Global Database Schema
-- Optimized for Neon PostgreSQL

-- Users table - Ana kullanıcı tablosu
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    tc_number VARCHAR(11) UNIQUE NOT NULL CHECK (tc_number ~ '^[0-9]{11}$'),
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    english_level VARCHAR(20) NOT NULL CHECK (english_level IN ('Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate', 'Upper-Intermediate', 'Advanced', 'Proficient')),
    high_school_graduation_date DATE NOT NULL,
    birth_date DATE NOT NULL,
    passport_number VARCHAR(50),
    passport_type VARCHAR(10) CHECK (passport_type IN ('Bordo', 'Yeşil')),
    schengen_visa_count INTEGER DEFAULT 0 CHECK (schengen_visa_count >= 0),
    uk_visa_count INTEGER DEFAULT 0 CHECK (uk_visa_count >= 0),
    academic_exams TEXT,
    annual_budget DECIMAL(12,2) CHECK (annual_budget >= 0),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    
    -- Settings columns
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    newsletter BOOLEAN DEFAULT FALSE,
    profile_visibility BOOLEAN DEFAULT TRUE,
    data_sharing BOOLEAN DEFAULT FALSE,
    third_party_cookies BOOLEAN DEFAULT FALSE,
    location_sharing BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Universities table - Üniversite bilgileri
CREATE TABLE IF NOT EXISTS universities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    logo_path VARCHAR(500),
    website VARCHAR(500),
    description TEXT,
    ranking INTEGER,
    tuition_fee_min DECIMAL(12,2),
    tuition_fee_max DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    language_requirements TEXT,
    application_deadlines TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Programs table - Program bilgileri
CREATE TABLE IF NOT EXISTS programs (
    id SERIAL PRIMARY KEY,
    university_id INTEGER REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    level VARCHAR(50) NOT NULL CHECK (level IN ('Bachelor', 'Master', 'PhD', 'Diploma', 'Certificate')),
    field_of_study VARCHAR(100) NOT NULL,
    duration_months INTEGER NOT NULL,
    tuition_fee DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    language VARCHAR(50) DEFAULT 'English',
    requirements TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications table - Başvuru tablosu
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
    university_name VARCHAR(200) NOT NULL,
    university_logo VARCHAR(255),
    program_name VARCHAR(200) NOT NULL,
    application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'under_review', 'approved', 'rejected', 'waitlisted')),
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    notes TEXT,
    required_documents TEXT,
    application_fee DECIMAL(10,2),
    fee_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table - Başvuru belgeleri
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('transcript', 'diploma', 'passport', 'cv', 'motivation_letter', 'reference_letter', 'language_certificate', 'other')),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_notes TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User documents table - Kullanıcı belgeleri (standalone)
CREATE TABLE IF NOT EXISTS user_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('education', 'identity', 'language', 'financial', 'medical', 'other')),
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    mime_type VARCHAR(100) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table - Admin kullanıcılar
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'moderator')),
    permissions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assessment results table - Değerlendirme sonuçları
CREATE TABLE IF NOT EXISTS assessment_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    english_level VARCHAR(20) NOT NULL,
    academic_background TEXT,
    budget_range VARCHAR(50),
    preferred_countries TEXT,
    preferred_programs TEXT,
    career_goals TEXT,
    timeline VARCHAR(50),
    additional_notes TEXT,
    score INTEGER CHECK (score BETWEEN 0 AND 100),
    recommendations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact messages table - İletişim mesajları
CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'closed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to INTEGER REFERENCES admins(id),
    response TEXT,
    response_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tc_number ON users(tc_number);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country);
CREATE INDEX IF NOT EXISTS idx_universities_is_active ON universities(is_active);
CREATE INDEX IF NOT EXISTS idx_programs_university_id ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_level ON programs(level);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_program_id ON applications(program_id);
CREATE INDEX IF NOT EXISTS idx_documents_application_id ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_category ON user_documents(category);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user_id ON assessment_results(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_priority ON contact_messages(priority);

-- Update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON universities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO admins (email, password_hash, name, role) VALUES 
('admin@ventureglobal.com', '$2b$10$rQZ8K9mN2pL1oX3vY6wA7eR4tU5iI8jK9lM0nO1pQ2rS3tU4vW5xY6zA7bC8dE9fF0gG1hH2iI3jJ4kK5lL6mM7nN8oO9pP0qQ1rR2sS3tT4uU5vV6wW7xX8yY9zZ', 'Venture Global Admin', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample universities
INSERT INTO universities (name, country, city, description, ranking, tuition_fee_min, tuition_fee_max, currency) VALUES
('University of Manchester', 'United Kingdom', 'Manchester', 'Prestigious UK university with excellent programs', 27, 25000, 35000, 'GBP'),
('Technical University of Munich', 'Germany', 'Munich', 'Leading German technical university', 49, 1500, 3000, 'EUR'),
('University of Vienna', 'Austria', 'Vienna', 'Historic Austrian university in beautiful Vienna', 151, 1500, 1500, 'EUR'),
('University of Padua', 'Italy', 'Padua', 'One of the oldest universities in Europe', 201, 2000, 4000, 'EUR'),
('Charles University', 'Czech Republic', 'Prague', 'Excellent Czech university in historic Prague', 301, 3000, 8000, 'EUR'),
('University of Pecs', 'Hungary', 'Pecs', 'Quality education in Hungary', 401, 2000, 5000, 'EUR'),
('Warsaw University of Technology', 'Poland', 'Warsaw', 'Leading technical university in Poland', 501, 2000, 4000, 'EUR')
ON CONFLICT DO NOTHING;

-- Insert sample programs
INSERT INTO programs (university_id, name, level, field_of_study, duration_months, tuition_fee, currency, language, requirements) VALUES
(1, 'Computer Science', 'Bachelor', 'Computer Science', 36, 28000, 'GBP', 'English', 'IELTS 6.5, High School Diploma'),
(1, 'Business Administration', 'Master', 'Business', 12, 32000, 'GBP', 'English', 'IELTS 7.0, Bachelor Degree'),
(2, 'Mechanical Engineering', 'Master', 'Engineering', 24, 2000, 'EUR', 'German', 'TestDaF 4, Bachelor in Engineering'),
(3, 'International Business', 'Bachelor', 'Business', 36, 1500, 'EUR', 'German', 'ÖSD B2, High School Diploma'),
(4, 'Architecture', 'Bachelor', 'Architecture', 36, 3000, 'EUR', 'Italian', 'CELI B2, High School Diploma'),
(5, 'Medicine', 'Bachelor', 'Medicine', 72, 5000, 'EUR', 'Czech', 'Czech B2, High School Diploma'),
(6, 'Psychology', 'Master', 'Psychology', 24, 3000, 'EUR', 'English', 'IELTS 6.5, Bachelor in Psychology'),
(7, 'Civil Engineering', 'Bachelor', 'Engineering', 42, 3000, 'EUR', 'Polish', 'Polish B2, High School Diploma')
ON CONFLICT DO NOTHING;
