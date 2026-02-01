-- Bölüm sıralama için sort_order alanı ekle
ALTER TABLE university_departments 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Mevcut bölümlere sıra numarası ata (alfabetik sıraya göre)
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY university_id ORDER BY name_tr) as rn
    FROM university_departments
)
UPDATE university_departments 
SET sort_order = numbered.rn
FROM numbered
WHERE university_departments.id = numbered.id;

-- Index ekle performans için
CREATE INDEX IF NOT EXISTS idx_university_departments_sort_order 
ON university_departments(university_id, sort_order);

