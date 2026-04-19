const { DAVClient } = require('tsdav');

const ICLOUD_EMAIL = (process.env.ICLOUD_EMAIL || 'cinar.ozmeral04@gmail.com').trim();
const ICLOUD_APP_PASSWORD = (process.env.ICLOUD_APP_PASSWORD || '').trim().replace(/\\n/g, '').replace(/\n/g, '');

let cachedClient = null;

async function getCardDAVClient() {
    if (cachedClient) return cachedClient;

    const client = new DAVClient({
        serverUrl: 'https://contacts.icloud.com',
        credentials: {
            username: ICLOUD_EMAIL,
            password: ICLOUD_APP_PASSWORD
        },
        authMethod: 'Basic',
        defaultAccountType: 'carddav'
    });

    await client.login();
    cachedClient = client;
    return client;
}

async function getAddressBook() {
    const client = await getCardDAVClient();
    const addressBooks = await client.fetchAddressBooks();

    if (!addressBooks || addressBooks.length === 0) {
        throw new Error('No address books found in iCloud account');
    }

    return { client, addressBook: addressBooks[0] };
}

function generateUID() {
    const chars = 'abcdef0123456789';
    const segments = [8, 4, 4, 4, 12];
    return segments.map(len => {
        let s = '';
        for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
    }).join('-');
}

function buildVCardString({ uid, displayName, phone, email }) {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `UID:${uid}`,
        `FN:${displayName}`,
        `N:;${displayName};;;`,
        `PRODID:-//VG Danismanlik//Contact System//TR`,
        `REV:${now}`
    ];

    if (phone) {
        lines.push(`TEL;TYPE=CELL:${phone}`);
    }
    if (email) {
        lines.push(`EMAIL;TYPE=INTERNET:${email}`);
    }

    lines.push('END:VCARD');
    return lines.join('\r\n');
}

/**
 * Rehberdeki tum vCard'lari cache'ler (ayni session icinde tekrar cekmez).
 */
let vcardCache = null;
let vcardCacheTime = 0;
const CACHE_TTL = 60000;

async function fetchAllVCards(client, addressBook) {
    const now = Date.now();
    if (vcardCache && (now - vcardCacheTime) < CACHE_TTL) return vcardCache;
    vcardCache = await client.fetchVCards({ addressBook });
    vcardCacheTime = now;
    return vcardCache || [];
}

function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

/**
 * Verilen displayName veya telefon numarasi rehberde zaten varsa true doner.
 */
async function contactExists(client, addressBook, displayName, phone) {
    try {
        const vcards = await fetchAllVCards(client, addressBook);
        if (!vcards || vcards.length === 0) return false;

        const nameLower = displayName.trim().toLowerCase();
        const phoneNorm = normalizePhone(phone);

        for (const card of vcards) {
            const data = card.data || '';
            const fnMatch = data.match(/^FN:(.+)$/im);
            if (fnMatch) {
                const fn = fnMatch[1].trim().toLowerCase();
                if (fn === nameLower) return true;
            }
            if (phoneNorm) {
                const telMatch = data.match(/^TEL[^:]*:(.+)$/im);
                if (telMatch) {
                    const existingPhone = normalizePhone(telMatch[1]);
                    if (existingPhone === phoneNorm) return true;
                }
            }
        }
        return false;
    } catch (err) {
        console.warn('iCloud Contact: exist check failed:', err.message);
        return false;
    }
}

/**
 * iCloud rehberine kisi ekler.
 * Aynı displayName zaten varsa ekleme yapmaz.
 * @param {string} fullName - Tam isim (orn: "Emir Talha Erbas")
 * @param {string} phone - Telefon numarasi (orn: "+905321234567")
 * @param {string} email - E-posta adresi
 * @param {'student'|'guardian'} type - Kisi tipi
 * @returns {string|null} vCard UID veya hata/zaten-var durumunda null
 */
async function createContact(fullName, phone, email, type) {
    if (!phone && !email) {
        console.log('iCloud Contact: Telefon ve e-posta yok, atlaniyor:', fullName);
        return null;
    }

    const suffix = type === 'guardian' ? 'Veli' : 'Öğrenci';
    const displayName = `${fullName} ${suffix}`;
    const uid = generateUID();

    try {
        const { client, addressBook } = await getAddressBook();

        const exists = await contactExists(client, addressBook, displayName, phone);
        if (exists) {
            console.log(`iCloud Contact: "${displayName}" (${phone}) zaten rehberde var, atlanıyor.`);
            return null;
        }

        const vCardString = buildVCardString({
            uid,
            displayName,
            phone: phone || '',
            email: email || ''
        });

        await client.createVCard({
            addressBook,
            filename: `${uid}.vcf`,
            vCardString
        });

        vcardCache = null;
        console.log(`iCloud Contact created: ${displayName} (${phone || email})`);
        return uid;
    } catch (error) {
        cachedClient = null;
        vcardCache = null;
        console.error(`iCloud Contact creation failed for ${displayName}:`, error.message);
        return null;
    }
}

module.exports = {
    createContact
};
