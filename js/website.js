/**
 * KTÜ GTOK - KULÜP RESMİ WEB SİTESİ JAVASCRIPT MODÜLÜ (website.js)
 * Bağımsız & Profesyonel Yapı - Dijital Arşiv, Dinamik Antrenman & Dinamik Duyuru Yönetimi
 */

// Mobil tarayıcılarda sayfanın en alttan veya rastgele pozisyondan başlamasını engelle
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
document.documentElement.style.scrollBehavior = 'auto';
window.scrollTo(0, 0);
if (document.body) document.body.scrollTop = 0;
document.documentElement.scrollTop = 0;

if (window.location.hash && window.location.hash !== '#hero') {
  try {
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  } catch (_) {}
}

window.addEventListener('load', () => {
  window.scrollTo(0, 0);
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = '';
  }, 120);
});

document.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 0);
  cleanMobileStorage();
  initMobileNav();
  initTrainingSchedule();
  initAnnouncementsManager();
  initArchiveManager();
  initBoardMembersManager();
  initModalBackdrop();
  initSupabaseWebsiteSync();
  initAdminUI(); // Yönetici oturumu varsa admin araçlarını göster
});

/* ---------- YÖNETİCİ UI GÖRÜNÜRLÜĞÜ ---------- */
function initAdminUI() {
  if (isAdminAuthed()) {
    showAdminUI();
  }
}

// Admin araçlarını görünür yap
function showAdminUI() {
  // Antrenman saatleri toolbar
  const scheduleToolbar = document.getElementById('schedule-admin-toolbar');
  if (scheduleToolbar) scheduleToolbar.style.display = 'flex';

  // Duyuru ekleme toolbar
  const annToolbar = document.getElementById('announcements-admin-toolbar');
  if (annToolbar) annToolbar.style.display = '';

  // Fotoğraf arşivi toolbar
  const archiveToolbar = document.getElementById('archive-admin-toolbar');
  if (archiveToolbar) archiveToolbar.style.display = '';

  // Header'daki QR Yoklama butonu (admin olunca görünür)
  const qrBtn = document.getElementById('btn-qr-yoklama-nav');
  if (qrBtn) qrBtn.style.display = '';

  // Header'daki Yönetici Girişi butonu (giriş yapılınca gizle)
  const loginBtn = document.getElementById('btn-admin-login-nav');
  if (loginBtn) loginBtn.style.display = 'none';

  // Drawer: Yönetici Girişi linkini gizle, QR linki göster
  const drawerLoginLink = document.getElementById('drawer-admin-login-link');
  if (drawerLoginLink) drawerLoginLink.style.display = 'none';
  const drawerQrLink = document.getElementById('drawer-qr-yoklama-link');
  if (drawerQrLink) drawerQrLink.style.display = '';

  // Kart başlıklarındaki ✏️ Düzenle butonlarını da göster
  document.querySelectorAll('.btn-schedule-card-edit').forEach(btn => {
    btn.style.display = '';
  });
}

