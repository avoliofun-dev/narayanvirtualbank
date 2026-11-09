-- Migration: tambahkan kolom alamat_lengkap ke tabel profiles
-- Jalankan script ini via Supabase Dashboard atau CLI

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS alamat_lengkap TEXT;

