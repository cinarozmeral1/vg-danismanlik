-- Student-Partner çoklu atama tablosu
-- Bir öğrenciye birden fazla partner atanabilir

CREATE TABLE IF NOT EXISTS student_partners (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(student_id, partner_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_student_partners_student ON student_partners(student_id);
CREATE INDEX IF NOT EXISTS idx_student_partners_partner ON student_partners(partner_id);

















