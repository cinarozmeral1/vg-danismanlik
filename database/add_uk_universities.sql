-- İngiltere Üniversiteleri Migration Script
-- Bu script mevcut UK üniversitelerini silip yenilerini ekler

-- Önce mevcut UK üniversitelerinin bölümlerini sil
DELETE FROM university_departments WHERE university_id IN (SELECT id FROM universities WHERE country = 'UK');

-- Sonra mevcut UK üniversitelerini sil
DELETE FROM universities WHERE country = 'UK';

-- 1. University of Manchester
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'University of Manchester',
    'UK',
    'Manchester',
    'https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/University_of_Manchester_logo.svg/1200px-University_of_Manchester_logo.svg.png',
    27,
    'University of Manchester, 1824 yılında kurulan ve İngiltere''nin en prestijli üniversitelerinden biridir. Russell Group üyesi olan üniversite, dünya sıralamasında ilk 30 içinde yer almaktadır. 25 Nobel ödüllü mezun ve akademisyene ev sahipliği yapmış olan Manchester, özellikle mühendislik, tıp, işletme ve sosyal bilimler alanlarında dünya çapında tanınmaktadır. Kampüs, Manchester şehir merkezinde yer almakta ve öğrencilere modern tesisler, zengin kütüphane kaynakları ve aktif bir öğrenci yaşamı sunmaktadır.',
    NULL,
    true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 2. University of Westminster
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'University of Westminster',
    'UK',
    'London',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/University_of_Westminster_logo.svg/1200px-University_of_Westminster_logo.svg.png',
    NULL,
    'University of Westminster, 1838 yılında kurulan ve Londra''nın merkezinde yer alan köklü bir üniversitedir. Özellikle medya, iletişim, mimarlık ve moda alanlarında dünya çapında tanınmaktadır. BBC''nin kurucusu John Logie Baird dahil olmak üzere birçok ünlü mezuna sahiptir. Regent Street, Marylebone, Cavendish ve Harrow olmak üzere dört farklı kampüste eğitim vermektedir. Uluslararası öğrenciler için çeşitli burs imkanları sunmaktadır.',
    NULL,
    true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 3. Regent's University London
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'Regent''s University London',
    'UK',
    'London',
    'https://www.regents.ac.uk/wp-content/uploads/2021/03/regents-logo.png',
    NULL,
    'Regent''s University London, Londra''nın merkezinde, Regent''s Park içinde yer alan özel bir üniversitedir. 1984 yılında kurulan üniversite, işletme, moda, film, psikoterapi ve liberal sanatlar alanlarında uzmanlaşmıştır. Küçük sınıf mevcutları ve kişiselleştirilmiş eğitim yaklaşımıyla öne çıkmaktadır. 140''tan fazla ülkeden gelen öğrencileriyle gerçek anlamda uluslararası bir ortam sunmaktadır. Londra''nın en güzel parklarından birinde yer alan kampüsü, benzersiz bir öğrencilik deneyimi sağlamaktadır.',
    NULL,
    true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 4. University of Winchester
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'University of Winchester',
    'UK',
    'Winchester',
    'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/University_of_Winchester_logo.svg/1200px-University_of_Winchester_logo.svg.png',
    NULL,
    'University of Winchester, 1840 yılında kurulan ve İngiltere''nin en eski eğitim kurumlarından biridir. Winchester şehrinde yer alan üniversite, tarihi atmosferi ve modern eğitim olanaklarını bir arada sunmaktadır. Eğitim, hukuk, işletme, psikoloji ve yaratıcı sanatlar alanlarında güçlü programlara sahiptir. Küçük ve samimi kampüs ortamı, öğrencilere kişiselleştirilmiş destek ve güçlü bir topluluk hissi sunmaktadır. Londra''ya sadece bir saat mesafededir.',
    NULL,
    true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 5. Cardiff University
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'Cardiff University',
    'UK',
    'Cardiff',
    'https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Cardiff_University_logo.svg/1200px-Cardiff_University_logo.svg.png',
    154,
    'Cardiff University, 1883 yılında kurulan ve Galler''in başkenti Cardiff''te yer alan prestijli bir araştırma üniversitesidir. Russell Group üyesi olan üniversite, özellikle tıp, mühendislik, mimarlık ve gazetecilik alanlarında dünya çapında tanınmaktadır. Modern kampüsü, şehir merkezinde yer almakta ve öğrencilere mükemmel tesisler sunmaktadır. 200''den fazla ülkeden gelen uluslararası öğrenci topluluğuyla çok kültürlü bir ortam sağlamaktadır.',
    NULL,
    true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 6. London School of Economics and Political Science (LSE)
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'London School of Economics and Political Science (LSE)',
    'UK',
    'London',
    'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/London_School_of_Economics_logo.svg/1200px-London_School_of_Economics_logo.svg.png',
    45,
    'London School of Economics and Political Science (LSE), 1895 yılında kurulan ve sosyal bilimler alanında dünyanın en önde gelen üniversitelerinden biridir. Russell Group ve G5 üyesi olan LSE, ekonomi, siyaset bilimi, hukuk, sosyoloji ve uluslararası ilişkiler alanlarında dünya lideridir. 18 Nobel ödüllü mezun ve akademisyene sahiptir. Londra''nın kalbinde, Holborn''da yer alan kampüsü, öğrencilere eşsiz kariyer fırsatları sunmaktadır. Dünya liderlerini, iş dünyası yöneticilerini ve akademisyenleri yetiştiren seçkin bir kurumdur.',
    NULL,
    true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 7. University of Edinburgh
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'University of Edinburgh',
    'UK',
    'Edinburgh',
    'https://upload.wikimedia.org/wikipedia/en/thumb/0/0e/University_of_Edinburgh_logo.svg/1200px-University_of_Edinburgh_logo.svg.png',
    15,
    'University of Edinburgh, 1582 yılında kurulan ve dünyanın en eski ve en prestijli üniversitelerinden biridir. Russell Group üyesi olan Edinburgh, tıp, hukuk, mühendislik, felsefe ve yapay zeka alanlarında dünya çapında liderdir. İskoçya''nın başkentinde yer alan tarihi kampüsü, UNESCO Dünya Mirası listesindeki şehirle bütünleşmiş durumdadır. Darwin, Hume, Alexander Graham Bell gibi tarihi isimlerin yetiştiği bu köklü kurum, her yıl dünya genelinden binlerce öğrenciyi ağırlamaktadır.',
    NULL,
    true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 8. King's College London
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'King''s College London',
    'UK',
    'London',
    'https://upload.wikimedia.org/wikipedia/en/thumb/e/e7/King%27s_College_London_logo.svg/1200px-King%27s_College_London_logo.svg.png',
    37,
    'King''s College London, 1829 yılında kurulan ve İngiltere''nin en eski üniversitelerinden biridir. Russell Group ve Golden Triangle üyesi olan King''s, özellikle tıp, hukuk, uluslararası ilişkiler ve beşeri bilimler alanlarında dünya çapında tanınmaktadır. 14 Nobel ödüllü mezun ve akademisyene sahiptir. Londra''nın merkezinde, Strand, Waterloo ve Guy''s kampüslerinde eğitim vermektedir. Dünya sıralamasında sürekli ilk 40 içinde yer alan prestijli bir araştırma üniversitesidir.',
    NULL,
    true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;

-- 9. University of Sussex
INSERT INTO universities (name, country, city, logo_url, world_ranking, description, requirements, is_active, is_featured, created_at, updated_at)
VALUES (
    'University of Sussex',
    'UK',
    'Brighton',
    'https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/University_of_Sussex_Logo.svg/1200px-University_of_Sussex_Logo.svg.png',
    139,
    'University of Sussex, 1961 yılında kurulan ve İngiltere''nin önde gelen araştırma üniversitelerinden biridir. Brighton yakınlarında, South Downs Milli Parkı içinde yer alan kampüsü, doğa ile iç içe benzersiz bir öğrencilik deneyimi sunmaktadır. Özellikle kalkınma çalışmaları, uluslararası ilişkiler, psikoloji ve medya alanlarında dünya çapında tanınmaktadır. 5 Nobel ödüllü akademisyene ev sahipliği yapmıştır. Londra''ya sadece bir saat mesafede olan Sussex, canlı Brighton şehrinin tüm olanaklarını öğrencilerine sunmaktadır.',
    NULL,
    true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) RETURNING id;



















