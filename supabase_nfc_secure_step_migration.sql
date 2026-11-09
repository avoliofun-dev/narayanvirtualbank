-- ==============================================================================
-- MIGRASI: PENULISAN TAG NFC BERTAHAP, LINK OTOMATIS, PASSWORD KUNCI & BUKTI FOTO
-- ==============================================================================

-- 1. Tambah kolom pendukung pada tabel public.orders jika belum ada
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS nfc_link TEXT,
  ADD COLUMN IF NOT EXISTS nfc_password TEXT,
  ADD COLUMN IF NOT EXISTS foto_penerimaan TEXT;

-- ==============================================================================
-- 2. HAPUS VERSI FUNGSI LAMA AGAR TIDAK TERJADI AMBIGUITAS OVERLOAD FUNCTION
--    Error: "Could not choose the best candidate function"
-- ==============================================================================
DROP FUNCTION IF EXISTS public.process_order(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.process_order(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.process_order(uuid, text);

DROP FUNCTION IF EXISTS public.confirm_order_received(uuid);
DROP FUNCTION IF EXISTS public.confirm_order_received(uuid, text);

-- ==============================================================================
-- 3. BUAT SATU FUNGSI PROCESS_ORDER TUNGGAL YANG BERSIH DENGAN 6 PARAMETER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_order(
  p_order_id UUID,
  p_status TEXT,
  p_nfc_uid TEXT DEFAULT NULL,
  p_alasan_tolak TEXT DEFAULT NULL,
  p_nfc_link TEXT DEFAULT NULL,
  p_nfc_password TEXT DEFAULT NULL
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

    -- Buat / tautkan celengan fisik
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
        nfc_link = COALESCE(p_nfc_link, nfc_link),
        nfc_password = COALESCE(p_nfc_password, nfc_password),
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
    'nfc_uid', p_nfc_uid,
    'nfc_link', p_nfc_link,
    'nfc_password', p_nfc_password
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 4. BUAT SATU FUNGSI CONFIRM_ORDER_RECEIVED TUNGGAL DENGAN FOTO BUKTI
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.confirm_order_received(
  p_order_id UUID,
  p_foto_penerimaan TEXT DEFAULT NULL
)
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
      foto_penerimaan = COALESCE(p_foto_penerimaan, foto_penerimaan),
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'diterima',
    'foto_penerimaan', p_foto_penerimaan
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
