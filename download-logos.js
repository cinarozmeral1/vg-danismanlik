const https = require('https');
const fs = require('fs');
const path = require('path');

const logos = [
    {
        name: 'edinburgh.png', 
        url: 'https://i.pinimg.com/originals/7b/6d/df/7b6ddf93d4c9cc8d90e5c12c4c9b9f15.png'
    },
    {
        name: 'kings.png',
        url: 'https://i.pinimg.com/originals/c8/a0/d4/c8a0d4e6c2e4c1f8e9b8d7c6e5f4a3b2.png'
    },
    {
        name: 'winchester.png',
        url: 'https://seeklogo.com/images/U/university-of-winchester-logo-E2F2C2F2F2-seeklogo.com.png'
    }
];

const dir = './public/images/uk-logos';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function download(url, filename) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path.join(dir, filename));
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                download(response.headers.location, filename).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✅ ${filename} downloaded`);
                resolve();
            });
        }).on('error', reject);
    });
}

async function main() {
    for (const logo of logos) {
        try {
            await download(logo.url, logo.name);
        } catch (e) {
            console.log(`❌ ${logo.name} failed: ${e.message}`);
        }
    }
    console.log('\nDone!');
}

main();

