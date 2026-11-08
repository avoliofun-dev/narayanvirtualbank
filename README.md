# BANKVERSE 3D (Tahap 8)

Proyek Vite + JavaScript (three.js r128 + Firebase) siap deploy ke Vercel.

## Jalankan lokal
```bash
npm install
cp .env.example .env   # isi konfigurasi Firebase
npm run dev
```

## Deploy ke Vercel
1. Upload folder ini ke GitHub (atau `npx vercel` dari folder ini).
2. Di Vercel: New Project, pilih repo. Framework otomatis terdeteksi Vite.
3. Settings > Environment Variables, isi:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
4. Deploy.

Di Firebase Console > Authentication > Settings > Authorized domains,
tambahkan domain `*.vercel.app` Anda agar login berfungsi.
