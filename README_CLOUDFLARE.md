# Panduan Kustomisasi & Deploy Gratis ke Cloudflare Pages

Studio **HexOffice** dirancang agar 100% gratis dijalankan menggunakan **Cloudflare Pages + Pages Functions** (kuota gratis 100.000 request/hari & bandwidth tak terbatas) dan **Gemini API Free Tier** dari Google AI Studio.

---

## 1. Bagian Kode yang Perlu Anda Sesuaikan (`[GANTI DI SINI]`)

Cari komentar `// [GANTI DI SINI]` di dalam file-file berikut:

1. **`src/data/officeData.ts`**
   - `AGENT_PROFILES`: Ubah nama karyawan AI (`Raka`, `Tari`, `Bima`, `Sora`), peran, spesialisasi, warna jaket (`jacketColor`), warna aksen (`accentHex`), aksesoris (`headset`, `glasses`, `beret`, `visor`), dan posisi meja (`homeCoord`).
   - `CREATOR_QUICK_PROMPTS`: Tambah atau edit tombol tugas cepat 1-klik untuk alur kerja **Adobe Stock**, **YouTube**, dan **Facebook Reels** Anda.
   - `TILE_CATALOG` & `createInitialHexMap()`: Atur nama zona dan susunan awal 37 ubin heksagon kantor.
2. **`src/components/TopBar.tsx` & `index.html`**
   - Ubah wordmark `HexOffice` dan `<title>` menjadi nama brand studio Anda sendiri.
3. **`functions/api/agent/dispatch.ts` (untuk Cloudflare) & `server.ts` (untuk lokal)**
   - `GEMINI_MODEL`: Default memakai `'gemini-4-hydrogen'` (kuota gratis besar). Anda juga bisa menggantinya ke `'gemini-3.1-flash-lite'` bila ingin throughput lebih ringan.
   - `systemInstruction`: Sesuaikan gaya bahasa, aturan keyword Adobe Stock, format skrip YouTube/FB Reels, atau larangan merek dagang sesuai SOP studio Anda.
4. **`wrangler.toml`**
   - Ubah `name = "hexoffice-studio"` menjadi nama project Cloudflare Pages pilihan Anda.

---

## 2. Cara Mendapatkan API Key Gratis (Tanpa Upgrade Plan)

1. Buka **Google AI Studio** (`https://aistudio.google.com/apikey`).
2. Klik **Create API Key** menggunakan akun Google biasa (tidak perlu kartu kredit untuk Free Tier `gemini-4-hydrogen` / `gemini-3.1-flash-lite`).
3. Simpan API key tersebut dengan aman (jangan pernah dimasukkan langsung ke file `src/` frontend!).

---

## 3. Langkah Deploy 100% Gratis ke Cloudflare Pages

### Opsi A: Via Dashboard Cloudflare (Tanpa CLI, Paling Mudah)
1. Ekstrak file ZIP project ini, lalu push ke repository **GitHub** (boleh Private repo, gratis).
2. Login ke **Cloudflare Dashboard** -> menu **Workers & Pages** -> **Create** -> tab **Pages** -> **Connect to Git**.
3. Pilih repository studio Anda, lalu isi konfigurasi build:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Klik **Save and Deploy**. Folder `functions/api/agent/dispatch.ts` otomatis aktif sebagai backend serverless gratis!
5. Setelah deploy selesai, masuk ke tab **Settings -> Variables and Secrets** pada project Pages tersebut:
   - Tambahkan **Secret** baru:
     - **Variable name**: `GEMINI_API_KEY` *(wajib atau pilih salah satu)*
     - **Value**: *(tempel API key Google AI Studio Anda)*
   - *(Opsional & Direkomendasikan)* Tambahkan juga **Secret** Groq API gratis (`https://console.groq.com/keys`):
     - **Variable name**: `GROQ_API_KEY`
     - **Value**: *(tempel API key Groq Anda — otomatis menjadi failover instan jika Gemini sibuk 503)*
   - Simpan, lalu klik **Retry deployment** di tab Deployments agar Secret langsung terbaca.

### Opsi B: Via Wrangler CLI dari Terminal Lokal
```bash
npm install
npm run build
npx wrangler pages deploy dist
```
Lalu set secret via CLI:
```bash
npx wrangler pages secret put GEMINI_API_KEY
```

---

## 4. Ringkasan Batas Free Tier (Biaya Rp 0)
- **Cloudflare Pages Static Hosting**: Gratis, bandwidth unlimited.
- **Cloudflare Pages Functions (`/api/agent/dispatch`)**: Gratis hingga **100.000 request/hari**.
- **Google AI Studio Free Tier (`gemini-4-hydrogen`)**: Gratis tanpa kartu kredit (cocok untuk operasional studio harian pribadi/tim kecil).