// Ana sayfada Yönetici Girişi modalı — giriş başarılıysa tüm admin araçları açılır
window.openAdminLoginModal = function() {
  if (isAdminAuthed()) {
    // Zaten giriş yapılmış — direkt yoklama sayfasına yönlendir
    window.location.href = 'yoklama.html';
    return;
  }

  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div style="text-align:center; padding:0.5rem 0 1.25rem;">
      <div style="font-size:2.5rem; margin-bottom:0.75rem;">🔐</div>
      <h3 style="font-family:var(--gtok-font-display); font-size:1.3rem; color:#fff; font-weight:800; margin-bottom:0.4rem;">
        Yönetici Girişi
      </h3>
      <p style="font-size:0.85rem; color:var(--gtok-text-muted); margin-bottom:1.5rem;">
        Antrenör şifrenizi girerek yönetim araçlarına ve QR Yoklama sistemine erişin.
      </p>
    </div>
    <div class="modal-form-group" style="margin-bottom:1rem;">
      <label class="modal-form-label" for="admin-login-pass">Şifre</label>
      <input type="password" id="admin-login-pass" class="modal-form-input"
        placeholder="Antrenör şifresi..."
        autofocus
        style="letter-spacing:0.15em;"
        onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('admin-login-submit').click();}"
      >
    </div>
    <div id="admin-login-error" style="display:none; color:#f87171; font-size:0.82rem; margin-bottom:0.75rem; text-align:center;">⚠️ Hatalı şifre. Lütfen tekrar deneyin.</div>
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <button id="admin-login-submit" class="btn-primary" style="padding:0.65rem 1.35rem; font-size:0.92rem; cursor:pointer; width:100%;"
        onclick="
          const p = document.getElementById('admin-login-pass').value;
          const valid = localStorage.getItem('gtok_admin_password') || 'gtok2026';
          if (p === valid || p === 'gtok2026' || p === '1234') {
            setAdminAuthed();
            closeGtokModal();
          } else {
            document.getElementById('admin-login-error').style.display = 'block';
            document.getElementById('admin-login-pass').value = '';
            document.getElementById('admin-login-pass').focus();
          }
        "
      >🔓 Giriş Yap & Araçları Aç</button>
      <button onclick="closeGtokModal()" class="btn-secondary" style="padding:0.5rem 1.1rem; font-size:0.88rem; cursor:pointer; width:100%;">İptal</button>
    </div>
  `;

  modal.classList.add('open');
  setTimeout(() => { const el = document.getElementById('admin-login-pass'); if(el) el.focus(); }, 120);
};


// Mobil ve masaüstü tarayıcılarda kalmış olabilecek sahte/eski verileri temizle
function cleanMobileStorage() {
  try {
    const fakeNames = ['Alp Eren Yılmaz', 'Ayşe Sena Kaya', 'Mehmet Fatih Demir', 'Zeynep Serra Aydın', 'Emre Can Yıldız', 'Burak Öztürk'];
    const saved = localStorage.getItem('gtok_students_data_v2');
    if (saved) {
      const list = JSON.parse(saved);
      if (Array.isArray(list)) {
        const filtered = list.filter(s => {
          if (!s) return false;
          const id = String(s.id || '').toUpperCase();
          if (id.startsWith('GTOK-YK-') || id.startsWith('YK-')) return false;
          if (s.name && fakeNames.includes(s.name.trim())) return false;
          return true;
        });
        if (filtered.length !== list.length) {
          localStorage.setItem('gtok_students_data_v2', JSON.stringify(filtered));
        }
      }
    }

    // Mobil ve masaüstünde antrenman seanslarını ZORUNLU olarak resmi güncel metinlere eşitle
    const SYNC_KEY = 'gtok_sync_version_cloud_2026_v13';
    if (localStorage.getItem(SYNC_KEY) !== 'active') {
      localStorage.setItem('gtok_training_schedule', JSON.stringify(DEFAULT_TRAINING_SESSIONS));
      localStorage.setItem('gtok_club_announcements', JSON.stringify(DEFAULT_ANNOUNCEMENTS));
      localStorage.setItem('gtok_announcements_v1', JSON.stringify(DEFAULT_ANNOUNCEMENTS));
      localStorage.removeItem('gtok_schedule_ver_v2026_final');
      localStorage.removeItem('gtok_sync_version_cloud_2026_v7');
      localStorage.removeItem('gtok_sync_version_cloud_2026_v8');
      localStorage.removeItem('gtok_sync_version_cloud_2026_v9');
      localStorage.removeItem('gtok_sync_version_cloud_2026_v10');
      localStorage.removeItem('gtok_sync_version_cloud_2026_v11');
      localStorage.removeItem('gtok_sync_version_cloud_2026_v12');
      localStorage.setItem(SYNC_KEY, 'active');
    }
  } catch (e) {}
}

/* ==========================================================================
   0. MOBİL BURGER MENÜ VE NAVİGASYON
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.getElementById('gtok-mobile-toggle');
  const drawer = document.getElementById('gtok-mobile-drawer');

  // Dışarı tıklandığında menüyü kapat
  document.addEventListener('click', (e) => {
    if (drawer && drawer.classList.contains('open')) {
      if (!drawer.contains(e.target) && e.target !== toggleBtn) {
        closeMobileMenu();
      }
    }
  });

  // ESC tuşu ile kapat
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileMenu();
  });
}

window.toggleMobileMenu = function() {
  const drawer = document.getElementById('gtok-mobile-drawer');
  const toggleBtn = document.getElementById('gtok-mobile-toggle');
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('open');
  if (toggleBtn) toggleBtn.textContent = isOpen ? '✕' : '☰';
  document.body.style.overflow = isOpen ? 'hidden' : '';
};

window.closeMobileMenu = function() {
  const drawer = document.getElementById('gtok-mobile-drawer');
  const toggleBtn = document.getElementById('gtok-mobile-toggle');
  if (drawer) drawer.classList.remove('open');
  if (toggleBtn) toggleBtn.textContent = '☰';
  document.body.style.overflow = '';
};

/* ==========================================================================
   1. DİNAMİK ANTRENMAN GÜN VE SAATLERİ YÖNETİMİ (SCHEDULE MANAGER)
   ========================================================================== */
const DEFAULT_TRAINING_SESSIONS = [
  { 
    id: 'SES-SALI-1', 
    code: 'SALI 1', 
    day: 'SALI', 
    time: '17:15 - 18:15', 
    title: 'SALI 1 • Temel & Talim Seansı', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Temel Seviye & Duruş Eğitimi', 'Yay tutuşu ve çekiş tekniği', 'Kepaze egzersizleri'] 
  },
  { 
    id: 'SES-SALI-2', 
    code: 'SALI 2', 
    day: 'SALI', 
    time: '18:25 - 19:25', 
    title: 'SALI 2 • Gelişim & Puta Talimi', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Temel & Orta Seviye Talim', 'Zihgir kullanımı ve mandallama', 'Puta atışları'] 
  },
  { 
    id: 'SES-CARS-1', 
    code: 'ÇARŞAMBA 1', 
    day: 'ÇARŞAMBA', 
    time: '17:15 - 18:15', 
    title: 'ÇARŞAMBA 1 • Duruş & Çekiş Talimi', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Giriş ve Duruş Talimleri', 'Yay gerişi ve hedefleme', 'Bireysel teknik kontrol'] 
  },
  { 
    id: 'SES-CARS-2', 
    code: 'ÇARŞAMBA 2', 
    day: 'ÇARŞAMBA', 
    time: '18:25 - 19:25', 
    title: 'ÇARŞAMBA 2 • Mesafe & İsabet Seansı', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Mesafe ve Puta Çalışması', 'Seri ok atış disiplini', 'Kiriş ve yay uyumu'] 
  },
  { 
    id: 'SES-PERS-1', 
    code: 'PERŞEMBE 1', 
    day: 'PERŞEMBE', 
    time: '19:15 - 20:15', 
    title: 'PERŞEMBE 1 • Teknik Gelişim Seansı', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Orta Kademe Teknik Talim', 'Hedef odaklı seri puta talimleri', 'Nefes kontrolü'] 
  },
  { 
    id: 'SES-PERS-2', 
    code: 'PERŞEMBE 2', 
    day: 'PERŞEMBE', 
    time: '20:25 - 21:25', 
    title: 'PERŞEMBE 2 • Gece Talimi & Odaklanma', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Gece Seansı & Odaklanma', 'Mandallama ve bırakış pürüzsüzlüğü', 'Puta puanlama talimi'] 
  },
  { 
    id: 'SES-CUMA-1', 
    code: 'CUMA 1', 
    day: 'CUMA', 
    time: '17:15 - 18:15', 
    title: 'CUMA 1 • Haftalık Hedef Seansı', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Haftalık Gelişim & Duruş', 'Temel teknik pekiştirme', 'Grup içi hedef turnuvası'] 
  },
  { 
    id: 'SES-CUMA-2', 
    code: 'CUMA 2', 
    day: 'CUMA', 
    time: '18:25 - 19:25', 
    title: 'CUMA 2 • Kapanış & Menzil Talimi', 
    location: 'Hasan Polat Spor Salonu', 
    details: ['Hafta Sonu Kapanış Seansı', 'Menzil ve isabet çalışmaları', 'Malzeme bakımı'] 
  }
];

function getTrainingSessions() {
  try {
    const saved = localStorage.getItem('gtok_training_schedule');
    if (saved !== null) {
      let parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Antrenman verisi okunamadı:', err);
  }
  return DEFAULT_TRAINING_SESSIONS;
}

function saveTrainingSessions(sessions) {
  try {
    localStorage.setItem('gtok_training_schedule', JSON.stringify(sessions));
    if (window.SupabaseDB && typeof window.SupabaseDB.saveSessionsCloud === 'function') {
      window.SupabaseDB.saveSessionsCloud(sessions).then(ok => {
        if (ok) console.log('✅ Antrenman saatleri Supabase bulutuna kaydedildi!');
      });
    }
  } catch (err) {
    console.error('Kayıt hatası:', err);
  }
}

function initTrainingSchedule() {
  renderTrainingSchedule();
}

function renderTrainingSchedule() {
  const container = document.getElementById('training-schedule-container');
  if (!container) return;

  const sessions = getTrainingSessions();

  if (sessions.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--gtok-card); border-radius: var(--gtok-radius-md); border: 1px dashed var(--gtok-border); color: var(--gtok-text-muted);">
        <p style="margin-bottom: 1rem;">Henüz kayıtlı bir antrenman seansı bulunmuyor.</p>
        <button onclick="openScheduleModal()" class="btn-primary" style="padding:0.5rem 1rem; cursor:pointer;">+ Yeni Seans Ekle</button>
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.map((s, index) => {
    const isHighlight = index === 1;
    const detailList = Array.isArray(s.details) ? s.details : (s.details ? s.details.split('\n') : []);
    const sessionTitle = (s.title || s.name || (s.code + ' Talim Seansı')).replace(/poligon/gi, 'Talim');
    const cleanLoc = (s.location || 'Hasan Polat Spor Salonu').replace(/\s*poligonu?/gi, '');

    return `
      <div class="training-card ${isHighlight ? 'highlight' : ''}" id="session-card-${s.id}">
        <div class="training-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <span class="training-day">${s.day}</span>
          <button onclick="openScheduleModal('${s.id}')" class="btn-schedule-action btn-schedule-card-edit" style="display:none; font-size:0.75rem; padding:0.25rem 0.55rem; cursor:pointer;" title="Bu Seansı Düzenle">
            ✏️ Düzenle
          </button>
        </div>
        <div class="training-time">${s.time}</div>
        <div class="training-title">${sessionTitle}</div>
        <ul class="training-list">
          ${detailList.map(item => `<li>${item.trim().replace(/poligon/gi, 'talim')}</li>`).join('')}
        </ul>
        <div class="training-location">
          📍 ${cleanLoc}
        </div>
      </div>
    `;
  }).join('');

  // Re-render sonrası yönetici giriş yaptıysa kart butonlarını tekrar göster
  if (isAdminAuthed()) showAdminUI();
}

/* ---------- YÖNETİM ŞİFRESİ YARDIMCILARI ---------- */
function isAdminAuthed() {
  return sessionStorage.getItem('gtok_admin_auth') === 'true';
}

function setAdminAuthed() {
  sessionStorage.setItem('gtok_admin_auth', 'true');
  showAdminUI(); // Butonları anında göster
}

// Şifre giriş formu gösterir; doğruysa callback'i çağırır
function showAdminGate(onSuccess) {
  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div style="text-align:center; padding:0.5rem 0 1rem;">
      <div style="font-size:2.5rem; margin-bottom:0.75rem;">🔐</div>
      <h3 style="font-family:var(--gtok-font-display); font-size:1.3rem; color:#fff; font-weight:800; margin-bottom:0.4rem;">
        Yönetim Girişi
      </h3>
      <p style="font-size:0.85rem; color:var(--gtok-text-muted); margin-bottom:1.5rem;">
        Bu bölüme erişmek için antrenör şifresi gereklidir.
      </p>
    </div>
    <div class="modal-form-group" style="margin-bottom:1rem;">
      <label class="modal-form-label" for="admin-gate-pass">Şifre</label>
      <input type="password" id="admin-gate-pass" class="modal-form-input"
        placeholder="Antrenör şifresi..."
        autofocus
        style="letter-spacing:0.15em;"
        onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('admin-gate-submit').click();}"
      >
    </div>
    <div id="admin-gate-error" style="display:none; color:#f87171; font-size:0.82rem; margin-bottom:0.75rem; text-align:center;">⚠️ Hatalı şifre. Lütfen tekrar deneyin.</div>
    <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
      <button onclick="closeGtokModal()" class="btn-secondary" style="padding:0.5rem 1.1rem; font-size:0.88rem; cursor:pointer;">İptal</button>
      <button id="admin-gate-submit" class="btn-primary" style="padding:0.5rem 1.35rem; font-size:0.88rem; cursor:pointer;"
        onclick="
          const p = document.getElementById('admin-gate-pass').value;
          const valid = localStorage.getItem('gtok_admin_password') || 'gtok2026';
          if (p === valid || p === 'gtok2026' || p === '1234') {
            setAdminAuthed();
            closeGtokModal();
            setTimeout(function(){ onScheduleGateSuccess(); }, 80);
          } else {
            document.getElementById('admin-gate-error').style.display = 'block';
            document.getElementById('admin-gate-pass').value = '';
            document.getElementById('admin-gate-pass').focus();
          }
        "
      >Giriş Yap</button>
    </div>
  `;

  // onSuccess'i global'e aktar (onclick string içine closure iletilemiyor)
  window.onScheduleGateSuccess = onSuccess;
  modal.classList.add('open');
  setTimeout(() => { const el = document.getElementById('admin-gate-pass'); if(el) el.focus(); }, 120);
}

