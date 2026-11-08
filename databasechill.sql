-- ==============================================================================
-- CHILL BANK FAMILY - SUPABASE MIGRATION SCRIPT
-- ==============================================================================
-- Menyiapkan tabel, index, RLS (Row Level Security), triggers, dan RPC functions
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABEL PROFILES (terhubung dengan auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  no_hp TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABEL PESANAN_TABUNGAN
CREATE TABLE IF NOT EXISTS public.pesanan_tabungan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nama_tabungan TEXT NOT NULL,
  target_nominal NUMERIC CHECK (target_nominal IS NULL OR target_nominal > 0),
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'disetujui', 'ditolak')),
  alasan_tolak TEXT,
  diproses_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABEL TABUNGAN
CREATE TABLE IF NOT EXISTS public.tabungan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pesanan_id UUID REFERENCES public.pesanan_tabungan(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE CHECK (LENGTH(token) >= 16),
  tag_ditulis BOOLEAN NOT NULL DEFAULT FALSE,
  saldo NUMERIC NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL TRANSAKSI
CREATE TABLE IF NOT EXISTS public.transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabungan_id UUID NOT NULL REFERENCES public.tabungan(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('setor', 'tarik')),
  nominal NUMERIC NOT NULL CHECK (nominal > 0),
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'sah' CHECK (status IN ('sah', 'dibatalkan')),
  alasan_batal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_pesanan_member ON public.pesanan_tabungan(member_id);
CREATE INDEX IF NOT EXISTS idx_tabungan_member ON public.tabungan(member_id);
CREATE INDEX IF NOT EXISTS idx_tabungan_token ON public.tabungan(token);
CREATE INDEX IF NOT EXISTS idx_transaksi_tabungan ON public.transaksi(tabungan_id);
CREATE INDEX IF NOT EXISTS idx_transaksi_member ON public.transaksi(member_id);

-- ==============================================================================
-- 6. TRIGGER AUTO-CREATE PROFILE SAAT USER REGISTER DI AUTH.USERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nama, no_hp, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'no_hp',
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO UPDATE
  SET nama = EXCLUDED.nama,
      no_hp = COALESCE(EXCLUDED.no_hp, profiles.no_hp);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 7. TRIGGER & VALIDASI SALDO TABUNGAN (Dihitung dari transaksi 'sah')
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_tabungan_saldo()
RETURNS TRIGGER AS $$
DECLARE
  v_tabungan_id UUID;
  v_new_saldo NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_tabungan_id := OLD.tabungan_id;
  ELSE
    v_tabungan_id := NEW.tabungan_id;
  END IF;

  -- Hitung total setor dikurangi total tarik untuk transaksi sah
  SELECT COALESCE(SUM(CASE WHEN tipe = 'setor' THEN nominal ELSE -nominal END), 0)
  INTO v_new_saldo
  FROM public.transaksi
  WHERE tabungan_id = v_tabungan_id AND status = 'sah';

  IF v_new_saldo < 0 THEN
    RAISE EXCEPTION 'Saldo tidak mencukupi untuk penarikan ini. Saldo akhir tidak boleh negatif.';
  END IF;

  UPDATE public.tabungan
  SET saldo = v_new_saldo
  WHERE id = v_tabungan_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recalculate_saldo ON public.transaksi;
CREATE TRIGGER trg_recalculate_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.transaksi
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_tabungan_saldo();

-- ==============================================================================
-- 8. HELPER SECURITY FUNCTION: CHECK ADMIN ROLE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Aktifkan RLS di seluruh tabel
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesanan_tabungan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabungan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi ENABLE ROW LEVEL SECURITY;

-- 9.1 POLICIES: PROFILES
DROP POLICY IF EXISTS "Profiles dapat dibaca oleh pemilik atau admin" ON public.profiles;
CREATE POLICY "Profiles dapat dibaca oleh pemilik atau admin"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Profiles dapat diperbarui oleh pemilik atau admin" ON public.profiles;
CREATE POLICY "Profiles dapat diperbarui oleh pemilik atau admin"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    -- User biasa tidak boleh mengubah role mereka sendiri menjadi admin
    (public.is_admin()) OR (auth.uid() = id AND role = 'member')
  );

-- 9.2 POLICIES: PESANAN_TABUNGAN
DROP POLICY IF EXISTS "Member melihat pesanan miliknya, Admin melihat semua" ON public.pesanan_tabungan;
CREATE POLICY "Member melihat pesanan miliknya, Admin melihat semua"
  ON public.pesanan_tabungan FOR SELECT
  USING (auth.uid() = member_id OR public.is_admin());

DROP POLICY IF EXISTS "Member dapat membuat pesanan untuk dirinya sendiri" ON public.pesanan_tabungan;
CREATE POLICY "Member dapat membuat pesanan untuk dirinya sendiri"
  ON public.pesanan_tabungan FOR INSERT
  WITH CHECK (auth.uid() = member_id);

