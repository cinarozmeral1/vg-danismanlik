const fs = require('fs');
const path = require('path');

// SVG içeriğini oku
const svgContent = fs.readFileSync('public/images/logo.svg', 'utf8');

// Base64'e çevir
const base64Svg = Buffer.from(svgContent).toString('base64');
const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

// HTML dosyası oluştur
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Logo Converter</title>
</head>
<body>
    <img src="${dataUri}" id="logo" style="display:none;">
    <canvas id="canvas" width="400" height="200"></canvas>
    <script>
        const img = document.getElementById('logo');
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
            
            // Canvas'ı PNG olarak kaydet
            const pngData = canvas.toDataURL('image/png');
            
            // Base64'ten binary'e çevir
            const base64Data = pngData.replace(/^data:image\/png;base64,/, '');
            const binaryData = Buffer.from(base64Data, 'base64');
            
            // Dosyaya yaz
            require('fs').writeFileSync('public/images/logo.png', binaryData);
            console.log('Logo PNG olarak kaydedildi!');
        };
    </script>
</body>
</html>
`;

// HTML dosyasını oluştur
fs.writeFileSync('convert_logo.html', htmlContent);

console.log('HTML dosyası oluşturuldu. Tarayıcıda açarak PNG oluşturabilirsiniz.'); 