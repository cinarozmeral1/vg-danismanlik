-- Drop table if exists (for fresh migration)
DROP TABLE IF EXISTS student_stories CASCADE;

-- Create student_stories table (PostgreSQL)
CREATE TABLE student_stories (
    id SERIAL PRIMARY KEY,
    name_tr VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    university_tr VARCHAR(255),
    university_en VARCHAR(255),
    country_tr VARCHAR(100),
    country_en VARCHAR(100),
    story_tr TEXT,
    story_en TEXT,
    photo VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_student_stories_active ON student_stories(is_active);
CREATE INDEX IF NOT EXISTS idx_student_stories_order ON student_stories(display_order);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_student_stories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_stories_updated_at ON student_stories;
CREATE TRIGGER trigger_update_student_stories_updated_at
    BEFORE UPDATE ON student_stories
    FOR EACH ROW
    EXECUTE FUNCTION update_student_stories_updated_at();

-- Insert sample stories (existing ones)
INSERT INTO student_stories (name_tr, name_en, university_tr, university_en, country_tr, country_en, story_tr, story_en, display_order) VALUES
('Ahmet Yılmaz', 'Ahmet Yılmaz', 'Ludwig-Maximilians-Universität München', 'Ludwig-Maximilians-Universität München', 'Almanya', 'Germany', 
'Venture Global sayesinde Münih Üniversitesi''nde İşletme okuma hayalim gerçek oldu. Başvuru sürecinden vize aşamasına kadar her adımda yanımda oldular. Şimdi Avrupa''nın en iyi üniversitelerinden birinde eğitim alıyorum!',
'Thanks to Venture Global, my dream of studying Business Administration at Munich University came true. They were with me every step of the way from application to visa. Now I''m studying at one of Europe''s best universities!', 1),

('Zeynep Demir', 'Zeynep Demir', 'Politechnika Warszawska', 'Warsaw University of Technology', 'Polonya', 'Poland',
'Bilgisayar Mühendisliği okumak istiyordum ama nereden başlayacağımı bilmiyordum. Venture Global ekibi bana en uygun üniversiteyi buldu ve tüm süreci profesyonel bir şekilde yönetti. Çok memnunum!',
'I wanted to study Computer Engineering but didn''t know where to start. The Venture Global team found the most suitable university for me and managed the entire process professionally. Very satisfied!', 2),

('Can Öztürk', 'Can Öztürk', 'Budapest University of Technology', 'Budapest University of Technology', 'Macaristan', 'Hungary',
'Macaristan''da mühendislik eğitimi almak harika bir deneyim. Venture Global''in danışmanlık hizmeti sayesinde hem kabul aldım hem de burs kazandım. Herkese tavsiye ederim!',
'Studying engineering in Hungary is a great experience. Thanks to Venture Global''s consultancy service, I was both accepted and won a scholarship. I recommend them to everyone!', 3);
