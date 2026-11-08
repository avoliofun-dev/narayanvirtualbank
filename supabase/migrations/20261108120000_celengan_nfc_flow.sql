-- ==============================================================================
-- MIGRATION: SISTEM BANK VIRTUAL DENGAN CELENGAN NFC & REALTIME
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABEL PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  no_hp TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL ORDERS (Pemesanan Celengan NFC)
-- Status alur: dipesan -> diproses -> dikirim -> diterima (atau ditolak)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nama_celengan TEXT NOT NULL,
  target_nominal NUMERIC CHECK (target_nominal IS NULL OR target_nominal > 0),
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'dipesan' CHECK (status IN ('dipesan', 'diproses', 'dikirim', 'diterima', 'ditolak')),
  nfc_uid TEXT,
  alasan_tolak TEXT,
  diproses_oleh UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_member_id ON public.orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 3. TABEL PIGGY_BANKS (Celengan Fisik dengan NTAG NFC)
CREATE TABLE IF NOT EXISTS public.piggy_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  nfc_uid TEXT NOT NULL UNIQUE CHECK (LENGTH(nfc_uid) >= 4),
  saldo NUMERIC NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif', 'dikunci')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_piggy_banks_owner ON public.piggy_banks(owner_id);
CREATE INDEX IF NOT EXISTS idx_piggy_banks_nfc_uid ON public.piggy_banks(nfc_uid);

-- 4. TABEL TRANSACTIONS (Audit Log Transaksi Atomik)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piggy_bank_id UUID NOT NULL REFERENCES public.piggy_banks(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('setor', 'tarik')),
  jumlah NUMERIC NOT NULL CHECK (jumlah > 0),
  saldo_sebelum NUMERIC NOT NULL CHECK (saldo_sebelum >= 0),
  saldo_sesudah NUMERIC NOT NULL CHECK (saldo_sesudah >= 0),
  catatan TEXT,
  waktu TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_piggy ON public.transactions(piggy_bank_id);
CREATE INDEX IF NOT EXISTS idx_transactions_member ON public.transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_waktu ON public.transactions(waktu DESC);

-- 5. TRIGGER REGISTRASI USER OTOMATIS
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
      no_hp = COALESCE(EXCLUDED.no_hp, profiles.no_hp),
      role = COALESCE(EXCLUDED.role, profiles.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. HELPER IS_ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piggy_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 7.1 Profiles Policies
DROP POLICY IF EXISTS "Profiles dapat dibaca oleh pemilik atau admin" ON public.profiles;
CREATE POLICY "Profiles dapat dibaca oleh pemilik atau admin"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Profiles dapat diperbarui oleh pemilik atau admin" ON public.profiles;
CREATE POLICY "Profiles dapat diperbarui oleh pemilik atau admin"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (public.is_admin() OR auth.uid() = id);

DROP POLICY IF EXISTS "Profiles dapat ditambahkan" ON public.profiles;
CREATE POLICY "Profiles dapat ditambahkan"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 7.2 Orders Policies
DROP POLICY IF EXISTS "Member melihat order miliknya, Admin melihat semua" ON public.orders;
CREATE POLICY "Member melihat order miliknya, Admin melihat semua"
  ON public.orders FOR SELECT
  USING (auth.uid() = member_id OR public.is_admin());

DROP POLICY IF EXISTS "Member dapat membuat order untuk dirinya sendiri" ON public.orders;
CREATE POLICY "Member dapat membuat order untuk dirinya sendiri"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = member_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin dapat mengupdate order atau Member menandai diterima" ON public.orders;
CREATE POLICY "Admin dapat mengupdate order atau Member menandai diterima"
  ON public.orders FOR UPDATE
  USING (public.is_admin() OR auth.uid() = member_id)
  WITH CHECK (
    public.is_admin() OR 
    (auth.uid() = member_id AND status = 'diterima')
  );

-- 7.3 Piggy Banks Policies
DROP POLICY IF EXISTS "Member melihat celengan miliknya, Admin melihat semua" ON public.piggy_banks;
CREATE POLICY "Member melihat celengan miliknya, Admin melihat semua"
  ON public.piggy_banks FOR SELECT
  USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin dapat membuat celengan" ON public.piggy_banks;
CREATE POLICY "Admin dapat membuat celengan"
  ON public.piggy_banks FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin dapat memperbarui celengan" ON public.piggy_banks;
CREATE POLICY "Admin dapat memperbarui celengan"
  ON public.piggy_banks FOR UPDATE
  USING (public.is_admin());

-- 7.4 Transactions Policies (HANYA INSERT & SELECT)
DROP POLICY IF EXISTS "Member melihat transaksi celengannya, Admin melihat semua" ON public.transactions;
CREATE POLICY "Member melihat transaksi celengannya, Admin melihat semua"
  ON public.transactions FOR SELECT
  USING (auth.uid() = member_id OR public.is_admin());

DROP POLICY IF EXISTS "Transaksi dapat ditambahkan oleh sistem atau pemilik" ON public.transactions;
CREATE POLICY "Transaksi dapat ditambahkan oleh sistem atau pemilik"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = member_id OR public.is_admin());

