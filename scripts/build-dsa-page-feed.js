#!/usr/bin/env node
/**
 * Build a Google Ads Page Feed CSV from the live sitemap blog URLs.
 *
 * Output (Google Ads expected format):
 *     Page URL,Custom label
 *     https://vgdanismanlik.com/blog/...,Italy;Business
 *
 * Custom labels let us split DSA into country-specific ad groups later.
 * We tag each URL with up to 3 labels:
 *   - country  (Italy, Czech, Germany, ...)
 *   - level    (Lisans, YuksekLisans)
 *   - field    (Business, Engineering, Health, Arts, Other)
 */

const fs = require('fs');
const path = require('path');

const INPUT  = process.argv[2] || '/tmp/blog_urls.txt';
const OUTPUT = process.argv[3] || path.join(__dirname, '..', 'reports', 'google-ads', 'blog-page-feed.csv');

const CITY_TO_COUNTRY = {
    bologna: 'Italy', milano: 'Italy', milan: 'Italy', roma: 'Italy', rome: 'Italy',
    torino: 'Italy', turin: 'Italy', firenze: 'Italy', florence: 'Italy',
    venedik: 'Italy', venice: 'Italy', napoli: 'Italy', naples: 'Italy',
    trento: 'Italy', padova: 'Italy', padua: 'Italy', pavia: 'Italy',
    parma: 'Italy', bari: 'Italy', cagliari: 'Italy', palermo: 'Italy', siena: 'Italy',
    pisa: 'Italy', genova: 'Italy', genoa: 'Italy', verona: 'Italy', perugia: 'Italy',
    urbino: 'Italy', bocconi: 'Italy', cattolica: 'Italy', sapienza: 'Italy',
    iulm: 'Italy', luiss: 'Italy', polimi: 'Italy', polito: 'Italy', foscari: 'Italy',

    prag: 'Czech', prague: 'Czech', brno: 'Czech', ostrava: 'Czech', olomouc: 'Czech',
    plzen: 'Czech', pilsen: 'Czech', pardubice: 'Czech', liberec: 'Czech',
    ceske: 'Czech', hradec: 'Czech', cuni: 'Czech', vse: 'Czech', vscht: 'Czech',
    czu: 'Czech', ctu: 'Czech', mendelu: 'Czech', tul: 'Czech', utb: 'Czech',
    masaryk: 'Czech', metropolitan: 'Czech', anglo: 'Czech',

    berlin: 'Germany', munih: 'Germany', munich: 'Germany', muenchen: 'Germany',
    frankfurt: 'Germany', hamburg: 'Germany', koln: 'Germany', cologne: 'Germany',
    stuttgart: 'Germany', heidelberg: 'Germany', tubingen: 'Germany', tuebingen: 'Germany',
    leipzig: 'Germany', dresden: 'Germany', bonn: 'Germany', mannheim: 'Germany',
    aachen: 'Germany', dusseldorf: 'Germany', duesseldorf: 'Germany',
    dortmund: 'Germany', essen: 'Germany', bremen: 'Germany', hannover: 'Germany',
    hanover: 'Germany', nurnberg: 'Germany', nuremberg: 'Germany',
    wurzburg: 'Germany', wuerzburg: 'Germany', karlsruhe: 'Germany',
    kiel: 'Germany', erfurt: 'Germany', goettingen: 'Germany', gottingen: 'Germany',
    tum: 'Germany', lmu: 'Germany', kit: 'Germany', srh: 'Germany', cbs: 'Germany',
    iubh: 'Germany', iuba: 'Germany',

    londra: 'UK', london: 'UK', oxford: 'UK', cambridge: 'UK',
    manchester: 'UK', glasgow: 'UK', edinburgh: 'UK', birmingham: 'UK',
    liverpool: 'UK', leeds: 'UK', bristol: 'UK', sheffield: 'UK',
    nottingham: 'UK', southampton: 'UK', cardiff: 'UK', belfast: 'UK',
    newcastle: 'UK', york: 'UK', bath: 'UK', durham: 'UK', exeter: 'UK',
    warwick: 'UK', coventry: 'UK', portsmouth: 'UK', leicester: 'UK',
    reading: 'UK', surrey: 'UK', sussex: 'UK', kent: 'UK', essex: 'UK',
    aberdeen: 'UK', dundee: 'UK', stirling: 'UK', loughborough: 'UK',
    bournemouth: 'UK', brighton: 'UK', plymouth: 'UK', hull: 'UK',
    middlesex: 'UK', regents: 'UK', buckingham: 'UK', aston: 'UK',
    queen: 'UK', kings: 'UK', kingston: 'UK', greenwich: 'UK', salford: 'UK',
    westminster: 'UK', strathclyde: 'UK', heriot: 'UK', lancaster: 'UK',

    amsterdam: 'Netherlands', rotterdam: 'Netherlands', utrecht: 'Netherlands',
    groningen: 'Netherlands', leiden: 'Netherlands', maastricht: 'Netherlands',
    delft: 'Netherlands', tilburg: 'Netherlands', nijmegen: 'Netherlands',
    eindhoven: 'Netherlands', enschede: 'Netherlands', wageningen: 'Netherlands',
    hague: 'Netherlands', breda: 'Netherlands', twente: 'Netherlands',
    fontys: 'Netherlands', saxion: 'Netherlands', erasmus: 'Netherlands',

    viyana: 'Austria', vienna: 'Austria', wien: 'Austria',
    salzburg: 'Austria', graz: 'Austria', innsbruck: 'Austria',
    linz: 'Austria', klagenfurt: 'Austria', wu: 'Austria', modul: 'Austria',
    fhwien: 'Austria',

    budapeste: 'Hungary', budapest: 'Hungary', debrecen: 'Hungary',
    szeged: 'Hungary', pecs: 'Hungary', pcs: 'Hungary', miskolc: 'Hungary',
    gyor: 'Hungary', semmelweis: 'Hungary', corvinus: 'Hungary', elte: 'Hungary',
    bme: 'Hungary',

    varsova: 'Poland', warsaw: 'Poland', krakov: 'Poland', krakow: 'Poland',
    wroclaw: 'Poland', poznan: 'Poland', gdansk: 'Poland', lodz: 'Poland',
    katowice: 'Poland', lublin: 'Poland', gliwice: 'Poland', torun: 'Poland',
    szczecin: 'Poland', bialystok: 'Poland', rzeszow: 'Poland',
    jagiellonian: 'Poland', agh: 'Poland', sgh: 'Poland', kozminski: 'Poland',
    silesian: 'Poland', nicolaus: 'Poland', copernicus: 'Poland',

    madrid: 'Spain', barcelona: 'Spain', valensiya: 'Spain', valencia: 'Spain',
    sevilla: 'Spain', seville: 'Spain', granada: 'Spain', salamanca: 'Spain',
    bilbao: 'Spain', esade: 'Spain', iese: 'Spain', ie: 'Spain', ese: 'Spain',
    iulm: 'Italy',

    paris: 'France', lyon: 'France', marsilya: 'France', marseille: 'France',
    nice: 'France', toulouse: 'France', strasbourg: 'France', bordeaux: 'France',
    lille: 'France', nantes: 'France', montpellier: 'France', grenoble: 'France',
    sorbonne: 'France', emlyon: 'France', edhec: 'France', ieseg: 'France',
    essec: 'France', hec: 'France',

    paderborn: 'Germany',
    bolton: 'UK', brunel: 'UK',
    accademia: 'Italy',
    european: 'UK',
};

