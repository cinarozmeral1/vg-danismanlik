-- Performance optimization indexes for Venture Global database

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Applications table indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);

-- Universities table indexes
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country);
CREATE INDEX IF NOT EXISTS idx_universities_is_active ON universities(is_active);
CREATE INDEX IF NOT EXISTS idx_universities_is_featured ON universities(is_featured);
CREATE INDEX IF NOT EXISTS idx_universities_country_active ON universities(country, is_active);

-- User documents table indexes
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON user_documents(created_at);

-- Services table indexes
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_due_date ON services(due_date);
CREATE INDEX IF NOT EXISTS idx_services_is_paid ON services(is_paid);

-- Student checklist table indexes
CREATE INDEX IF NOT EXISTS idx_student_checklist_user_id ON student_checklist(user_id);
CREATE INDEX IF NOT EXISTS idx_student_checklist_is_completed ON student_checklist(is_completed);

-- Notes table indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes(priority);
