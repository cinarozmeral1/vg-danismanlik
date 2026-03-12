-- Üniversite sıralama için sort_order alanı ekle
ALTER TABLE universities 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Mevcut üniversitelere sıra numarası ata (alfabetik sıraya göre)
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
    FROM universities
)
UPDATE universities 
SET sort_order = numbered.rn
FROM numbered
WHERE universities.id = numbered.id;

-- Index ekle performans için
CREATE INDEX IF NOT EXISTS idx_universities_sort_order 
ON universities(sort_order);