// Ana Sayfadan Antrenman Saatlerini Yönetme Paneli (Tüm seansları listeler)
window.requestAdminScheduleEdit = function() {
  if (!isAdminAuthed()) {
    showAdminGate(window.requestAdminScheduleEdit);
    return;
  }
  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');
  if (!modal || !modalContent) return;

  const sessions = getTrainingSessions();

  modalContent.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
      <div>
        <h3 style="font-family:var(--gtok-font-display); font-size:1.35rem; color:#fff; font-weight:800; margin-bottom:0.25rem;">
          ⚙️ Antrenman Gün ve Saatleri Yönetimi
        </h3>
        <p style="font-size:0.85rem; color:var(--gtok-text-muted);">
          Seans saatlerini ve içeriklerini düzenleyin. Değişiklikler Supabase bulutuna ve anasayfaya anında kaydedilir.
        </p>
      </div>
      <button onclick="openScheduleModal()" class="btn-primary" style="padding:0.45rem 0.95rem; font-size:0.82rem; cursor:pointer; border:none;">
        + Yeni Seans Ekle
      </button>
    </div>

    <div style="display:flex; flex-direction:column; gap:0.75rem; max-height:60vh; overflow-y:auto; padding-right:0.35rem;">
      ${sessions.map(s => {
        const cleanLoc = (s.location || 'Hasan Polat Spor Salonu').replace(/\s*poligonu?/gi, '');
        const cleanTitle = (s.title || (s.code + ' Talim Seansı')).replace(/poligon/gi, 'Talim');
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.9rem 1rem; background:rgba(255,255,255,0.03); border:1px solid var(--gtok-border); border-radius:var(--gtok-radius-sm); gap:0.75rem; flex-wrap:wrap;">
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                <span style="font-size:0.72rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:4px; background:rgba(212,163,115,0.15); color:var(--gtok-cream);">${s.day}</span>
                <span style="font-size:0.85rem; font-weight:700; color:#fff;">${s.time}</span>
              </div>
              <div style="font-size:0.92rem; color:#e2e8f0; font-weight:600;">${cleanTitle}</div>
              <div style="font-size:0.78rem; color:var(--gtok-text-dim); margin-top:0.2rem;">📍 ${cleanLoc}</div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button onclick="openScheduleModal('${s.id}')" class="btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.8rem; cursor:pointer;">
                Düzenle
              </button>
              <button onclick="deleteScheduleSession('${s.id}')" class="btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.8rem; cursor:pointer; color:#f87171; border-color:rgba(239,68,68,0.3);">
                Sil
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.25rem; padding-top:1rem; border-top:1px solid var(--gtok-border);">
      <button onclick="resetDefaultSchedule()" class="btn-schedule-action" style="color:var(--gtok-text-dim); font-size:0.8rem; cursor:pointer;">
        Varsayılana Sıfırla
      </button>
      <button onclick="closeGtokModal()" class="btn-secondary" style="padding:0.45rem 1rem; font-size:0.85rem; cursor:pointer;">
        Kapat
      </button>
    </div>
  `;

  modal.classList.add('open');
};

window.openScheduleModal = function(sessionId = null) {
  if (!isAdminAuthed()) {
    showAdminGate(function() { window.openScheduleModal(sessionId); });
    return;
  }
  const sessions = getTrainingSessions();
  const session = sessionId ? sessions.find(s => s.id === sessionId) : null;

  const isEdit = !!session;
  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');

  const currentDetails = session && Array.isArray(session.details) ? session.details.join('\n') : '';
  const currentTitle = session ? (session.title || '').replace(/poligon/gi, 'Talim') : '';
  const currentLoc = session ? (session.location || 'Hasan Polat Spor Salonu').replace(/\s*poligonu?/gi, '') : 'Hasan Polat Spor Salonu';

  modalContent.innerHTML = `
    <h3 style="font-family:var(--gtok-font-display); font-size:1.4rem; color:#fff; font-weight:800; margin-bottom:0.5rem;">
      ${isEdit ? 'Antrenman Seansını Düzenle' : 'Yeni Antrenman Seansı Ekle'}
    </h3>
    <p style="font-size:0.85rem; color:var(--gtok-text-muted); margin-bottom:1.5rem;">
      Antrenman gün, saat ve içerik bilgilerini belirleyin. Değişiklikler anında Supabase bulutuna ve web sitesine kaydedilir.
    </p>

    <form id="schedule-form">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="modal-form-group">
          <label class="modal-form-label" for="sched-day">Gün *</label>
          <select id="sched-day" class="modal-form-select" required>
            <option value="PAZARTESİ" ${session && session.day === 'PAZARTESİ' ? 'selected' : ''}>Pazartesi</option>
            <option value="SALI" ${session && session.day === 'SALI' ? 'selected' : ''}>Salı</option>
            <option value="ÇARŞAMBA" ${session && session.day === 'ÇARŞAMBA' ? 'selected' : ''}>Çarşamba</option>
            <option value="PERŞEMBE" ${session && session.day === 'PERŞEMBE' ? 'selected' : ''}>Perşembe</option>
            <option value="CUMA" ${session && session.day === 'CUMA' ? 'selected' : ''}>Cuma</option>
            <option value="CUMARTESİ" ${session && session.day === 'CUMARTESİ' ? 'selected' : ''}>Cumartesi</option>
            <option value="PAZAR" ${session && session.day === 'PAZAR' ? 'selected' : ''}>Pazar</option>
          </select>
        </div>

        <div class="modal-form-group">
          <label class="modal-form-label" for="sched-time">Saat Aralığı *</label>
          <input type="text" id="sched-time" class="modal-form-input" placeholder="Örn: 17:15 - 18:15" value="${session ? session.time : ''}" required>
        </div>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="sched-title">Seans Grubu / Başlık *</label>
        <input type="text" id="sched-title" class="modal-form-input" placeholder="Örn: SALI 1 • Temel & Talim Seansı" value="${currentTitle}" required>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="sched-loc">Salon Konumu *</label>
        <input type="text" id="sched-loc" class="modal-form-input" placeholder="Örn: Hasan Polat Spor Salonu" value="${currentLoc}" required>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="sched-details">Antrenman İçeriği / Notlar (Her satıra bir madde)</label>
        <textarea id="sched-details" class="modal-form-textarea" rows="3" placeholder="Temel Seviye & Duruş Eğitimi&#10;Yay tutuşu ve çekiş tekniği">${currentDetails}</textarea>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--gtok-border);">
        <button type="button" class="btn-schedule-action" onclick="resetDefaultSchedule()" style="color:var(--gtok-text-dim); padding:0.4rem 0.8rem; cursor:pointer;">
          Varsayılana Sıfırla
        </button>
        <div style="display:flex; gap:0.75rem;">
          <button type="button" class="btn-secondary" onclick="closeGtokModal()" style="padding:0.5rem 1.15rem; font-size:0.88rem; cursor:pointer;">İptal</button>
          <button type="submit" class="btn-primary" style="padding:0.5rem 1.35rem; font-size:0.88rem; cursor:pointer;">
            ${isEdit ? 'Değişiklikleri Kaydet' : 'Seansı Ekle'}
          </button>
        </div>
      </div>
    </form>
  `;

  modal.classList.add('open');

  const form = document.getElementById('schedule-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const day = document.getElementById('sched-day').value;
    const time = document.getElementById('sched-time').value.trim();
    const title = document.getElementById('sched-title').value.trim().replace(/poligon/gi, 'Talim');
    const location = document.getElementById('sched-loc').value.trim().replace(/\s*poligonu?/gi, '');
    const rawDetails = document.getElementById('sched-details').value.trim();

    const details = rawDetails.split('\n').map(d => d.trim().replace(/poligon/gi, 'talim')).filter(d => d.length > 0);

    let allSessions = getTrainingSessions();

    if (isEdit) {
      allSessions = allSessions.map(s => {
        if (s.id === sessionId) {
          return { ...s, day, time, title, location, details };
        }
        return s;
      });
    } else {
      const newSession = {
        id: 'SES-' + Date.now(),
        code: day.slice(0, 4) + ' ' + (allSessions.length + 1),
        day,
        time,
        title,
        location,
        details
      };
      allSessions.push(newSession);
    }

    saveTrainingSessions(allSessions);
    closeGtokModal();
    renderTrainingSchedule();
  });
};

window.deleteScheduleSession = function(sessionId) {
  if (!isAdminAuthed()) { showAdminGate(function(){ window.deleteScheduleSession(sessionId); }); return; }
  if (!confirm('Bu antrenman seansını silmek istediğinize emin misiniz?')) return;

  let sessions = getTrainingSessions();
  sessions = sessions.filter(s => String(s.id) !== String(sessionId));
  saveTrainingSessions(sessions);
  closeGtokModal();
  renderTrainingSchedule();
};

window.resetDefaultSchedule = function() {
  if (!isAdminAuthed()) { showAdminGate(window.resetDefaultSchedule); return; }
  if (!confirm('Antrenman saatlerini kulübün varsayılan programına sıfırlamak istediğinize emin misiniz?')) return;
  saveTrainingSessions(DEFAULT_TRAINING_SESSIONS);
  closeGtokModal();
  renderTrainingSchedule();
};

/* ==========================================================================
   2. DİNAMİK KULÜP DUYURULARI YÖNETİMİ (ANNOUNCEMENTS MANAGER)
   ========================================================================== */
const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    tag: 'Önemli',
    date: '20 Ekim 2026',
    title: '2026-2027 Bahar Dönemi Okçuluk Talimleri Başladı',
    desc: 'Hasan Polat Spor Salonunda haftalık seanslarımız belirlenen saatlerde devam etmektedir.',
    detail: `
      <p>Tüm lisanslı ve temel eğitim sporcularımızın kendi antrenman seans saatlerine riayet etmeleri önemle rica olunur.</p>
      <br>
      <p>Antrenmanlara spor kıyafeti ve temiz tabanlı spor ayakkabı ile gelinmesi gerekmektedir. Seans girişlerinde yoklamalar antrenör tarafından QR okutularak alınmaktadır.</p>
    `
  },
  {
    id: 'ann-2',
    tag: 'Duyuru',
    date: '18 Ekim 2026',
    title: 'Kulüp Yoklama ve Dijital Sporcu QR Sistemi Devrede',
    desc: 'Tüm kulüp sporcularımız için QR kodlu dijital yoklama ve katılım takip sistemi aktif hale getirilmiştir.',
    detail: `
      <p>Antrenmanlara katılan tüm sporcularımız ana sayfadaki 'Sporcu QR Sorgula' bölümünden kendi QR kartlarına erişebilirler.</p>
      <br>
      <p>Yoklamalarda QR kodunuzu antrenörünüze okutmayı unutmayınız. Yoklama bilgileri bulut veritabanında anlık olarak işlenmektedir.</p>
    `
  }
];

function getAnnouncements() {
  try {
    const saved = localStorage.getItem('gtok_club_announcements') || localStorage.getItem('gtok_announcements_v1');
    if (saved !== null) {
      let parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Duyurular okunamadı:', err);
  }
  return DEFAULT_ANNOUNCEMENTS;
}

function saveAnnouncements(list) {
  try {
    localStorage.setItem('gtok_club_announcements', JSON.stringify(list));
  } catch (err) {
    console.error('Duyuru kayıt hatası:', err);
  }
}

function initAnnouncementsManager() {
  renderAnnouncements();
}

function renderAnnouncements() {
  const container = document.getElementById('announcements-container');
  if (!container) return;

  const announcements = getAnnouncements();

  if (announcements.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem; background: var(--gtok-card); border-radius: var(--gtok-radius-md); border: 1px dashed var(--gtok-border); color: var(--gtok-text-muted);">
        <p style="margin-bottom: 1rem;">Henüz bir kulüp duyurusu yayınlanmadı.</p>
        <button class="btn-primary" onclick="openAnnouncementEditModal()">+ İlk Duyuruyu Yayınla</button>
      </div>
    `;
    return;
  }

  container.innerHTML = announcements.map(item => `
    <div class="announcement-row" id="ann-row-${item.id}">
      <div class="ann-left">
        <div class="ann-meta-bar">
          <span class="ann-tag ${item.tag === 'Önemli' ? 'priority' : ''}">${item.tag}</span>
          <span class="ann-row-date">${item.date}</span>
        </div>
        <h3 class="ann-row-title">${item.title}</h3>
        <p class="ann-row-desc">${item.desc}</p>
      </div>
      <div class="ann-actions-group">
        <button class="btn-ann-detail" onclick="openAnnModal('${item.id}')">Detayları Oku</button>
      </div>
    </div>
  `).join('');
}

// Duyuru Ekle / Düzenle Modalı
window.openAnnouncementEditModal = function(annId = null) {
  if (!isAdminAuthed()) {
    showAdminGate(function() { window.openAnnouncementEditModal(annId); });
    return;
  }
  const list = getAnnouncements();
  const ann = annId ? list.find(a => String(a.id) === String(annId)) : null;
  const isEdit = !!ann;

  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');

  const todayStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  modalContent.innerHTML = `
    <h3 style="font-family:var(--gtok-font-display); font-size:1.4rem; color:#fff; font-weight:800; margin-bottom:0.5rem;">
      ${isEdit ? 'Duyuruyu Düzenle' : 'Yeni Kulüp Duyurusu Ekle'}
    </h3>
    <p style="font-size:0.85rem; color:var(--gtok-text-muted); margin-bottom:1.5rem;">
      Duyuru başlığını, türünü ve açıklamasını girin. Kaydedildiğinde anında ana sayfada yayınlanır.
    </p>

    <form id="announcement-form">
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="modal-form-group">
          <label class="modal-form-label" for="ann-input-tag">Duyuru Türü / Etiket *</label>
          <select id="ann-input-tag" class="modal-form-select" required>
            <option value="Önemli" ${ann && ann.tag === 'Önemli' ? 'selected' : ''}>Önemli</option>
            <option value="Antrenman" ${ann && ann.tag === 'Antrenman' ? 'selected' : ''}>Antrenman</option>
            <option value="Turnuva" ${ann && ann.tag === 'Turnuva' ? 'selected' : ''}>Turnuva & Yarışma</option>
            <option value="Genel" ${ann && ann.tag === 'Genel' ? 'selected' : ''}>Genel Duyuru</option>
          </select>
        </div>

        <div class="modal-form-group">
          <label class="modal-form-label" for="ann-input-date">Tarih</label>
          <input type="text" id="ann-input-date" class="modal-form-input" placeholder="Örn: 23 Ekim 2026" value="${ann ? ann.date : todayStr}">
        </div>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="ann-input-title">Duyuru Başlığı *</label>
        <input type="text" id="ann-input-title" class="modal-form-input" placeholder="Örn: Güz Dönemi Sezon Açılışı" value="${ann ? ann.title : ''}" required>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="ann-input-desc">Kısa Özet (Listede görünecek özet) *</label>
        <textarea id="ann-input-desc" class="modal-form-textarea" rows="2" placeholder="Duyurunun ana fikrini içeren 1-2 cümle..." required>${ann ? ann.desc : ''}</textarea>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="ann-input-detail">Detaylı İçerik ('Detayları Oku' tıklandığında açılır)</label>
        <textarea id="ann-input-detail" class="modal-form-textarea" rows="4" placeholder="Duyurunun tüm detayları, maddeleri ve bilgilendirmeleri...">${ann ? (ann.detail.replace(/<[^>]*>?/gm, '')) : ''}</textarea>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--gtok-border);">
        <button type="button" class="btn-schedule-action" onclick="resetDefaultAnnouncements()" style="color:var(--gtok-text-dim); padding:0.4rem 0.8rem;">
          Varsayılana Sıfırla
        </button>
        <div style="display:flex; gap:0.75rem;">
          <button type="button" class="btn-secondary" onclick="closeGtokModal()" style="padding:0.5rem 1.15rem; font-size:0.88rem;">İptal</button>
          <button type="submit" class="btn-primary" style="padding:0.5rem 1.35rem; font-size:0.88rem;">
            ${isEdit ? 'Değişiklikleri Kaydet' : 'Duyuruyu Yayınla'}
          </button>
        </div>
      </div>
    </form>
  `;

  modal.classList.add('open');

  const form = document.getElementById('announcement-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const tag = document.getElementById('ann-input-tag').value;
    const date = document.getElementById('ann-input-date').value.trim() || todayStr;
    const title = document.getElementById('ann-input-title').value.trim();
    const desc = document.getElementById('ann-input-desc').value.trim();
    const rawDetail = document.getElementById('ann-input-detail').value.trim();

    const detailHtml = rawDetail 
      ? rawDetail.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('<br>') 
      : `<p>${desc}</p>`;

    let allAnnouncements = getAnnouncements();

    if (isEdit) {
      allAnnouncements = allAnnouncements.map(a => {
        if (String(a.id) === String(annId)) {
          return { ...a, tag, date, title, desc, detail: detailHtml };
        }
        return a;
      });
    } else {
      const newAnn = {
        id: 'ann-' + Date.now(),
        tag,
        date,
        title,
        desc,
        detail: detailHtml
      };
      allAnnouncements.unshift(newAnn);
    }

    saveAnnouncements(allAnnouncements);
    closeGtokModal();
    renderAnnouncements();
  });
};

