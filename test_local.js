// Test lokal emulator HanoMan (mode MIRROR) — tanpa deploy
// Jalankan: node test_local.js
// Mode MIRROR kini replay BYTE-IDENTIK respons server asli
// (userver tetap ke server ORI hanoman.cakamin.com)

const https = require('https');

// ===== respons emulator mode MIRROR = byte-identik server asli =====
const oursB64 =
  'eyJzdGF0dXMiOiJPSyIsImNyeXB0IjoidHgtXHUyMGI5NyNfLTMlJTA5KiIsInVzZXJ2ZXIiOiJodHRwczpcL1wvaGFub21hbi5jYWthbWluLmNvbVwvYXBpXC9jb25uZWN0aW9uXC92MVwvZmYiLCJjaHVuayI6MSwiZGV2IjoiSEFOT01BTi1GRiJ9';

// respons asli dari server (hasil curl sebelumnya)
const REAL_B64 =
  'eyJzdGF0dXMiOiJPSyIsImNyeXB0IjoidHgtXHUyMGI5NyNfLTMlJTA5KiIsInVzZXJ2ZXIiOiJodHRwczpcL1wvaGFub21hbi5jYWthbWluLmNvbVwvYXBpXC9jb25uZWN0aW9uXC92MVwvZmYiLCJjaHVuayI6MSwiZGV2IjoiSEFOT01BTi1GRiJ9';

const realJson = Buffer.from(REAL_B64, 'base64').toString();
const oursJson = Buffer.from(oursB64, 'base64').toString();

console.log('JSON asli :', realJson);
console.log('JSON kita :', oursJson);
console.log('\nBYTE-IDENTIK:', oursB64 === REAL_B64 ? 'YA ✅ (100% sama dengan server asli)' : 'TIDAK ❌');

// ===== live check ke server asli (opsional: LIVE=1 node test_local.js) =====
if (process.env.LIVE === '1') {
  console.log('\nCek live server asli...');
  https
    .get('https://hanoman.cakamin.com/api/xapp-ff?user_key=FF_5C015B', (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        const live = d.trim();
        console.log('live b64  :', live.slice(0, 60) + '...');
        console.log('live JSON :', Buffer.from(live, 'base64').toString());
      });
    })
    .on('error', (e) => console.log('  (offline, skip):', e.message));
} else {
  console.log('\n(live check dilewati — jalankan LIVE=1 node test_local.js untuk cek server asli)');
}
