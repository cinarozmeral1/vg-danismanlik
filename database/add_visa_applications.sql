-- Vize Başvuruları Tablosu
CREATE TABLE IF NOT EXISTS visa_applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    country VARCHAR(50) NOT NULL CHECK (country IN ('Germany', 'Czech Republic', 'Italy', 'Austria', 'UK', 'Poland', 'Hungary', 'Netherlands')),
    consulate_city VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vize Randevuları Tablosu (Birden fazla randevu eklenebilir)
CREATE TABLE IF NOT EXISTS visa_appointments (
    id SERIAL PRIMARY KEY,
    visa_application_id INTEGER REFERENCES visa_applications(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP NOT NULL,
    appointment_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_visa_applications_user_id ON visa_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_visa_applications_status ON visa_applications(status);
CREATE INDEX IF NOT EXISTS idx_visa_applications_country ON visa_applications(country);
CREATE INDEX IF NOT EXISTS idx_visa_appointments_visa_application_id ON visa_appointments(visa_application_id);

-- Triggers for updated_at
CREATE TRIGGER update_visa_applications_updated_at BEFORE UPDATE ON visa_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visa_appointments_updated_at BEFORE UPDATE ON visa_appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