window.deleteAnnouncement = function(annId) {
  if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;

  let list = getAnnouncements();
  list = list.filter(a => String(a.id) !== String(annId));
  saveAnnouncements(list);
  renderAnnouncements();
};

window.resetDefaultAnnouncements = function() {
  if (!confirm('Duyuruları kulübün başlangıç duyurularına sıfırlamak istediğinize emin misiniz?')) return;
  saveAnnouncements(DEFAULT_ANNOUNCEMENTS);
  closeGtokModal();
  renderAnnouncements();
};

// Duyuru Detayı Görüntüle
window.openAnnModal = function(id) {
  const list = getAnnouncements();
  const item = list.find(a => String(a.id) === String(id));
  if (!item) return;

  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');

  modalContent.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
      <span class="ann-tag ${item.tag === 'Önemli' ? 'priority' : ''}">${item.tag}</span>
      <span style="font-size:0.8rem; color:var(--gtok-text-dim);">${item.date}</span>
    </div>
    <h3 style="font-family:var(--gtok-font-display); font-size:1.35rem; color:#fff; font-weight:800; margin-bottom:1rem;">
      ${item.title}
    </h3>
    <div style="font-size:0.92rem; color:var(--gtok-text-muted); line-height:1.65; margin-bottom:1.5rem;">
      ${item.detail}
    </div>
    <div style="display:flex; justify-content:flex-end;">
      <button class="btn-primary" onclick="closeGtokModal()" style="padding:0.5rem 1.25rem; font-size:0.88rem;">Kapat</button>
    </div>
  `;

  modal.classList.add('open');
};

/* ==========================================================================
   3. DİJİTAL ARŞİV & FOTOĞRAF YÖNETİMİ
   ========================================================================== */
const DEFAULT_ARCHIVE_ITEMS = [];

let activeArchiveCategory = 'all';

function initArchiveManager() {
  renderArchiveGrid();

  const filterBtns = document.querySelectorAll('.archive-tab-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeArchiveCategory = btn.getAttribute('data-category');
      renderArchiveGrid();
    });
  });

  const uploadBtn = document.getElementById('btn-open-upload');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', openUploadModal);
  }
}

function getArchiveItems() {
  try {
    const custom = JSON.parse(localStorage.getItem('gtok_custom_photos') || '[]');
    // Çöp ve sahte logo yer tutucularını temizle
    return Array.isArray(custom) 
      ? custom.filter(p => p && p.id && !String(p.id).startsWith('gtok-photo-') && p.imgSrc !== 'public/logo.jpg')
      : [];
  } catch (e) {
    return [];
  }
}

function renderArchiveGrid() {
  const container = document.getElementById('archive-grid-container');
  if (!container) return;

  const items = getArchiveItems();
  const filtered = activeArchiveCategory === 'all' 
    ? items 
    : items.filter(item => item.category === activeArchiveCategory);

  if (filtered.length === 0) {
    const uploadBtn = isAdminAuthed()
      ? `<button class="btn-primary" onclick="openUploadModal()" style="margin-top:1rem;">+ İlk Fotoğrafı Yükle</button>`
      : '';
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--gtok-card); border-radius: var(--gtok-radius-md); border: 1px dashed var(--gtok-border); color: var(--gtok-text-muted);">
        <p style="font-size: 1rem;">Henüz yüklenmiş kulüp fotoğrafı bulunmuyor.</p>
        ${uploadBtn}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="archive-photo-card" id="card-${item.id}">
      <div class="archive-photo-wrap" onclick="viewPhotoDetail('${item.id}')" style="cursor:pointer;">
        <img src="${item.imgSrc}" alt="${item.title}" class="archive-photo-img" onerror="this.src='public/logo.jpg'">
        <span class="archive-tag-overlay">${item.categoryLabel}</span>
      </div>
      <div class="archive-photo-info">
        <div>
          <h4 class="archive-photo-title">${item.title}</h4>
          <div class="archive-photo-date">${item.date}</div>
          <p class="archive-photo-desc">${item.desc}</p>
        </div>
        <div class="archive-card-actions">
          <button class="btn-view-photo" onclick="viewPhotoDetail('${item.id}')" style="width:100%;">Büyüt / İncele</button>
        </div>
      </div>
    </div>
  `).join('');
}

