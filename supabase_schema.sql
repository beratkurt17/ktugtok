-- ==============================================================================
-- KTÜ GTOK OKÇULUK KULÜBÜ - SUPABASE VERİTABANI TABLOLARI & GÜVENLİK AYARLARI
-- Bu SQL kodunu Supabase Dashboard > SQL Editor sekmesine yapıştırıp "Run" butonuna basınız.
-- ==============================================================================

-- 1. SPORCULAR / ÖĞRENCİLER TABLOSU
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,                       -- Öğrenci No veya Sporcu ID (Örn: 415820)
    name TEXT NOT NULL,                        -- Ad Soyad
    faculty TEXT DEFAULT '',                   -- Fakülte
    department TEXT DEFAULT '',                -- Bölüm
    category TEXT DEFAULT 'Genel',             -- Kategori (Örn: Geleneksel Türk Okçuluğu, Kemankeş Adayı)
    phone TEXT DEFAULT '',                     -- Telefon
    notes TEXT DEFAULT '',                     -- Yay sertliği, tirkeş notları vb.
    role TEXT DEFAULT '',                      -- Yönetim Kurulu Görevi (Örn: Kulüp Başkanı, Genel Sekreter)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Var olan tablolar için role sütunu ekleme (Eğer tablo daha önce oluşturulduysa)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS role TEXT DEFAULT '';

-- 2. YOKLAMA VE GİRİŞ KAYITLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.attendance (
    record_id TEXT PRIMARY KEY,                -- Benzersiz kayıt ID (Örn: REC-1712478901234)
    student_id TEXT NOT NULL,                  -- Öğrenci No
    student_name TEXT NOT NULL,                -- Sporcu Adı
    category TEXT DEFAULT 'Genel',             -- Kategori
    date TEXT NOT NULL,                        -- YYYY-MM-DD
    time TEXT NOT NULL,                        -- HH:MM:SS
    status TEXT DEFAULT 'Geldi',               -- Durum
    timestamp BIGINT,                          -- Unix zaman damgası (ms)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. KULÜP AYARLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,                      -- Ayar anahtarı (Örn: 'club_settings')
    value JSONB NOT NULL,                      -- Ayar içeriği (JSON)
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ROW LEVEL SECURITY (RLS) AYARLARI
-- Kulüp üyeleri ve antrenörler doğrudan erişebilsin diye anonim (public) okuma ve yazma izinleri
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Students İzinleri
DROP POLICY IF EXISTS "Allow public read students" ON public.students;
CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert students" ON public.students;
CREATE POLICY "Allow public insert students" ON public.students FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update students" ON public.students;
CREATE POLICY "Allow public update students" ON public.students FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete students" ON public.students;
CREATE POLICY "Allow public delete students" ON public.students FOR DELETE USING (true);

-- Attendance İzinleri
DROP POLICY IF EXISTS "Allow public read attendance" ON public.attendance;
CREATE POLICY "Allow public read attendance" ON public.attendance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert attendance" ON public.attendance;
CREATE POLICY "Allow public insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update attendance" ON public.attendance;
CREATE POLICY "Allow public update attendance" ON public.attendance FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete attendance" ON public.attendance;
CREATE POLICY "Allow public delete attendance" ON public.attendance FOR DELETE USING (true);

-- Settings İzinleri
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert settings" ON public.settings;
CREATE POLICY "Allow public insert settings" ON public.settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update settings" ON public.settings;
CREATE POLICY "Allow public update settings" ON public.settings FOR UPDATE USING (true);

-- 5. CANLI SENKRONİZASYON (REALTIME)
-- Farklı telefon ve bilgisayarlardan yapılan okutmaların anında ekranda belirmesi için
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  END IF;
END $$;