const FIELD_KEYWORDS = {
    Business: ['isletme','muhasebe','finans','ekonomi','yonetim','pazarlama','girisim','mba','ticaret','bankacilik','lojistik','insan-kaynaklari'],
    Engineering: ['muhendisli','muhendisi','mimarlik','bilgisayar','yazilim','elektrik','makine','insaat','endustri','kimya-muhendis','otomotiv','yapay-zeka','veri-bilim'],
    Health: ['tip','hemsire','dis-hekim','eczacil','fizyoterap','beslenme','psikoloji','saglik','veteriner','biyomedikal'],
    Arts: ['tasarim','moda','muzik','sanat','mimarlik-ic','grafik','animasyon','sinema','tiyatro','foto'],
    Law: ['hukuk','siyaset-bilim','uluslararasi-iliskiler','kamu-yonetim','diplomas'],
    Science: ['matematik','fizik','kimya','biyoloji','jeoloji','astronom','meteorolo'],
    Social: ['sosyoloji','antropolo','tarih','felsefe','edebiyat','iletisim','gazetec','egitim'],
};

function detectCountry(slug) {
    const tokens = slug.split('-');
    for (const tok of tokens) {
        if (CITY_TO_COUNTRY[tok]) return CITY_TO_COUNTRY[tok];
    }
    if (slug.includes('italya')) return 'Italy';
    if (slug.includes('cek') || slug.includes('cekya')) return 'Czech';
    if (slug.includes('almanya')) return 'Germany';
    if (slug.includes('ingiltere')) return 'UK';
    if (slug.includes('hollanda')) return 'Netherlands';
    if (slug.includes('avusturya')) return 'Austria';
    if (slug.includes('macaristan')) return 'Hungary';
    if (slug.includes('polonya')) return 'Poland';
    if (slug.includes('ispanya')) return 'Spain';
    if (slug.includes('fransa')) return 'France';
    return 'Other';
}

function detectLevel(slug) {
    if (slug.includes('yuksek-lisans') || slug.includes('master')) return 'YuksekLisans';
    if (slug.includes('doktora') || slug.includes('phd')) return 'Doktora';
    return 'Lisans';
}

function detectField(slug) {
    for (const [field, keys] of Object.entries(FIELD_KEYWORDS)) {
        for (const k of keys) if (slug.includes(k)) return field;
    }
    return 'Other';
}

const urls = fs.readFileSync(INPUT, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);

const lines = ['Page URL,Custom label'];
const stats = { country: {}, field: {}, level: {} };

for (const url of urls) {
    const slug = url.replace('https://vgdanismanlik.com/blog/', '');
    const country = detectCountry(slug);
    const field   = detectField(slug);
    const level   = detectLevel(slug);
    const labels  = [country, field, level].join(';');

    stats.country[country] = (stats.country[country] || 0) + 1;
    stats.field[field]     = (stats.field[field]   || 0) + 1;
    stats.level[level]     = (stats.level[level]   || 0) + 1;

    lines.push(`${url},${labels}`);
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf8');

console.log(`✓ ${urls.length} URL → ${path.relative(process.cwd(), OUTPUT)}`);
console.log('\nÜlke dağılımı:');
Object.entries(stats.country).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k.padEnd(12)} ${v}`));
console.log('\nAlan dağılımı:');
Object.entries(stats.field).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k.padEnd(12)} ${v}`));
console.log('\nSeviye dağılımı:');
Object.entries(stats.level).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k.padEnd(12)} ${v}`));