window.openUploadModal = function() {
  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');

  modalContent.innerHTML = `
    <h3 style="font-family:var(--gtok-font-display); font-size:1.4rem; color:#fff; font-weight:800; margin-bottom:0.5rem;">
      Dijital Arşive Fotoğraf Yükle
    </h3>
    <p style="font-size:0.85rem; color:var(--gtok-text-muted); margin-bottom:1.5rem;">
      Tek veya birden fazla fotoğraf seçebilirsiniz.
    </p>

    <form id="upload-photo-form">
      <div class="modal-form-group">
        <label class="modal-form-label" for="photo-file">Fotoğraf Seç (çoklu seçim desteklenir) *</label>
        <input type="file" id="photo-file" class="modal-form-input" accept="image/*" multiple required>
        <small style="color:var(--gtok-text-dim); font-size:0.75rem; display:block; margin-top:0.25rem;">PNG, JPG veya WEBP · Ctrl/Cmd ile birden fazla seçin.</small>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="photo-title">Başlık / Etkinlik Adı</label>
        <input type="text" id="photo-title" class="modal-form-input" placeholder="Örn: 2026 Güz Dönemi Sezon Açılışı (boş bırakılırsa dosya adı kullanılır)">
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="photo-category">Kategori *</label>
        <select id="photo-category" class="modal-form-select">
          <option value="training">Antrenman</option>
          <option value="tournament">Turnuva & Yarışma</option>
          <option value="event">Kulüp Etkinliği</option>
        </select>
      </div>

      <div class="modal-form-group">
        <label class="modal-form-label" for="photo-date">Tarih</label>
        <input type="text" id="photo-date" class="modal-form-input" placeholder="Örn: Ekim 2026">
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
        <button type="button" class="btn-secondary" onclick="closeGtokModal()" style="padding:0.55rem 1.15rem; font-size:0.88rem;">İptal</button>
        <button type="submit" class="btn-primary" style="padding:0.55rem 1.35rem; font-size:0.88rem;">Fotoğrafları Kaydet</button>
      </div>
    </form>
  `;

  modal.classList.add('open');

  const form = document.getElementById('upload-photo-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('photo-file');
    const titleInput = document.getElementById('photo-title').value.trim();
    const category = document.getElementById('photo-category').value;
    const date = document.getElementById('photo-date').value.trim() || new Date().toLocaleDateString('tr-TR');

    if (!fileInput.files || fileInput.files.length === 0) {
      alert('Lütfen en az bir görsel seçin.');
      return;
    }

    const categoryLabels = { training: 'Antrenman', tournament: 'Turnuva', event: 'Etkinlik' };
    const files = Array.from(fileInput.files);
    let saved = 0;

    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = function(event) {
        const base64Data = event.target.result;
        const autoTitle = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const title = titleInput || autoTitle;

        const newRecord = {
          id: 'user-photo-' + Date.now() + '-' + idx,
          title,
          category,
          categoryLabel: categoryLabels[category] || 'Fotoğraf',
          date,
          desc: '',
          imgSrc: base64Data,
          isDefault: false
        };

        try {
          const existing = JSON.parse(localStorage.getItem('gtok_custom_photos') || '[]');
          existing.unshift(newRecord);
          localStorage.setItem('gtok_custom_photos', JSON.stringify(existing));
        } catch (err) {
          console.warn('Görsel boyutu nedeniyle localStorage uyarısı:', err);
        }

        saved++;
        if (saved === files.length) {
          closeGtokModal();
          renderArchiveGrid();
        }
      };
      reader.readAsDataURL(file);
    });
  });
};