DROP POLICY IF EXISTS "Admin dapat mengupdate status pesanan" ON public.pesanan_tabungan;
CREATE POLICY "Admin dapat mengupdate status pesanan"
  ON public.pesanan_tabungan FOR UPDATE
  USING (public.is_admin());

-- 9.3 POLICIES: TABUNGAN
DROP POLICY IF EXISTS "Member melihat tabungan miliknya, Admin melihat semua" ON public.tabungan;
CREATE POLICY "Member melihat tabungan miliknya, Admin melihat semua"
  ON public.tabungan FOR SELECT
  USING (auth.uid() = member_id OR public.is_admin());

DROP POLICY IF EXISTS "Hanya Admin yang dapat membuat tabungan" ON public.tabungan;
CREATE POLICY "Hanya Admin yang dapat membuat tabungan"
  ON public.tabungan FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin dapat memperbarui data tabungan" ON public.tabungan;
CREATE POLICY "Admin dapat memperbarui data tabungan"
  ON public.tabungan FOR UPDATE
  USING (public.is_admin());

-- 9.4 POLICIES: TRANSAKSI
DROP POLICY IF EXISTS "Member melihat transaksi tabungannya, Admin melihat semua" ON public.transaksi;
CREATE POLICY "Member melihat transaksi tabungannya, Admin melihat semua"
  ON public.transaksi FOR SELECT
  USING (auth.uid() = member_id OR public.is_admin());

DROP POLICY IF EXISTS "Member membuat transaksi di tabungan miliknya yang aktif" ON public.transaksi;
CREATE POLICY "Member membuat transaksi di tabungan miliknya yang aktif"
  ON public.transaksi FOR INSERT
  WITH CHECK (
    auth.uid() = member_id
    AND EXISTS (
      SELECT 1 FROM public.tabungan
      WHERE id = tabungan_id
        AND member_id = auth.uid()
        AND aktif = TRUE
    )
  );

DROP POLICY IF EXISTS "Hanya Admin yang dapat mengubah status transaksi (pembatalan)" ON public.transaksi;
CREATE POLICY "Hanya Admin yang dapat mengubah status transaksi (pembatalan)"
  ON public.transaksi FOR UPDATE
  USING (public.is_admin());

-- ==============================================================================
-- 10. RPC FUNCTIONS (Prosedur Aman)
-- ==============================================================================

-- 10.1 Admin Menyetujui Pesanan & Otomatis Membuat Tabungan dengan Token Acak Unik
CREATE OR REPLACE FUNCTION public.approve_pesanan(p_pesanan_id UUID)
RETURNS UUID AS $$
DECLARE
  v_pesanan RECORD;
  v_token TEXT;
  v_new_tabungan_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Admin yang dapat menyetujui pesanan.';
  END IF;

  SELECT * INTO v_pesanan
  FROM public.pesanan_tabungan
  WHERE id = p_pesanan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;

  IF v_pesanan.status != 'pending' THEN
    RAISE EXCEPTION 'Pesanan sudah diproses sebelumnya.';
  END IF;

  -- Buat token acak 32 karakter hex (16 bytes = 32 karakter hex yang sulit ditebak)
  v_token := encode(gen_random_bytes(24), 'hex');

  -- Masukkan ke tabel tabungan
  INSERT INTO public.tabungan (member_id, pesanan_id, nama, token, tag_ditulis, saldo, aktif)
  VALUES (v_pesanan.member_id, v_pesanan.id, v_pesanan.nama_tabungan, v_token, FALSE, 0, TRUE)
  RETURNING id INTO v_new_tabungan_id;

  -- Perbarui status pesanan
  UPDATE public.pesanan_tabungan
  SET status = 'disetujui',
      diproses_oleh = auth.uid()
  WHERE id = p_pesanan_id;

  RETURN v_new_tabungan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.2 Admin Menolak Pesanan dengan Alasan
CREATE OR REPLACE FUNCTION public.reject_pesanan(p_pesanan_id UUID, p_alasan TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Admin yang dapat menolak pesanan.';
  END IF;

  UPDATE public.pesanan_tabungan
  SET status = 'ditolak',
      alasan_tolak = p_alasan,
      diproses_oleh = auth.uid()
  WHERE id = p_pesanan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.3 Admin Membatalkan Transaksi (Soft Cancel)
CREATE OR REPLACE FUNCTION public.cancel_transaksi(p_transaksi_id UUID, p_alasan TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Admin yang dapat membatalkan transaksi.';
  END IF;

  UPDATE public.transaksi
  SET status = 'dibatalkan',
      alasan_batal = p_alasan
  WHERE id = p_transaksi_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 11. CONTOH SEED / PERINTAH MENJADIKAN USER SEBAGAI ADMIN:
-- Jalankan query berikut di SQL Editor Supabase setelah mendaftar email admin:
-- UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@chillbank.com');
-- ==============================================================================
