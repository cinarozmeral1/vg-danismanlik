const express = require('express');
const app = express();
const PORT = 3003;

app.get('/', (req, res) => {
    res.send('Test server çalışıyor!');
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Test server ${PORT} portunda çalışıyor`);
    console.log(`http://localhost:${PORT} adresinden erişebilirsiniz`);
});
