-- Migration: tambahkan kolom profil profesional lengkap ke tabel profiles
-- Jalankan script ini via Supabase Dashboard atau CLI

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS pekerjaan TEXT,
    ADD COLUMN IF NOT EXISTS pendidikan TEXT,
    ADD COLUMN IF NOT EXISTS foto_url TEXT,
    ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
    ADD COLUMN IF NOT EXISTS nomor_identitas TEXT;