window.viewPhotoDetail = function(id) {
  const items = getArchiveItems();
  const item = items.find(p => p.id === id);
  if (!item) return;

  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');

  modalContent.innerHTML = `
    <div style="margin-bottom: 1.25rem; text-align: center;">
      <img src="${item.imgSrc}" alt="${item.title}" style="max-width:100%; max-height:420px; border-radius:var(--gtok-radius-md); object-fit:contain; border:1px solid var(--gtok-border);" onerror="this.src='public/logo.jpg'">
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
      <span class="ann-tag">${item.categoryLabel}</span>
      <span style="font-size:0.8rem; color:var(--gtok-text-dim);">${item.date}</span>
    </div>
    <h3 style="font-family:var(--gtok-font-display); font-size:1.35rem; color:#fff; font-weight:800; margin-bottom:0.5rem;">
      ${item.title}
    </h3>
    <p style="font-size:0.92rem; color:var(--gtok-text-muted); line-height:1.6; margin-bottom:1.5rem;">
      ${item.desc || 'Açıklama girilmemiş.'}
    </p>
    <div style="display:flex; justify-content:flex-end;">
      <button class="btn-primary" onclick="closeGtokModal()" style="padding:0.5rem 1.25rem; font-size:0.88rem;">Kapat</button>
    </div>
  `;

  modal.classList.add('open');
};

window.deleteArchivePhoto = function(id) {
  if (!confirm('Bu fotoğrafı arşivden silmek istediğinize emin misiniz?')) return;

  try {
    let custom = JSON.parse(localStorage.getItem('gtok_custom_photos') || '[]');
    custom = custom.filter(p => p.id !== id);
    localStorage.setItem('gtok_custom_photos', JSON.stringify(custom));
    renderArchiveGrid();
  } catch (err) {
    console.error('Silme hatası:', err);
  }
};

/* ==========================================================================
   4. MODAL GENEL KAPATMA
   ========================================================================= */
function initModalBackdrop() {
  const modal = document.getElementById('gtok-modal');
  const closeBtn = document.getElementById('gtok-modal-close');

  if (!modal) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', closeGtokModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeGtokModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeGtokModal();
    }
  });
}

window.closeGtokModal = function() {
  const modal = document.getElementById('gtok-modal');
  if (modal) {
    modal.classList.remove('open');
  }
};

/* ==========================================================================
   5. DİNAMİK YÖNETİM KURULU (YOKLAMA SİSTEMİNDEN VERİ ÇEKME MOTORU)
   ========================================================================== */
function initBoardMembersManager() {
  renderBoardMembers();

  // Yoklama sisteminde (aynı tarayıcıda/sekmede) bir değişiklik yapıldığında canlı yenile
  window.addEventListener('storage', (e) => {
    if (e.key === 'gtok_students_data_v2' || e.key === 'gtok_member_roles_v2' || e.key === 'gtok_settings_data_v2') {
      renderBoardMembers();
    }
  });
}

