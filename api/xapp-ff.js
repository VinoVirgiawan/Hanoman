// ============================================================
// HanoMan API Emulator — /api/xapp-ff
// Meniru respons server asli:
//   HTTP 200 + body base64( JSON )
//   JSON: {"status":"OK","crypt":"...","userver":"https://<host>/api/connection/v1/ff","chunk":1,"dev":"HANOMAN-FF"}
//
// Param (GET query atau POST form-urlencoded):
//   user_key   : member key (contoh: FF_5C015B)
//   game       : opsional (ff)
//
// Key disimpan di Vercel KV bila tersedia (@vercel/kv),
// fallback ke memory (per-instance, reset saat cold start).
// ============================================================

const crypto = require('crypto');
let kv = null;
try { kv = require('@vercel/kv'); } catch (e) {}

// ============================================================
// MODE KOMPATIBILITAS
//
// Server asli hanoman.cakamin.com terbukti 100% STATIS: respons
// sama persis untuk key benar/salah/serial apa pun (dites 6 skenario).
// Validasi benar-salah & device limit terjadi CLIENT-SIDE di
// HanoMan.sh (cek status=="OK" + decrypt blob userver pakai crypt).
//
// MIRROR  (default): replay respons BYTE-IDENTIK server asli.
//   userver TETAP menunjuk server asli (hanoman.cakamin.com) sehingga
//   client download config dari server ORI, dan crypt asli + blob asli
//   menjamin decrypt client cocok 100%.
// STRICT: set STRICT_KEYS=1 — key divalidasi dulu (HARDCODED_KEYS/KV);
//   key invalid dapat status "NO". Pada mode ini userver diarahkan
//   ke host Vercel ini (config dikontrol sendiri).
// ============================================================
const STRICT_KEYS = process.env.STRICT_KEYS === '1';

// Respons statis server asli, byte-per-byte ( hasil curl /api/xapp-ff )
const REAL_AUTH_B64 =
  'eyJzdGF0dXMiOiJPSyIsImNyeXB0IjoidHgtXHUyMGI5NyNfLTMlJTA5KiIsInVzZXJ2ZXIiOiJodHRwczpcL1wvaGFub21hbi5jYWthbWluLmNvbVwvYXBpXC9jb25uZWN0aW9uXC92MVwvZmYiLCJjaHVuayI6MSwiZGV2IjoiSEFOT01BTi1GRiJ9';

const memStore = { keys: {}, logs: [] };

// Key bawaan — tambah/ubah sesuai kebutuhan
const HARDCODED_KEYS = {
  'FF_5C015B':        { days: 30,  title: 'HanoMan FF Monthly' },
  'FF_TRIAL':         { days: 1,   title: 'HanoMan FF Trial' },
  'FF-KEPENTAL-CRACK':          { days: 365, title: 'HanoMan FF Unlimited' },
};

async function storeGet(k, fallback) {
  if (kv && kv.get) { try { const v = await kv.get(k); return v ?? fallback; } catch (e) {} }
  return memStore[k] ?? fallback;
}
async function storeSet(k, v) {
  if (kv && kv.set) { try { await kv.set(k, v); return; } catch (e) {} }
  memStore[k] = v;
}

function makeCrypt(userKey) {
  // Token acak bergaya token asli ("tx-...")
  const rnd = crypto.randomBytes(6).toString('hex');
  return `tx-${rnd}-${crypto.createHash('md5').update(userKey + Date.now()).digest('hex').slice(0, 6)}`;
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
  const game = (params.game || 'ff').trim();

  // ---- validasi key ----
  let keyData = null;
  if (HARDCODED_KEYS[userKey]) {
    const hk = HARDCODED_KEYS[userKey];
    keyData = { name: userKey, title: hk.title, active: true, days: hk.days };
  } else {
    const keys = await storeGet('keys', {});
    keyData = keys[userKey] || null;
  }

  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...cors };
  res.writeHead(200, headers);

  if (!userKey) {
    return res.end(Buffer.from(JSON.stringify({
      status: 'NO', reason: 'MEMBER KEY NOT REGISTERED', chunk: 0, dev: 'HANOMAN-FF',
    })).toString('base64'));
  }
  if (!keyData) {
    return res.end(Buffer.from(JSON.stringify({
      status: 'NO', reason: 'MEMBER KEY NOT REGISTERED', chunk: 0, dev: 'HANOMAN-FF',
    })).toString('base64'));
  }
  if (keyData.active === false) {
    return res.end(Buffer.from(JSON.stringify({
      status: 'NO', reason: 'Login ditolak server', chunk: 0, dev: 'HANOMAN-FF',
    })).toString('base64'));
  }

  // ---- log koneksi (best-effort) ----
  try {
    const logs = await storeGet('logs', []);
    logs.unshift({ key: userKey, game, ip: req.headers['x-forwarded-for'] || '', ua: req.headers['user-agent'] || '', time: Date.now() });
    if (logs.length > 2000) logs.length = 2000;
    await storeSet('logs', logs);
  } catch (e) {}

  // ---- respons sukses ----
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'hanoman-emulator.vercel.app';

  let payload;
  if (!STRICT_KEYS) {
    // MIRROR: replay byte-identik respons server asli.
    // userver tetap ke server ORI (download config dari sana),
    // crypt asli → decrypt blob asli di client selalu cocok.
    return res.end(REAL_AUTH_B64);
  } else {
    // STRICT: crypt dinamis (config userver kita pun enkripsi sendiri)
    payload = {
      status: 'OK',
      crypt: makeCrypt(userKey),
      userver: `${proto}://${host}/api/connection/v1/ff`,
      chunk: 1,
      dev: 'HANOMAN-FF',
    };
  }
  return res.end(Buffer.from(JSON.stringify(payload)).toString('base64'));
};
