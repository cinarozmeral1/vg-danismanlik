-- Migration: Make user profile fields nullable
-- Bu migration, kayıt sırasında zorunlu olmayan alanları nullable yapar
-- Kullanıcılar bu bilgileri daha sonra dolduracak

-- TC Number nullable yap (UNIQUE constraint kalsın)
ALTER TABLE users 
ALTER COLUMN tc_number DROP NOT NULL;

-- Phone nullable yap (UNIQUE constraint kalsın)
ALTER TABLE users 
ALTER COLUMN phone DROP NOT NULL;

-- High school graduation date nullable yap
ALTER TABLE users 
ALTER COLUMN high_school_graduation_date DROP NOT NULL;

-- Birth date nullable yap
ALTER TABLE users 
ALTER COLUMN birth_date DROP NOT NULL;

-- English level nullable yap (eğer NOT NULL ise)
ALTER TABLE users 
ALTER COLUMN english_level DROP NOT NULL;

-- Placeholder değerleri NULL yap
UPDATE users 
SET tc_number = NULL 
WHERE tc_number ~ '^[0-9]{11}$' 
  AND CAST(tc_number AS BIGINT) < 10000000000
  AND registered_via IN ('email', 'google');

UPDATE users 
SET high_school_graduation_date = NULL 
WHERE high_school_graduation_date = '2000-01-01' 
  AND registered_via IN ('email', 'google');

UPDATE users 
SET birth_date = NULL 
WHERE birth_date = '2000-01-01' 
  AND registered_via IN ('email', 'google');

UPDATE users 
SET english_level = NULL 
WHERE english_level = 'Belirtilmedi' 
  AND registered_via IN ('email', 'google');

-- Verify changes
SELECT id, email, tc_number, phone, birth_date, high_school_graduation_date, english_level, registered_via 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;






















