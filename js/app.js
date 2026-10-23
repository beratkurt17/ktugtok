// Ana Uygulama Başlatıcı ve Navigasyon
const SQL_SCHEMA_CODE = `-- ==============================================================================
-- KTÜ GTOK OKÇULUK KULÜBÜ - SUPABASE VERİTABANI TABLOLARI & GÜVENLİK AYARLARI
-- Bu SQL kodunu Supabase Dashboard > SQL Editor sekmesine yapıştırıp "Run" butonuna basınız.
-- ==============================================================================

-- 1. SPORCULAR / ÖĞRENCİLER TABLOSU
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    faculty TEXT DEFAULT '',
    department TEXT DEFAULT '',
    category TEXT DEFAULT 'Genel',
    phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. YOKLAMA VE GİRİŞ KAYITLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.attendance (
    record_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    category TEXT DEFAULT 'Genel',
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT DEFAULT 'Geldi',
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. KULÜP AYARLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ROW LEVEL SECURITY (RLS) AYARLARI
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read students" ON public.students;
CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert students" ON public.students;
CREATE POLICY "Allow public insert students" ON public.students FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update students" ON public.students;
CREATE POLICY "Allow public update students" ON public.students FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete students" ON public.students;
CREATE POLICY "Allow public delete students" ON public.students FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read attendance" ON public.attendance;
CREATE POLICY "Allow public read attendance" ON public.attendance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert attendance" ON public.attendance;
CREATE POLICY "Allow public insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update attendance" ON public.attendance;
CREATE POLICY "Allow public update attendance" ON public.attendance FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete attendance" ON public.attendance;
CREATE POLICY "Allow public delete attendance" ON public.attendance FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert settings" ON public.settings;
CREATE POLICY "Allow public insert settings" ON public.settings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update settings" ON public.settings;
CREATE POLICY "Allow public update settings" ON public.settings FOR UPDATE USING (true);

-- 5. CANLI SENKRONİZASYON (REALTIME)
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
END $$;`;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Canlı Saat ve Tarih
  function updateClock() {
    const timeEl = document.getElementById('header-live-time');
    if (!timeEl) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });
    const timeStr = now.toTimeString().slice(0, 8);
    timeEl.textContent = `${dateStr} • ${timeStr}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // 2. Sekme Değiştirme Fonksiyonu
  function switchTab(targetId) {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(t => {
      if (t.dataset.tab === targetId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    panes.forEach(p => {
      if (p.id === targetId) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // Sekmeye özel yenilemeler
    if (targetId === 'tab-sessions') {
      if (window.SessionManager) SessionManager.renderSessionsGrid();
    } else if (targetId === 'tab-students') {
      if (window.SessionManager) SessionManager.renderSessionFilter();
      StudentsManager.renderStudentsList();
    } else if (targetId === 'tab-history') {
      HistoryManager.renderHistory();
    } else if (targetId === 'tab-scanner') {
      if (window.SessionManager) SessionManager.renderActiveSessionSelector();
      AttendanceManager.renderTodayList();
    } else if (targetId === 'tab-announcements') {
      if (window.AnnouncementsAdmin) AnnouncementsAdmin.renderList();
    }
  }

  window.appSwitchTab = switchTab;

  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Üst bardaki bulut rozetine tıklanırsa Ayarlar sekmesine git
  const headerCloudBadge = document.getElementById('header-cloud-badge');
  if (headerCloudBadge) {
    headerCloudBadge.addEventListener('click', () => {
      switchTab('tab-settings');
      const urlInput = document.getElementById('supabase-url-input');
      if (urlInput) urlInput.focus();
    });
  }

  // 3. Ayarlar & Kulüp Adı Yükle
  function loadSettings() {
    const settings = Storage.getSettings();
    const clubNameInputs = document.querySelectorAll('.club-name-text');
    clubNameInputs.forEach(el => el.textContent = settings.clubName || 'Geleneksel Türk Okçuluğu Kulübü');

    const clubNameInput = document.getElementById('setting-club-name');
    if (clubNameInput) clubNameInput.value = settings.clubName || '';

    const clubCodeInput = document.getElementById('setting-club-code');
    if (clubCodeInput) clubCodeInput.value = settings.clubCode || 'GTOK';

    const soundToggle = document.getElementById('setting-sound-toggle');
    if (soundToggle) {
      soundToggle.checked = settings.soundEnabled !== false;
      if (window.soundFX) window.soundFX.enabled = soundToggle.checked;
    }
  }
  loadSettings();

  // Ayarları Kaydet
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const clubName = document.getElementById('setting-club-name').value.trim();
      const clubCode = document.getElementById('setting-club-code').value.trim();
      const soundEnabled = document.getElementById('setting-sound-toggle').checked;

      Storage.saveSettings({
        ...Storage.getSettings(),
        clubName: clubName || 'GTOK Okçuluk Kulübü',
        clubCode: clubCode || 'GTOK',
        soundEnabled
      });

      if (window.soundFX) window.soundFX.enabled = soundEnabled;
      loadSettings();
      alert('Kulüp ayarları başarıyla güncellendi!');
    });
  }

  // 4. SUPABASE BULUT VERİTABANI YÖNETİMİ
  function loadSupabaseInputs() {
    if (!window.SupabaseDB) return;
    const config = window.SupabaseDB.getConfig();
    const urlInput = document.getElementById('supabase-url-input');
    const keyInput = document.getElementById('supabase-key-input');
    if (urlInput) urlInput.value = config.url || '';
    if (keyInput) keyInput.value = config.anonKey || '';
  }
  loadSupabaseInputs();

  // Test Et & Buluta Bağlan Butonu
  const btnSaveSupabase = document.getElementById('btn-save-supabase');
  const btnSaveSupabaseText = document.getElementById('btn-save-supabase-text');
  if (btnSaveSupabase) {
    btnSaveSupabase.addEventListener('click', async () => {
      const urlInput = document.getElementById('supabase-url-input');
      const keyInput = document.getElementById('supabase-key-input');
      const url = urlInput ? urlInput.value.trim() : '';
      const anonKey = keyInput ? keyInput.value.trim() : '';

      if (!url || !anonKey) {
        alert('Lütfen hem Proje URL hem de Anon Public Key alanlarını doldurun.');
        return;
      }

      btnSaveSupabase.disabled = true;
      if (btnSaveSupabaseText) btnSaveSupabaseText.textContent = '⏳ Test Ediliyor...';

      const result = await window.SupabaseDB.testConnection(url, anonKey);

      if (!result.success) {
        btnSaveSupabase.disabled = false;
        if (btnSaveSupabaseText) btnSaveSupabaseText.textContent = '⚡ Test Et & Buluta Bağlan';
        alert('❌ Bağlantı Başarısız!\n\nHata: ' + result.error);
        return;
      }

      // Başarılı ise kaydet ve istemciyi başlat
      window.SupabaseDB.saveConfig(url, anonKey);
      await Storage.init();

      btnSaveSupabase.disabled = false;
      if (btnSaveSupabaseText) btnSaveSupabaseText.textContent = '⚡ Test Et & Buluta Bağlan';
      alert('✅ Tebrikler! Supabase bulut veritabanına başarıyla bağlanıldı.\n\nArtık tüm cihazlardan yapılan okutmalar anlık olarak eşitlenecektir.');
    });
  }

  // Bağlantıyı Kes (Yerel Mod) Butonu
  const btnDisconnectSupabase = document.getElementById('btn-disconnect-supabase');
  if (btnDisconnectSupabase) {
    btnDisconnectSupabase.addEventListener('click', () => {
      if (confirm('Bulut bağlantısını kesip yerel moda dönmek istediğinize emin misiniz?')) {
        window.SupabaseDB.clearConfig();
        const urlInput = document.getElementById('supabase-url-input');
        const keyInput = document.getElementById('supabase-key-input');
        if (urlInput) urlInput.value = '';
        if (keyInput) keyInput.value = '';
        alert('Yerel moda geçildi. Veriler yalnızca bu tarayıcıda saklanacak.');
      }
    });
  }

  // Yerel Verileri Buluta Aktar Butonu
  const btnSyncToCloud = document.getElementById('btn-sync-to-cloud');
  if (btnSyncToCloud) {
    btnSyncToCloud.addEventListener('click', async () => {
      const students = Storage.getStudents();
      const attendance = Storage.getAttendance();
      const settings = Storage.getSettings();

      const msg = `Mevcut yerel veriler buluta yüklenecek:\n- ${students.length} Sporcu\n- ${attendance.length} Yoklama Kaydı\n\nDevam edilsin mi?`;
      if (!confirm(msg)) return;

      btnSyncToCloud.disabled = true;
      btnSyncToCloud.textContent = '⏳ Yükleniyor...';

      const res = await window.SupabaseDB.uploadLocalDataToSupabase(students, attendance, settings);
      btnSyncToCloud.disabled = false;
      btnSyncToCloud.textContent = '📤 Yerel Verileri Buluta Aktar';

      if (res.success) {
        alert(`✅ Veriler buluta başarıyla aktarıldı!\n\nAktarılan: ${res.studentsCount} Sporcu, ${res.attendanceCount} Yoklama.`);
      } else {
        alert('❌ Aktarma hatası: ' + res.error);
      }
    });
  }

  // SQL Kodunu Kopyala Butonu
  const btnCopySql = document.getElementById('btn-copy-sql');
  if (btnCopySql) {
    btnCopySql.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(SQL_SCHEMA_CODE);
        const originalText = btnCopySql.textContent;
        btnCopySql.textContent = '✅ Kopyalandı!';
        setTimeout(() => {
          btnCopySql.textContent = originalText;
        }, 2500);
      } catch {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = SQL_SCHEMA_CODE;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        btnCopySql.textContent = '✅ Kopyalandı!';
        setTimeout(() => {
          btnCopySql.textContent = '📋 SQL Kodunu Kopyala';
        }, 2500);
      }
    });
  }

  // 5. Yedekleme & Geri Yükleme
  const btnExportBackup = document.getElementById('btn-export-backup');
  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', () => Storage.exportAllDataJSON());
  }

  const backupFileInput = document.getElementById('backup-file-input');
  if (backupFileInput) {
    backupFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const success = Storage.importAllDataJSON(event.target.result);
        if (success) {
          alert('Yedek başarıyla yüklendi! Sayfa güncelleniyor...');
          location.reload();
        } else {
          alert('Hata: Geçersiz yedek dosyası!');
        }
      };
      reader.readAsText(file);
    });
  }

  // 6. Excel Ay Seçimi Varsayılanı (Mevcut Yıl-Ay)
  const excelMonth = document.getElementById('excel-month-select');
  if (excelMonth) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    excelMonth.value = `${y}-${m}`;
  }

  // 7. Modülleri ve Depolama Katmanını Başlat
  await Storage.init();
  if (window.SessionManager) {
    SessionManager.init();
  }
  StudentsManager.init();
  AttendanceManager.init();
  Scanner.init();
  HistoryManager.init();

  // URL Hash yönlendirmesi desteği (#ogrenciler, #tab-students, vb.)
  const hash = window.location.hash.replace('#', '');
  if (hash === 'ogrenciler' || hash === 'tab-students') {
    switchTab('tab-students');
  } else if (hash === 'seanslar' || hash === 'tab-sessions') {
    switchTab('tab-sessions');
  } else if (hash === 'duyurular' || hash === 'tab-announcements') {
    switchTab('tab-announcements');
  } else if (hash === 'gecmis' || hash === 'tab-history') {
    switchTab('tab-history');
  } else if (hash === 'ayarlar' || hash === 'tab-settings') {
    switchTab('tab-settings');
  }
});

/* ==========================================================================
   YETKİLİ PANELİ: WEB SİTESİ DUYURULARI YÖNETİCİSİ (AnnouncementsAdmin)
   ========================================================================== */
const AnnouncementsAdmin = {
  _cloudLoaded: false,

  getAnnouncements() {
    try {
      const data = localStorage.getItem('gtok_announcements_v1');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 'ann-1',
        tag: 'Önemli',
        date: '20 Ekim 2026',
        title: '2026-2027 Bahar Dönemi Okçuluk Talimleri Başladı',
        desc: 'Hasan Polat Spor Salonunda haftalık seanslarımız belirlenen saatlerde devam etmektedir.',
        detail: '<p>Tüm lisanslı ve temel eğitim sporcularımızın kendi antrenman seans saatlerine riayet etmeleri önemle rica olunur.</p>'
      }
    ];
  },

  async loadFromCloud() {
    if (window.SupabaseDB && typeof window.SupabaseDB.getAnnouncementsCloud === 'function') {
      const cloudList = await window.SupabaseDB.getAnnouncementsCloud();
      if (cloudList && Array.isArray(cloudList) && cloudList.length > 0) {
        localStorage.setItem('gtok_announcements_v1', JSON.stringify(cloudList));
        localStorage.setItem('gtok_club_announcements', JSON.stringify(cloudList));
        this._cloudLoaded = true;
        this.renderList();
      }
    }
  },

  async saveAnnouncements(list) {
    // 1. Önce yerel hafızaya kaydet
    localStorage.setItem('gtok_announcements_v1', JSON.stringify(list));
    localStorage.setItem('gtok_club_announcements', JSON.stringify(list));
    window.dispatchEvent(new Event('storage'));

    // 2. Supabase bulut veritabanına doğrudan yaz (settings.club_announcements)
    if (window.SupabaseDB && typeof window.SupabaseDB.saveAnnouncementsCloud === 'function') {
      const ok = await window.SupabaseDB.saveAnnouncementsCloud(list);
      if (ok) {
        console.log('✅ Duyurular Supabase bulutuna başarıyla kaydedildi!');
        if (typeof showToast === 'function') {
          showToast('✓ Duyuru Supabase bulutuna kaydedildi ve ana sayfaya aktarıldı!', 'success');
        }
      } else {
        console.warn('⚠️ Duyurular Supabase bulutuna yazılamadı, yerel hafızada saklanıyor.');
      }
    }
  },

  renderList() {
    const container = document.getElementById('admin-announcements-list');
    if (!container) return;

    if (!this._cloudLoaded) {
      this.loadFromCloud();
    }

    const list = this.getAnnouncements();

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px dashed var(--border-color); color: #94a3b8;">
          <p style="margin-bottom: 0.75rem;">Henüz bir duyuru bulunmuyor.</p>
          <button class="btn btn-primary" onclick="AnnouncementsAdmin.openModal()">+ Yeni Duyuru Ekle</button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 1.15rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); gap: 1rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 250px;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
            <span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 4px; background: rgba(212,163,115,0.15); color: var(--gold);">${item.tag}</span>
            <span style="font-size: 0.78rem; color: #94a3b8;">${item.date}</span>
          </div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 0.35rem;">${item.title}</h4>
          <p style="font-size: 0.86rem; color: #cbd5e1; line-height: 1.5;">${item.desc}</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" onclick="AnnouncementsAdmin.openModal('${item.id}')" style="font-size: 0.82rem; padding: 0.4rem 0.75rem;">Düzenle</button>
          <button class="btn btn-secondary" onclick="AnnouncementsAdmin.deleteAnnouncement('${item.id}')" style="font-size: 0.82rem; padding: 0.4rem 0.75rem; border-color: rgba(239,68,68,0.4); color: #f87171;">Sil</button>
        </div>
      </div>
    `).join('');
  },

  openModal(id = null) {
    const list = this.getAnnouncements();
    const item = id ? list.find(a => String(a.id) === String(id)) : null;

    document.getElementById('admin-ann-id').value = id || '';
    document.getElementById('admin-ann-modal-title').textContent = id ? 'Duyuruyu Düzenle' : 'Yeni Web Duyurusu Ekle';
    document.getElementById('admin-ann-tag').value = item ? item.tag : 'Önemli';
    document.getElementById('admin-ann-date').value = item ? item.date : new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('admin-ann-title').value = item ? item.title : '';
    document.getElementById('admin-ann-desc').value = item ? item.desc : '';
    document.getElementById('admin-ann-detail').value = item ? (item.detail ? item.detail.replace(/<\/?[^>]+(>|$)/g, '') : '') : '';

    const modal = document.getElementById('admin-announcement-modal');
    if (modal) modal.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('admin-announcement-modal');
    if (modal) modal.classList.remove('active');
  },

  async handleSave(e) {
    e.preventDefault();
    const id = document.getElementById('admin-ann-id').value.trim();
    const tag = document.getElementById('admin-ann-tag').value;
    const date = document.getElementById('admin-ann-date').value.trim();
    const title = document.getElementById('admin-ann-title').value.trim();
    const desc = document.getElementById('admin-ann-desc').value.trim();
    const detailText = document.getElementById('admin-ann-detail').value.trim();
    const detail = detailText ? `<p>${detailText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` : `<p>${desc}</p>`;

    let list = this.getAnnouncements();
    if (id) {
      list = list.map(a => String(a.id) === String(id) ? { ...a, tag, date, title, desc, detail } : a);
    } else {
      list.unshift({
        id: 'ann-' + Date.now(),
        tag,
        date,
        title,
        desc,
        detail
      });
    }

    this.closeModal();
    this.renderList();
    await this.saveAnnouncements(list);
    this.renderList();
  },

  async deleteAnnouncement(id) {
    if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz? Ana sayfadan ve Supabase bulutundan da kaldırılacaktır.')) return;
    let list = this.getAnnouncements();
    list = list.filter(a => String(a.id) !== String(id));
    this.renderList();
    await this.saveAnnouncements(list);
    this.renderList();
  }
};

window.AnnouncementsAdmin = AnnouncementsAdmin;