-- 8. RPC: ADMIN PROSES ORDER & TAUTKAN NFC UID
CREATE OR REPLACE FUNCTION public.process_order(
  p_order_id UUID,
  p_status TEXT,
  p_nfc_uid TEXT DEFAULT NULL,
  p_alasan_tolak TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_piggy_id UUID := NULL;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Admin yang dapat memproses pesanan celengan.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;

  IF p_status = 'dikirim' THEN
    IF p_nfc_uid IS NULL OR LENGTH(TRIM(p_nfc_uid)) < 4 THEN
      RAISE EXCEPTION 'UID tag NFC wajib diisi sebelum menandai pesanan dikirim.';
    END IF;

    INSERT INTO public.piggy_banks (order_id, owner_id, nama, nfc_uid, saldo, status)
    VALUES (
      v_order.id,
      v_order.member_id,
      v_order.nama_celengan,
      TRIM(p_nfc_uid),
      0,
      'aktif'
    )
    ON CONFLICT (nfc_uid) DO UPDATE
    SET nama = EXCLUDED.nama,
        owner_id = EXCLUDED.owner_id,
        order_id = EXCLUDED.order_id,
        status = 'aktif',
        updated_at = NOW()
    RETURNING id INTO v_piggy_id;

    UPDATE public.orders
    SET status = 'dikirim',
        nfc_uid = TRIM(p_nfc_uid),
        diproses_oleh = auth.uid(),
        updated_at = NOW()
    WHERE id = p_order_id;

  ELSIF p_status = 'ditolak' THEN
    UPDATE public.orders
    SET status = 'ditolak',
        alasan_tolak = p_alasan_tolak,
        diproses_oleh = auth.uid(),
        updated_at = NOW()
    WHERE id = p_order_id;

  ELSE
    UPDATE public.orders
    SET status = p_status,
        diproses_oleh = auth.uid(),
        updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', p_status,
    'piggy_bank_id', v_piggy_id,
    'nfc_uid', p_nfc_uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: MEMBER KONFIRMASI TERIMA CELENGAN
CREATE OR REPLACE FUNCTION public.confirm_order_received(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan.';
  END IF;

  IF v_order.member_id != auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Anda hanya dapat mengonfirmasi pesanan milik sendiri.';
  END IF;

  IF v_order.status != 'dikirim' THEN
    RAISE EXCEPTION 'Pesanan belum dalam status dikirim.';
  END IF;

  UPDATE public.orders
  SET status = 'diterima',
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN json_build_object('success', true, 'order_id', p_order_id, 'status', 'diterima');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: TRANSAKSI CELENGAN NFC ATOMIK (SETOR / TARIK)
CREATE OR REPLACE FUNCTION public.execute_transaction(
  p_nfc_uid TEXT,
  p_tipe TEXT,
  p_jumlah NUMERIC,
  p_catatan TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_piggy RECORD;
  v_saldo_sebelum NUMERIC;
  v_saldo_sesudah NUMERIC;
  v_tx_id UUID;
BEGIN
  IF p_jumlah IS NULL OR p_jumlah <= 0 THEN
    RAISE EXCEPTION 'Jumlah transaksi harus lebih besar dari 0.';
  END IF;

  IF p_tipe NOT IN ('setor', 'tarik') THEN
    RAISE EXCEPTION 'Tipe transaksi harus setor atau tarik.';
  END IF;

  -- Kunci baris celengan untuk atomisitas (Row-Level Exclusive Lock)
  SELECT * INTO v_piggy
  FROM public.piggy_banks
  WHERE nfc_uid = TRIM(p_nfc_uid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Celengan dengan UID NFC "%" tidak ditemukan.', p_nfc_uid;
  END IF;

  IF v_piggy.status != 'aktif' THEN
    RAISE EXCEPTION 'Celengan sedang dalam status nonaktif atau terkunci.';
  END IF;

  IF v_piggy.owner_id != auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Celengan NFC ini bukan milik akun Anda.';
  END IF;

  v_saldo_sebelum := v_piggy.saldo;

  IF p_tipe = 'tarik' THEN
    IF v_saldo_sebelum < p_jumlah THEN
      RAISE EXCEPTION 'Saldo celengan tidak mencukupi (Tersedia: %, Diminta: %).', v_saldo_sebelum, p_jumlah;
    END IF;
    v_saldo_sesudah := v_saldo_sebelum - p_jumlah;
  ELSE
    v_saldo_sesudah := v_saldo_sebelum + p_jumlah;
  END IF;

  UPDATE public.piggy_banks
  SET saldo = v_saldo_sesudah,
      updated_at = NOW()
  WHERE id = v_piggy.id;

  INSERT INTO public.transactions (
    piggy_bank_id,
    member_id,
    tipe,
    jumlah,
    saldo_sebelum,
    saldo_sesudah,
    catatan,
    waktu
  )
  VALUES (
    v_piggy.id,
    v_piggy.owner_id,
    p_tipe,
    p_jumlah,
    v_saldo_sebelum,
    v_saldo_sesudah,
    p_catatan,
    NOW()
  )
  RETURNING id INTO v_tx_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'piggy_bank_id', v_piggy.id,
    'nfc_uid', p_nfc_uid,
    'tipe', p_tipe,
    'jumlah', p_jumlah,
    'saldo_sebelum', v_saldo_sebelum,
    'saldo_sesudah', v_saldo_sesudah,
    'waktu', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. PUBLIKASI REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'piggy_banks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.piggy_banks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END $$;

