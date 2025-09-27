const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: 'postgres://neondb_owner:npg_Sd7p4ULFtBmx@ep-snowy-sound-ad15kvuj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Türkiye'deki popüler liselerin listesi
const turkishSchools = [
    // İstanbul Liseleri
    { name: 'Galatasaray Lisesi', city: 'İstanbul', district: 'Beyoğlu', school_type: 'Anadolu Lisesi' },
    { name: 'İstanbul Erkek Lisesi', city: 'İstanbul', district: 'Fatih', school_type: 'Anadolu Lisesi' },
    { name: 'Kabataş Erkek Lisesi', city: 'İstanbul', district: 'Beşiktaş', school_type: 'Anadolu Lisesi' },
    { name: 'Cağaloğlu Anadolu Lisesi', city: 'İstanbul', district: 'Fatih', school_type: 'Anadolu Lisesi' },
    { name: 'Vefa Lisesi', city: 'İstanbul', district: 'Fatih', school_type: 'Anadolu Lisesi' },
    { name: 'Kadıköy Anadolu Lisesi', city: 'İstanbul', district: 'Kadıköy', school_type: 'Anadolu Lisesi' },
    { name: 'Üsküdar Amerikan Lisesi', city: 'İstanbul', district: 'Üsküdar', school_type: 'Özel Lise' },
    { name: 'Robert Kolej', city: 'İstanbul', district: 'Sarıyer', school_type: 'Özel Lise' },
    { name: 'Alman Lisesi', city: 'İstanbul', district: 'Beyoğlu', school_type: 'Özel Lise' },
    { name: 'Saint Benoit Fransız Lisesi', city: 'İstanbul', district: 'Kadıköy', school_type: 'Özel Lise' },
    { name: 'İstanbul Lisesi', city: 'İstanbul', district: 'Fatih', school_type: 'Anadolu Lisesi' },
    { name: 'Pera Güzel Sanatlar Lisesi', city: 'İstanbul', district: 'Beyoğlu', school_type: 'Güzel Sanatlar Lisesi' },
    { name: 'Avni Akyol Güzel Sanatlar Lisesi', city: 'İstanbul', district: 'Kadıköy', school_type: 'Güzel Sanatlar Lisesi' },
    { name: 'Kartal Anadolu İmam Hatip Lisesi', city: 'İstanbul', district: 'Kartal', school_type: 'Anadolu İmam Hatip Lisesi' },
    { name: 'Maltepe Anadolu Lisesi', city: 'İstanbul', district: 'Maltepe', school_type: 'Anadolu Lisesi' },
    { name: 'Pendik Anadolu Lisesi', city: 'İstanbul', district: 'Pendik', school_type: 'Anadolu Lisesi' },
    { name: 'Beykoz Anadolu Lisesi', city: 'İstanbul', district: 'Beykoz', school_type: 'Anadolu Lisesi' },
    { name: 'Şişli Anadolu Lisesi', city: 'İstanbul', district: 'Şişli', school_type: 'Anadolu Lisesi' },
    { name: 'Bakırköy Anadolu Lisesi', city: 'İstanbul', district: 'Bakırköy', school_type: 'Anadolu Lisesi' },
    { name: 'Zeytinburnu Anadolu Lisesi', city: 'İstanbul', district: 'Zeytinburnu', school_type: 'Anadolu Lisesi' },

    // Ankara Liseleri
    { name: 'Ankara Atatürk Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Anadolu Lisesi' },
    { name: 'Ankara Fen Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Fen Lisesi' },
    { name: 'TED Ankara Koleji', city: 'Ankara', district: 'Çankaya', school_type: 'Özel Lise' },
    { name: 'Bilkent Üniversitesi Müzik ve Sahne Sanatları Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Özel Lise' },
    { name: 'Ankara Anadolu Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Anadolu Lisesi' },
    { name: 'Keçiören Anadolu Lisesi', city: 'Ankara', district: 'Keçiören', school_type: 'Anadolu Lisesi' },
    { name: 'Mamak Anadolu Lisesi', city: 'Ankara', district: 'Mamak', school_type: 'Anadolu Lisesi' },
    { name: 'Sincan Anadolu Lisesi', city: 'Ankara', district: 'Sincan', school_type: 'Anadolu Lisesi' },
    { name: 'Etimesgut Anadolu Lisesi', city: 'Ankara', district: 'Etimesgut', school_type: 'Anadolu Lisesi' },
    { name: 'Yenimahalle Anadolu Lisesi', city: 'Ankara', district: 'Yenimahalle', school_type: 'Anadolu Lisesi' },

    // İzmir Liseleri
    { name: 'İzmir Atatürk Lisesi', city: 'İzmir', district: 'Konak', school_type: 'Anadolu Lisesi' },
    { name: 'Bornova Anadolu Lisesi', city: 'İzmir', district: 'Bornova', school_type: 'Anadolu Lisesi' },
    { name: 'Karşıyaka Anadolu Lisesi', city: 'İzmir', district: 'Karşıyaka', school_type: 'Anadolu Lisesi' },
    { name: 'Çiğli Anadolu Lisesi', city: 'İzmir', district: 'Çiğli', school_type: 'Anadolu Lisesi' },
    { name: 'Buca Anadolu Lisesi', city: 'İzmir', district: 'Buca', school_type: 'Anadolu Lisesi' },
    { name: 'Balçova Anadolu Lisesi', city: 'İzmir', district: 'Balçova', school_type: 'Anadolu Lisesi' },
    { name: 'Gaziemir Anadolu Lisesi', city: 'İzmir', district: 'Gaziemir', school_type: 'Anadolu Lisesi' },
    { name: 'Narlıdere Anadolu Lisesi', city: 'İzmir', district: 'Narlıdere', school_type: 'Anadolu Lisesi' },
    { name: 'Güzelbahçe Anadolu Lisesi', city: 'İzmir', district: 'Güzelbahçe', school_type: 'Anadolu Lisesi' },
    { name: 'Menderes Anadolu Lisesi', city: 'İzmir', district: 'Menderes', school_type: 'Anadolu Lisesi' },

    // Bursa Liseleri
    { name: 'Bursa Anadolu Lisesi', city: 'Bursa', district: 'Osmangazi', school_type: 'Anadolu Lisesi' },
    { name: 'Nilüfer Anadolu Lisesi', city: 'Bursa', district: 'Nilüfer', school_type: 'Anadolu Lisesi' },
    { name: 'Yıldırım Anadolu Lisesi', city: 'Bursa', district: 'Yıldırım', school_type: 'Anadolu Lisesi' },
    { name: 'Mudanya Anadolu Lisesi', city: 'Bursa', district: 'Mudanya', school_type: 'Anadolu Lisesi' },
    { name: 'Gemlik Anadolu Lisesi', city: 'Bursa', district: 'Gemlik', school_type: 'Anadolu Lisesi' },
    { name: 'İnegöl Anadolu Lisesi', city: 'Bursa', district: 'İnegöl', school_type: 'Anadolu Lisesi' },
    { name: 'Mustafakemalpaşa Anadolu Lisesi', city: 'Bursa', district: 'Mustafakemalpaşa', school_type: 'Anadolu Lisesi' },
    { name: 'Orhangazi Anadolu Lisesi', city: 'Bursa', district: 'Orhangazi', school_type: 'Anadolu Lisesi' },
    { name: 'Karacabey Anadolu Lisesi', city: 'Bursa', district: 'Karacabey', school_type: 'Anadolu Lisesi' },
    { name: 'Harmancık Anadolu Lisesi', city: 'Bursa', district: 'Harmancık', school_type: 'Anadolu Lisesi' },

    // Antalya Liseleri
    { name: 'Antalya Anadolu Lisesi', city: 'Antalya', district: 'Muratpaşa', school_type: 'Anadolu Lisesi' },
    { name: 'Kepez Anadolu Lisesi', city: 'Antalya', district: 'Kepez', school_type: 'Anadolu Lisesi' },
    { name: 'Konyaaltı Anadolu Lisesi', city: 'Antalya', district: 'Konyaaltı', school_type: 'Anadolu Lisesi' },
    { name: 'Döşemealtı Anadolu Lisesi', city: 'Antalya', district: 'Döşemealtı', school_type: 'Anadolu Lisesi' },
    { name: 'Aksu Anadolu Lisesi', city: 'Antalya', district: 'Aksu', school_type: 'Anadolu Lisesi' },
    { name: 'Serik Anadolu Lisesi', city: 'Antalya', district: 'Serik', school_type: 'Anadolu Lisesi' },
    { name: 'Manavgat Anadolu Lisesi', city: 'Antalya', district: 'Manavgat', school_type: 'Anadolu Lisesi' },
    { name: 'Alanya Anadolu Lisesi', city: 'Antalya', district: 'Alanya', school_type: 'Anadolu Lisesi' },
    { name: 'Kumluca Anadolu Lisesi', city: 'Antalya', district: 'Kumluca', school_type: 'Anadolu Lisesi' },
    { name: 'Finike Anadolu Lisesi', city: 'Antalya', district: 'Finike', school_type: 'Anadolu Lisesi' },

    // Diğer Şehirlerden Popüler Liseler
    { name: 'Konya Anadolu Lisesi', city: 'Konya', district: 'Meram', school_type: 'Anadolu Lisesi' },
    { name: 'Adana Anadolu Lisesi', city: 'Adana', district: 'Seyhan', school_type: 'Anadolu Lisesi' },
    { name: 'Gaziantep Anadolu Lisesi', city: 'Gaziantep', district: 'Şahinbey', school_type: 'Anadolu Lisesi' },
    { name: 'Mersin Anadolu Lisesi', city: 'Mersin', district: 'Yenişehir', school_type: 'Anadolu Lisesi' },
    { name: 'Diyarbakır Anadolu Lisesi', city: 'Diyarbakır', district: 'Bağlar', school_type: 'Anadolu Lisesi' },
    { name: 'Samsun Anadolu Lisesi', city: 'Samsun', district: 'İlkadım', school_type: 'Anadolu Lisesi' },
    { name: 'Trabzon Anadolu Lisesi', city: 'Trabzon', district: 'Ortahisar', school_type: 'Anadolu Lisesi' },
    { name: 'Erzurum Anadolu Lisesi', city: 'Erzurum', district: 'Yakutiye', school_type: 'Anadolu Lisesi' },
    { name: 'Malatya Anadolu Lisesi', city: 'Malatya', district: 'Battalgazi', school_type: 'Anadolu Lisesi' },
    { name: 'Kahramanmaraş Anadolu Lisesi', city: 'Kahramanmaraş', district: 'Dulkadiroğlu', school_type: 'Anadolu Lisesi' },
    { name: 'Van Anadolu Lisesi', city: 'Van', district: 'İpekyolu', school_type: 'Anadolu Lisesi' },
    { name: 'Elazığ Anadolu Lisesi', city: 'Elazığ', district: 'Merkez', school_type: 'Anadolu Lisesi' },
    { name: 'Sivas Anadolu Lisesi', city: 'Sivas', district: 'Merkez', school_type: 'Anadolu Lisesi' },
    { name: 'Kayseri Anadolu Lisesi', city: 'Kayseri', district: 'Melikgazi', school_type: 'Anadolu Lisesi' },
    { name: 'Eskişehir Anadolu Lisesi', city: 'Eskişehir', district: 'Odunpazarı', school_type: 'Anadolu Lisesi' },
    { name: 'Denizli Anadolu Lisesi', city: 'Denizli', district: 'Merkezefendi', school_type: 'Anadolu Lisesi' },
    { name: 'Muğla Anadolu Lisesi', city: 'Muğla', district: 'Menteşe', school_type: 'Anadolu Lisesi' },
    { name: 'Aydın Anadolu Lisesi', city: 'Aydın', district: 'Efeler', school_type: 'Anadolu Lisesi' },
    { name: 'Balıkesir Anadolu Lisesi', city: 'Balıkesir', district: 'Karesi', school_type: 'Anadolu Lisesi' },
    { name: 'Çanakkale Anadolu Lisesi', city: 'Çanakkale', district: 'Merkez', school_type: 'Anadolu Lisesi' },

    // Fen Liseleri
    { name: 'İstanbul Fen Lisesi', city: 'İstanbul', district: 'Beşiktaş', school_type: 'Fen Lisesi' },
    { name: 'Ankara Fen Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Fen Lisesi' },
    { name: 'İzmir Fen Lisesi', city: 'İzmir', district: 'Bornova', school_type: 'Fen Lisesi' },
    { name: 'Bursa Fen Lisesi', city: 'Bursa', district: 'Nilüfer', school_type: 'Fen Lisesi' },
    { name: 'Antalya Fen Lisesi', city: 'Antalya', district: 'Muratpaşa', school_type: 'Fen Lisesi' },
    { name: 'Konya Fen Lisesi', city: 'Konya', district: 'Meram', school_type: 'Fen Lisesi' },
    { name: 'Adana Fen Lisesi', city: 'Adana', district: 'Seyhan', school_type: 'Fen Lisesi' },
    { name: 'Gaziantep Fen Lisesi', city: 'Gaziantep', district: 'Şahinbey', school_type: 'Fen Lisesi' },
    { name: 'Mersin Fen Lisesi', city: 'Mersin', district: 'Yenişehir', school_type: 'Fen Lisesi' },
    { name: 'Samsun Fen Lisesi', city: 'Samsun', district: 'İlkadım', school_type: 'Fen Lisesi' },

    // Sosyal Bilimler Liseleri
    { name: 'İstanbul Sosyal Bilimler Lisesi', city: 'İstanbul', district: 'Fatih', school_type: 'Sosyal Bilimler Lisesi' },
    { name: 'Ankara Sosyal Bilimler Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Sosyal Bilimler Lisesi' },
    { name: 'İzmir Sosyal Bilimler Lisesi', city: 'İzmir', district: 'Bornova', school_type: 'Sosyal Bilimler Lisesi' },
    { name: 'Bursa Sosyal Bilimler Lisesi', city: 'Bursa', district: 'Nilüfer', school_type: 'Sosyal Bilimler Lisesi' },
    { name: 'Antalya Sosyal Bilimler Lisesi', city: 'Antalya', district: 'Muratpaşa', school_type: 'Sosyal Bilimler Lisesi' },

    // Güzel Sanatlar Liseleri
    { name: 'İstanbul Güzel Sanatlar Lisesi', city: 'İstanbul', district: 'Beyoğlu', school_type: 'Güzel Sanatlar Lisesi' },
    { name: 'Ankara Güzel Sanatlar Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Güzel Sanatlar Lisesi' },
    { name: 'İzmir Güzel Sanatlar Lisesi', city: 'İzmir', district: 'Konak', school_type: 'Güzel Sanatlar Lisesi' },
    { name: 'Bursa Güzel Sanatlar Lisesi', city: 'Bursa', district: 'Osmangazi', school_type: 'Güzel Sanatlar Lisesi' },
    { name: 'Antalya Güzel Sanatlar Lisesi', city: 'Antalya', district: 'Muratpaşa', school_type: 'Güzel Sanatlar Lisesi' },

    // Spor Liseleri
    { name: 'İstanbul Spor Lisesi', city: 'İstanbul', district: 'Beşiktaş', school_type: 'Spor Lisesi' },
    { name: 'Ankara Spor Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Spor Lisesi' },
    { name: 'İzmir Spor Lisesi', city: 'İzmir', district: 'Bornova', school_type: 'Spor Lisesi' },
    { name: 'Bursa Spor Lisesi', city: 'Bursa', district: 'Nilüfer', school_type: 'Spor Lisesi' },
    { name: 'Antalya Spor Lisesi', city: 'Antalya', district: 'Muratpaşa', school_type: 'Spor Lisesi' },

    // Mesleki ve Teknik Anadolu Liseleri
    { name: 'İstanbul Teknik Anadolu Lisesi', city: 'İstanbul', district: 'Fatih', school_type: 'Mesleki ve Teknik Anadolu Lisesi' },
    { name: 'Ankara Teknik Anadolu Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Mesleki ve Teknik Anadolu Lisesi' },
    { name: 'İzmir Teknik Anadolu Lisesi', city: 'İzmir', district: 'Bornova', school_type: 'Mesleki ve Teknik Anadolu Lisesi' },
    { name: 'Bursa Teknik Anadolu Lisesi', city: 'Bursa', district: 'Nilüfer', school_type: 'Mesleki ve Teknik Anadolu Lisesi' },
    { name: 'Antalya Teknik Anadolu Lisesi', city: 'Antalya', district: 'Muratpaşa', school_type: 'Mesleki ve Teknik Anadolu Lisesi' },

    // Anadolu İmam Hatip Liseleri
    { name: 'İstanbul Anadolu İmam Hatip Lisesi', city: 'İstanbul', district: 'Fatih', school_type: 'Anadolu İmam Hatip Lisesi' },
    { name: 'Ankara Anadolu İmam Hatip Lisesi', city: 'Ankara', district: 'Çankaya', school_type: 'Anadolu İmam Hatip Lisesi' },
    { name: 'İzmir Anadolu İmam Hatip Lisesi', city: 'İzmir', district: 'Bornova', school_type: 'Anadolu İmam Hatip Lisesi' },
    { name: 'Bursa Anadolu İmam Hatip Lisesi', city: 'Bursa', district: 'Nilüfer', school_type: 'Anadolu İmam Hatip Lisesi' },
    { name: 'Antalya Anadolu İmam Hatip Lisesi', city: 'Antalya', district: 'Muratpaşa', school_type: 'Anadolu İmam Hatip Lisesi' },

    // Özel Liseler
    { name: 'Koç Lisesi', city: 'İstanbul', district: 'Sarıyer', school_type: 'Özel Lise' },
    { name: 'Bilfen Lisesi', city: 'İstanbul', district: 'Ataşehir', school_type: 'Özel Lise' },
    { name: 'Doğa Koleji', city: 'İstanbul', district: 'Ataşehir', school_type: 'Özel Lise' },
    { name: 'Bahçeşehir Koleji', city: 'İstanbul', district: 'Bahçelievler', school_type: 'Özel Lise' },
    { name: 'MEF Lisesi', city: 'İstanbul', district: 'Beşiktaş', school_type: 'Özel Lise' },
    { name: 'Enka Lisesi', city: 'İstanbul', district: 'Sarıyer', school_type: 'Özel Lise' },
    { name: 'Hisar Lisesi', city: 'İstanbul', district: 'Sarıyer', school_type: 'Özel Lise' },
    { name: 'Üsküdar Lisesi', city: 'İstanbul', district: 'Üsküdar', school_type: 'Özel Lise' },
    { name: 'Eyüboğlu Lisesi', city: 'İstanbul', district: 'Ümraniye', school_type: 'Özel Lise' },
    { name: 'Özel Açı Lisesi', city: 'İstanbul', district: 'Beşiktaş', school_type: 'Özel Lise' }
];

async function insertSchools() {
    try {
        console.log('Okullar veritabanına ekleniyor...');
        
        // Önce mevcut okulları temizle
        await pool.query('DELETE FROM schools');
        console.log('Mevcut okul verileri temizlendi.');
        
        // Okulları ekle
        for (const school of turkishSchools) {
            await pool.query(
                'INSERT INTO schools (name, city, district, school_type) VALUES ($1, $2, $3, $4)',
                [school.name, school.city, school.district, school.school_type]
            );
        }
        
        console.log(`${turkishSchools.length} okul başarıyla eklendi!`);
        
        // Eklenen okulları kontrol et
        const result = await pool.query('SELECT COUNT(*) FROM schools');
        console.log(`Toplam okul sayısı: ${result.rows[0].count}`);
        
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pool.end();
    }
}

insertSchools();
