// ============================================================
// HanoMan API Emulator — /api/connection/v1/ff (userver)
// Dipanggil cheat setelah auth sukses (field "userver").
// Respons asli: base64( 48-byte encrypted blob ).
//
// Di sini blob dibuat dengan XOR stream dari kunci = "crypt"
// token yang diberikan di step auth, lalu di-base64. Isi plaintext
// blob adalah JSON konfigurasi cheat (fitur, dsb).
//
// Param: user_key / key, crypt (token dari step auth)
// ============================================================

const crypto = require('crypto');

// ============================================================
// MODE: userver TETAP menjadi proxy/pengarah ke blob server asli.
// Default (MIRROR): replay blob STATIS server asli (byte-identik) —
// client decrypt pakai crypt asli "tx-₹7#_-3%09*" dapat config sama
// persis dengan server ori.
// STRICT_KEYS=1 di env → blob dinamis (JSON config di bawah,
// di-XOR pakai crypt dari request).
// ============================================================
const STRICT_KEYS = process.env.STRICT_KEYS === '1';
// Blob statis 48-byte persis dari server asli (hasil curl)
const REAL_BLOB_B64 = 's69t5K1C+chkmpgQqN8PqFJsO3sEmaHD6Q1G0758snRi5O7BUOrIGfbRvACF1fKJ';
const REAL_CRYPT = 'tx-\u20b97#_-3%%09*';

const CHEAT_CONFIG = {
  status: 'OK',
  key: null,              // diisi user_key
  dev: 'HANOMAN-FF',
  chunk: 1,
  features: {
    headshot: 90,
    aimbot: 0,
    speed: 1.0,
    teleport: false,
    esp: true,
    fly: false,
    antikick: true,
  },
  server_time: Math.floor(Date.now() / 1000),
};

function xorStream(data, key) {
  if (!key || !key.length) key = Buffer.from('HANOMAN-FF');
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      const params = {};
      body.split('&').forEach((p) => {
        const [k, ...v] = p.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v.join('='));
      });
      resolve(params);
    });
  });
}

module.exports = async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  let params = {};
  if (req.method === 'POST') params = await parseBody(req);
  else params = Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  const userKey = (params.user_key || params.key || '').trim();
  const crypt = (params.crypt || '').trim();

  // MIRROR: replay blob statis persis server asli
  if (!STRICT_KEYS) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    return res.end(REAL_BLOB_B64);
  }

  const json = { ...CHEAT_CONFIG, key: userKey || null };
  if (!userKey) {
    json.status = 'NO';
    json.reason = 'user_key kosong';
  }

  // Padding hingga kelipatan 48 byte (meniru ukuran blob asli)
  let plain = Buffer.from(JSON.stringify(json));
  const pad = (48 - (plain.length % 48)) % 48;
  if (pad) plain = Buffer.concat([plain, Buffer.alloc(pad, 0x20)]);

  const blob = xorStream(plain, Buffer.from(crypt || 'HANOMAN-FF'));
  const b64 = blob.toString('base64');

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
  return res.end(b64);
};