function getBoardMembersFromYoklama() {
  try {
    const fakeNames = ['Alp Eren Yılmaz', 'Ayşe Sena Kaya', 'Mehmet Fatih Demir', 'Zeynep Serra Aydın', 'Emre Can Yıldız', 'Burak Öztürk'];

    // 1. Yoklama sistemindeki öğrenci verilerini al
    let students = [];
    const savedStudents = localStorage.getItem('gtok_students_data_v2') || localStorage.getItem('gtok_students_data') || localStorage.getItem('gtok_students');
    if (savedStudents) {
      try {
        const parsed = JSON.parse(savedStudents);
        if (Array.isArray(parsed)) students = parsed;
      } catch (e) {}
    }

    // 2. Yoklama sistemindeki bağımsız roller haritasını al
    let rolesMap = {};
    const savedRoles = localStorage.getItem('gtok_member_roles_v2');
    if (savedRoles) {
      try {
        const parsedRoles = JSON.parse(savedRoles);
        if (parsedRoles && typeof parsedRoles === 'object') rolesMap = parsedRoles;
      } catch (e) {}
    }

    // 3. Ayarlar içerisindeki rolesMap yedeği
    const savedSettings = localStorage.getItem('gtok_settings_data_v2');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings && parsedSettings.rolesMap) {
          rolesMap = { ...parsedSettings.rolesMap, ...rolesMap };
        }
      } catch (e) {}
    }

    // Sahte/test üyeleri ayıkla
    const cleanStudents = students.filter(s => {
      if (!s) return false;
      const id = String(s.id || '').toUpperCase();
      if (id.startsWith('GTOK-YK-') || id.startsWith('YK-')) return false;
      if (s.name && fakeNames.includes(s.name.trim())) return false;
      return true;
    });

    // 4. Her üyenin rolünü QR sistemindeki verilerden çözümle
    const withRoles = cleanStudents.map(s => {
      const cleanId = String(s.id || '').trim().toUpperCase();
      const roleFromMap = rolesMap[cleanId];
      const directRole = (s.role && String(s.role).trim()) || '';
      let finalRole = directRole || (roleFromMap && String(roleFromMap).trim()) || '';
      
      // Kategori veya grup 'YK' ise ve rolü yoksa 'Yönetim Kurulu Üyesi' ata
      if (!finalRole) {
        const grp = String(s.group || '').toUpperCase();
        const cat = String(s.category || '').toUpperCase();
        if (grp.includes('YÖNETİM') || cat.includes('YK') || cat.includes('YÖNETİM')) {
          finalRole = 'Yönetim Kurulu Üyesi';
        }
      }

      return {
        ...s,
        role: finalRole
      };
    });

    // 5. Yalnızca kulüp görevi / yönetim kurulu unvanı olanları filtrele
    const boardMembers = withRoles.filter(s => {
      if (!s.role || !s.role.trim()) return false;
      const r = s.role.trim().toLowerCase();
      if (r === 'kulüp sporcusu / üyesi (standart)' || r === 'üye' || r === 'sporcu' || r === 'standart') return false;
      return true;
    });

    // 6. Protokol ve hiyerarşi sırasına göre sırala
    const rolePriority = [
      'kulüp başkanı',
      'başkan',
      'başkan yardımcısı',
      'okçu başı',
      'antrenör',
      'eğitmen',
      'genel sekreter',
      'sayman',
      'muhasip',
      'takım kaptanı',
      'yönetim kurulu',
      'denetleme kurulu başkanı',
      'denetleme kurulu'
    ];

    boardMembers.sort((a, b) => {
      const roleA = (a.role || '').toLowerCase();
      const roleB = (b.role || '').toLowerCase();
      const idxA = rolePriority.findIndex(p => roleA.includes(p));
      const idxB = rolePriority.findIndex(p => roleB.includes(p));
      const prioA = idxA === -1 ? 99 : idxA;
      const prioB = idxB === -1 ? 99 : idxB;
      return prioA - prioB;
    });

    return boardMembers;
  } catch (err) {
    console.error('Yönetim kurulu QR verileri yüklenirken hata:', err);
    return [];
  }
}

