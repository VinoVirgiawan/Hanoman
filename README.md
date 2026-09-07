# vercelhanoman

Emulator API auth untuk **HanoMan.sh** (Free Fire mod loader) di Vercel.
Meniru persis format respons server asli `hanoman.cakamin.com`.

## Endpoint

| Endpoint | Fungsi |
|---|---|
| `GET/POST /api/xapp-ff` | Auth member key → balas `base64(JSON)` |
| `GET/POST /api/connection/v1/ff` | Userver (config cheat) → balas `base64(blob)` |

## Format respons auth

Mode default (**MIRROR**) mengirim respons **byte-identik** dengan
server asli — `userver` **tetap menunjuk ke server ORI**
(`hanoman.cakamin.com`), jadi:

- auth request diterima server Vercel kamu
- **download config tetap dari server asli** (crypt asli + blob asli,
  decrypt client pasti cocok 100%)

```
HTTP 200
Content-Type: application/json

eyJzdGF0dXMiOiJPSyIsImNyeXB0Ijoi... (base64, byte-identik server asli)
```

Decode base64 → JSON:

```json
{
  "status":  "OK",
  "crypt":   "tx-₹7#_-3%09*",
  "userver": "https://hanoman.cakamin.com/api/connection/v1/ff",
  "chunk":   1,
  "dev":     "HANOMAN-FF"
}
```

> Mode **STRICT** (`STRICT_KEYS=1` env): key divalidasi server-side,
> dan `userver` diarahkan ke host Vercel sendiri (config dikontrol
> sendiri, blob dienkripsi dengan crypt dari request).

- `status: "OK"` → cheat lanjut ke **Login Success**
- `status: "NO"` + `reason` → cheat tampilkan gagal login
- `userver` otomatis mengarah ke host Vercel kamu

## Key bawaan

| Key | Masa aktif |
|---|---|
| `FF_5C015B` | 30 hari |
| `FF_TRIAL` | 1 hari |
| `HANOMAN` | 365 hari |

Key tambahan: edit `HARDCODED_KEYS` di `api/xapp-ff.js`, atau kelola
via Vercel KV (`keys` store) bila `@vercel/kv` terpasang.

## Deploy

```bash
cd vercelhanoman
npx vercel login
npx vercel --prod
```

Atau drag & drop folder ini ke https://vercel.com/new

## Test setelah deploy

```bash
curl "https://<app>.vercel.app/api/xapp-ff?user_key=FF_5C015B"
# => harus byte-identik dengan:
#    curl "https://hanoman.cakamin.com/api/xapp-ff?user_key=FF_5C015B"
```

## Patch binary HanoMan.sh

Gunakan script Python di folder `project/`:

```bash
python3 replace_hanoman_url.py https://<app>.vercel.app --input HanoMan.sh
# → HanoMan_patched.sh
```