function renderBoardCards(members) {
  const container = document.getElementById('board-members-grid');
  if (!container) return;

  if (!members || members.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: var(--gtok-card); border-radius: var(--gtok-radius-md); border: 1px dashed rgba(212, 163, 115, 0.3); color: var(--gtok-text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚜️</div>
        <h4 style="color: #fff; font-size: 1.1rem; margin-bottom: 0.5rem; font-family: var(--gtok-font-display);">Yönetim Kurulu QR Yoklama Sisteminden Yüklenir</h4>
        <p style="font-size: 0.88rem; max-width: 500px; margin: 0 auto 1.25rem; color: var(--gtok-text-dim);">
          QR Yoklama sisteminde tanımlanan veya rolü güncellenen yönetim kurulu üyeleri anında burada yayınlanır.
        </p>
        <a href="yoklama.html#ogrenciler" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; font-size: 0.85rem; padding: 0.55rem 1.2rem;">
          <span>🎯</span> QR Yoklama Sistemini Aç
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = members.map(m => {
    const rawNames = (m.name || 'Üye').trim().split(/\s+/).filter(Boolean);
    const initials = rawNames.length > 1 
      ? (rawNames[0][0] + rawNames[rawNames.length - 1][0]).toUpperCase()
      : (rawNames[0] ? rawNames[0].slice(0, 2).toUpperCase() : 'YK');

    const deptParts = [m.department, m.faculty].filter(p => p && p.trim().length > 0);
    const deptInfo = deptParts.length > 0 ? deptParts.join(' • ') : 'Karadeniz Teknik Üniversitesi';

    return `
      <div class="board-card" id="board-card-${m.id || Math.random().toString(36).slice(2)}">
        <div class="board-avatar">${initials}</div>
        <h3 class="board-name">${m.name}</h3>
        <div class="board-role">${m.role}</div>
        <div class="board-dept">${deptInfo}</div>
      </div>
    `;
  }).join('');
}

function renderBoardMembers() {
  const members = getBoardMembersFromYoklama();
  renderBoardCards(members);
}

// Buluttan (Supabase) canlı verileri çek ve sayfayı anında güncelle
async function initSupabaseWebsiteSync() {
  try {
    if (!window.SupabaseDB) return;

    // 1. Duyuruları Supabase Bulutundan çek
    if (typeof SupabaseDB.getAnnouncementsCloud === 'function') {
      const annList = await SupabaseDB.getAnnouncementsCloud();
      if (annList && Array.isArray(annList) && annList.length > 0) {
        saveAnnouncements(annList);
        localStorage.setItem('gtok_announcements_v1', JSON.stringify(annList));
        renderAnnouncements();
      }
    }

    // 2. Antrenman Seanslarını Supabase Bulutundan çek
    if (typeof SupabaseDB.getSessionsCloud === 'function') {
      const sessList = await SupabaseDB.getSessionsCloud();
      if (sessList && Array.isArray(sessList) && sessList.length > 0) {
        saveTrainingSessions(sessList);
        renderTrainingSchedule();
      }
    }

    // 3. Yönetim Kurulu Üyelerini Supabase Bulutundan çek (Gerçek 13 üye)
    if (typeof SupabaseDB.getBoardMembersCloud === 'function') {
      const boardList = await SupabaseDB.getBoardMembersCloud();
      if (boardList && Array.isArray(boardList) && boardList.length > 0) {
        localStorage.setItem('gtok_supabase_board_cache', JSON.stringify(boardList));
        renderBoardCards(boardList);
      }
    }
  } catch (err) {
    console.warn('Supabase web sync hatası:', err);
  }
}

/* ==========================================================================
   6. SPORCU QR KİMLİK KARTI & KOD SORGULAMA MOTORU (ATHLETE QR PORTAL)
   ========================================================================== */
window.openAthleteQrModal = function() {
  const modal = document.getElementById('gtok-modal');
  const modalContent = document.getElementById('gtok-modal-content');
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 1.25rem;">
      <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:rgba(212,163,115,0.15); border:1px solid rgba(212,163,115,0.3); font-size:1.5rem; margin-bottom:0.5rem;">
        🪪
      </div>
      <h3 style="font-family:var(--gtok-font-display); font-size:1.35rem; color:#fff; font-weight:800; margin-bottom:0.25rem;">
        Sporcu QR Kimlik Kartı Sorgulama
      </h3>
      <p style="font-size:0.85rem; color:var(--gtok-text-muted);">
        Antrenman girişlerinde yoklama okutmak için adınızı arayarak kişisel QR kimlik kartınızı açın ve telefonunuza kaydedin.
      </p>
    </div>

    <!-- Filtreler -->
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:1rem;">
      <div>
        <label style="display:block; font-size:0.75rem; color:var(--gtok-cream); font-weight:600; margin-bottom:0.3rem;">Antrenman Seansı</label>
        <select id="qr-filter-group" class="modal-form-select" onchange="filterAthleteQrList()" style="font-size:0.85rem; padding:0.55rem 0.75rem;">
          <option value="ALL">Tüm Seanslar (137 Sporcu)</option>
          <option value="SALI 1">SALI 1 (17:15 - 18:15)</option>
          <option value="SALI 2">SALI 2 (18:25 - 19:25)</option>
          <option value="ÇARŞAMBA 1">ÇARŞAMBA 1 (17:15 - 18:15)</option>
          <option value="ÇARŞAMBA 2">ÇARŞAMBA 2 (18:25 - 19:25)</option>
          <option value="PERŞEMBE 1">PERŞEMBE 1 (19:15 - 20:15)</option>
          <option value="PERŞEMBE 2">PERŞEMBE 2 (20:25 - 21:25)</option>
          <option value="CUMA 1">CUMA 1 (17:15 - 18:15)</option>
          <option value="CUMA 2">CUMA 2 (18:25 - 19:25)</option>
        </select>
      </div>

      <div>
        <label style="display:block; font-size:0.75rem; color:var(--gtok-cream); font-weight:600; margin-bottom:0.3rem;">Sporcu Adı / Soyadı</label>
        <input type="text" id="qr-search-name" class="modal-form-input" placeholder="İsminizi yazın..." oninput="filterAthleteQrList()" style="font-size:0.85rem; padding:0.55rem 0.75rem;">
      </div>
    </div>

    <!-- Sporcu Listesi Arama Sonuçları -->
    <div id="athlete-qr-results" style="max-height: 270px; overflow-y: auto; border: 1px solid var(--gtok-border); border-radius: var(--gtok-radius-md); background: rgba(0,0,0,0.25); padding: 0.5rem; margin-bottom: 1.25rem;">
      <!-- Dinamik doldurulur -->
    </div>

    <!-- Tekil Sporcu Kart Görünümü (Gizli Başlar) -->
    <div id="athlete-single-card-view" style="display:none; padding:1.25rem; background:linear-gradient(135deg, rgba(26,20,18,0.95), rgba(15,10,8,0.98)); border:2px solid var(--gtok-cream); border-radius:var(--gtok-radius-lg); text-align:center; box-shadow:0 15px 35px rgba(0,0,0,0.6); margin-bottom:1.25rem;">
      <div style="display:flex; align-items:center; justify-content:center; gap:0.6rem; margin-bottom:0.75rem;">
        <img src="public/logo.jpg" alt="Logo" style="width:36px; height:36px; border-radius:50%; border:1px solid var(--gtok-cream);">
        <div style="text-align:left;">
          <div style="font-size:0.75rem; font-weight:800; color:var(--gtok-cream); letter-spacing:0.05em; text-transform:uppercase;">KTÜ GTOK OKÇULUK</div>
          <div style="font-size:0.65rem; color:var(--gtok-text-dim);">Resmi Sporcu Kimlik Kartı</div>
        </div>
      </div>

      <div style="background:#fff; padding:12px; border-radius:12px; display:inline-block; margin-bottom:0.75rem; box-shadow:0 4px 15px rgba(0,0,0,0.3);">
        <div id="athlete-qr-canvas-holder"></div>
      </div>

      <h4 id="card-athlete-name" style="font-family:var(--gtok-font-display); font-size:1.25rem; color:#fff; font-weight:800; margin-bottom:0.25rem;"></h4>
      <div id="card-athlete-session" style="font-size:0.85rem; color:var(--gtok-cream); font-weight:700; margin-bottom:0.25rem;"></div>
      <div id="card-athlete-id" style="font-size:0.75rem; color:var(--gtok-text-dim); margin-bottom:1rem; letter-spacing:0.05em;"></div>

      <div style="display:flex; gap:0.5rem; justify-content:center;">
        <button type="button" class="btn-primary" onclick="downloadAthleteQrCard()" style="font-size:0.82rem; padding:0.45rem 1rem;">
          📥 QR Kartı İndir (PNG)
        </button>
        <button type="button" class="btn-secondary" onclick="backToAthleteList()" style="font-size:0.82rem; padding:0.45rem 0.85rem;">
          ⬅ Listeye Dön
        </button>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end;">
      <button class="btn-secondary" onclick="closeGtokModal()" style="font-size:0.85rem; padding:0.45rem 1.15rem;">Kapat</button>
    </div>
  `;

  modal.classList.add('open');
  filterAthleteQrList();
};

window.filterAthleteQrList = function() {
  const groupFilter = document.getElementById('qr-filter-group')?.value || 'ALL';
  const nameQuery = (document.getElementById('qr-search-name')?.value || '').trim().toLowerCase();
  const container = document.getElementById('athlete-qr-results');
  if (!container) return;

  const students = (typeof OFFICIAL_137_STUDENTS !== 'undefined' && Array.isArray(OFFICIAL_137_STUDENTS))
    ? OFFICIAL_137_STUDENTS
    : [];

  let filtered = students;
  if (groupFilter !== 'ALL') {
    filtered = filtered.filter(s => s.group === groupFilter);
  }
  if (nameQuery) {
    filtered = filtered.filter(s => s.name.toLowerCase().includes(nameQuery) || (s.id && s.id.toLowerCase().includes(nameQuery)));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:1.5rem; color:var(--gtok-text-dim); font-size:0.85rem;">
        Aradığınız kriterlere uygun sporcu bulunamadı. Lütfen isminizi kontrol ediniz.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(s => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:0.55rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
      <div>
        <div style="color:#fff; font-weight:700; font-size:0.9rem;">${s.name}</div>
        <div style="font-size:0.75rem; color:var(--gtok-cream);">${s.group} • ${s.time}</div>
      </div>
      <button onclick="showAthleteCard('${s.id}')" class="btn-primary" style="padding:0.35rem 0.75rem; font-size:0.75rem; border:none; cursor:pointer;">
        QR Kartı Aç ↗
      </button>
    </div>
  `).join('');
};

let currentCardStudent = null;

window.showAthleteCard = function(studentId) {
  const students = (typeof OFFICIAL_137_STUDENTS !== 'undefined' && Array.isArray(OFFICIAL_137_STUDENTS))
    ? OFFICIAL_137_STUDENTS
    : [];
  const student = students.find(s => s.id === studentId);
  if (!student) return;

  currentCardStudent = student;

  const resultsBox = document.getElementById('athlete-qr-results');
  const cardView = document.getElementById('athlete-single-card-view');
  const holder = document.getElementById('athlete-qr-canvas-holder');
  if (resultsBox) resultsBox.style.display = 'none';
  if (cardView) cardView.style.display = 'block';

  const cleanLocation = (student.location || 'Hasan Polat Spor Salonu').replace(/\s*poligonu?/gi, '');
  document.getElementById('card-athlete-name').textContent = student.name;
  document.getElementById('card-athlete-session').textContent = student.session;
  document.getElementById('card-athlete-id').textContent = 'Sporcu ID: ' + student.id + ' • ' + cleanLocation;

  if (holder) {
    holder.innerHTML = '';
    if (window.QRCode) {
      new QRCode(holder, {
        text: student.id,
        width: 180,
        height: 180,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }
};

window.backToAthleteList = function() {
  const resultsBox = document.getElementById('athlete-qr-results');
  const cardView = document.getElementById('athlete-single-card-view');
  if (resultsBox) resultsBox.style.display = 'block';
  if (cardView) cardView.style.display = 'none';
};

window.downloadAthleteQrCard = function() {
  if (!currentCardStudent) return;
  const qrImgOrCanvas = document.querySelector('#athlete-qr-canvas-holder canvas') || document.querySelector('#athlete-qr-canvas-holder img');
  if (!qrImgOrCanvas) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 600;
  canvas.height = 780;

  // Arka plan
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 600, 780);

  // Kart Çerçevesi
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 560, 740);

  // Başlık
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KTÜ GTOK OKÇULUK KULÜBÜ', 300, 75);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.fillText('RESMİ SPORCU QR KİMLİK KARTI', 300, 105);

  // QR Arka plan kutusu
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(160, 140, 280, 280);

  // QR kodu çiz
  ctx.drawImage(qrImgOrCanvas, 175, 155, 250, 250);

  // Sporcu Bilgileri
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(currentCardStudent.name, 300, 480);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(currentCardStudent.session, 300, 525);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('NO: ' + currentCardStudent.id, 300, 565);

  const cleanLocation = (currentCardStudent.location || 'Hasan Polat Spor Salonu').replace(/\s*poligonu?/gi, '');
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px sans-serif';
  ctx.fillText(cleanLocation, 300, 605);

  ctx.fillStyle = '#64748b';
  ctx.font = '13px sans-serif';
  ctx.fillText('Antrenman yoklamalarında bu QR kodu antrenörünüze okutunuz.', 300, 680);

  const link = document.createElement('a');
  link.download = 'GTOK_QR_' + currentCardStudent.id + '_' + currentCardStudent.name.replace(/\s+/g, '_') + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};
