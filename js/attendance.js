// Yoklama İşlemleri, Canlı Akış ve Mükerrer Kontrolü
const AttendanceManager = {
  lastScannedTime: {}, // Aynı kartın art arda saniyede 10 kez okunmasını engellemek için cooldown

  init() {
    this.renderTodayList();
    this.setupManualSearch();
    this.setupDateFilter();
  },

  // Bugünün tarih dizesi (YYYY-AA-GG)
  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Zaman dizesi (SS:DD)
  getCurrentTimeString() {
    const d = new Date();
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  },

  streamTab: 'ATTENDED', // 'ATTENDED' veya 'EXPECTED'

  // Sporcuyu Yoklamaya Kaydet (QR veya Manuel)
  processCheckIn(studentId) {
    if (!studentId) return;
    const cleanId = studentId.trim().toUpperCase();

    // 1. Çok hızlı mükerrer okuma koruması (Cooldown: 3 saniye)
    const now = Date.now();
    if (this.lastScannedTime[cleanId] && (now - this.lastScannedTime[cleanId] < 3000)) {
      return;
    }
    this.lastScannedTime[cleanId] = now;

    // 2. Sporcuyu bul
    const student = Storage.getStudentById(cleanId);
    if (!student) {
      this.showToast(`Tanımsız Sporcu Kodu: ${cleanId}`, 'error');
      if (window.soundFX) window.soundFX.playWarning();
      return;
    }

    const today = this.getTodayString();
    const allRecords = Storage.getAttendance();

    // 3. Aynı gün içinde zaten gelmiş mi?
    const existing = allRecords.find(r => r.date === today && r.studentId === student.id);
    if (existing) {
      // Mükerrer Uyarısı!
      if (window.soundFX) window.soundFX.playWarning();
      this.showPopup(student, `Bugün zaten kayıtlı! (Giriş Saati: ${existing.time})`, true);
      return;
    }

    // 4. Seans Kontrolü (Farklı Seans Uyarısı & Esnek Taşıma / Telafi)
    const activeSession = (window.Storage && typeof window.Storage.getActiveSession === 'function') 
      ? window.Storage.getActiveSession() 
      : null;

    if (activeSession && student.session && student.session.trim()) {
      const studentSessionClean = student.session.trim().toLowerCase();
      const activeSessionClean = activeSession.name.trim().toLowerCase();

      // Eğer kayıtlı seansı aktif seansla eşleşmiyorsa
      if (studentSessionClean !== activeSessionClean && !studentSessionClean.includes(activeSession.startTime)) {
        if (window.soundFX) window.soundFX.playWarning();

        if (window.SessionManager && typeof window.SessionManager.showMismatchModal === 'function') {
          SessionManager.showMismatchModal(student, activeSession, (action) => {
            if (action === 'CANCEL') return;

            let isMakeup = false;
            let isSwitched = false;

            if (action === 'PERMANENT') {
              // Kalıcı olarak bu seansa aktar
              Storage.changeStudentSession(student.id, activeSession.name);
              if (window.StudentsManager) window.StudentsManager.renderStudentsList();
              isSwitched = true;
            } else if (action === 'MAKEUP') {
              // Bu seansa telafi olarak yaz
              isMakeup = true;
            }

            this.finalizeCheckIn(student, today, activeSession, isMakeup, isSwitched);
          });
          return;
        }
      }
    }

    this.finalizeCheckIn(student, today, activeSession, false, false);
  },

  // Yoklama Kaydını Tamamla
  finalizeCheckIn(student, today, activeSession, isMakeup = false, isSwitched = false) {
    const newRecord = {
      recordId: 'REC-' + Date.now(),
      date: today,
      time: this.getCurrentTimeString(),
      studentId: student.id,
      studentName: student.name,
      category: student.category || 'Genel',
      status: isMakeup ? 'Telafi' : 'Geldi',
      sessionId: activeSession ? activeSession.id : null,
      sessionName: activeSession ? activeSession.name : null,
      isMakeup: !!isMakeup,
      timestamp: Date.now()
    };

    Storage.addAttendanceRecord(newRecord);

    const isVip = !!(student.role && student.role.trim());

    // Onay Sesi & Efektler
    if (isVip) {
      if (window.soundFX && typeof window.soundFX.playVipFanfare === 'function') {
        window.soundFX.playVipFanfare();
      } else if (window.soundFX) {
        window.soundFX.playSuccess();
      }
      if (window.confetti) {
        window.confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#d4a373', '#f59e0b', '#fbbf24', '#ffffff', '#b45309']
        });
      }
    } else {
      if (window.soundFX) window.soundFX.playSuccess();
      if (window.confetti) {
        window.confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6']
        });
      }
    }

    // Başarı Bildirimi Metni
    let successMsg = `Yoklama Alındı (${newRecord.time})`;
    if (isSwitched) {
      successMsg = `🔄 Grubu "${activeSession.name}" Yapıldı & Alındı!`;
    } else if (isMakeup) {
      successMsg = `⚠️ [Telafi Girişi]: ${activeSession.name}`;
    } else if (isVip) {
      successMsg = `⚜️ ${student.role} • Hoş Geldiniz! (${newRecord.time})`;
    }

    this.showPopup(student, successMsg, false, isVip);
    this.renderTodayList();

    if (window.SessionManager) {
      window.SessionManager.updateStats();
    }
  },

  // Ekranda Şık Başarı Kartı Göster
  showPopup(student, message, isDuplicate, isVip = false) {
    const popup = document.getElementById('checkin-popup');
    const nameEl = document.getElementById('popup-student-name');
    const msgEl = document.getElementById('popup-message');
    const iconEl = document.getElementById('popup-icon');

    if (!popup || !nameEl || !msgEl) return;

    nameEl.textContent = student.name;
    msgEl.textContent = `${student.id} • ${message}`;

    popup.classList.remove('duplicate', 'vip');

    if (isDuplicate) {
      popup.classList.add('duplicate');
      iconEl.textContent = '⚠️';
    } else if (isVip) {
      popup.classList.add('vip');
      iconEl.textContent = '⚜️';
    } else {
      iconEl.textContent = '🎯';
    }

    popup.classList.add('show');

    clearTimeout(this.popupTimer);
    this.popupTimer = setTimeout(() => {
      popup.classList.remove('show');
    }, isVip ? 4200 : 3200);
  },

  setStreamTab(tab) {
    this.streamTab = tab;
    this.renderTodayList();
  },

  // Bugün Katılanlar / Beklenenler Listesini Render Et
  renderTodayList() {
    const container = document.getElementById('today-attendance-list');
    const countBadge = document.getElementById('today-count-badge');
    const headerCount = document.getElementById('header-today-count');
    if (!container) return;

    const today = this.getTodayString();
    const records = Storage.getAttendance().filter(r => r.date === today);
    const attendedIds = new Set(records.map(r => r.studentId));

    if (headerCount) headerCount.textContent = `${records.length} Katılım`;

    const activeSession = (window.Storage && typeof window.Storage.getActiveSession === 'function') 
      ? window.Storage.getActiveSession() 
      : null;

    // Gelenler veya Beklenenler Sekme Başlığı Butonları
    const activeSessionName = activeSession ? activeSession.name : null;
    const allStudents = Storage.getStudents();
    
    // Beklenen öğrenciler: Eğer aktif seans varsa o seansın öğrencileri, yoksa tüm öğrenciler
    const sessionStudents = activeSessionName
      ? allStudents.filter(s => (s.session || '').trim().toLowerCase() === activeSessionName.trim().toLowerCase())
      : allStudents;
    const expectedStudents = sessionStudents.filter(s => !attendedIds.has(s.id));

    if (countBadge) {
      countBadge.textContent = this.streamTab === 'EXPECTED'
        ? `${expectedStudents.length} Beklenen`
        : `${records.length} Gelen`;
    }

    // 1. BEKLENENLER LİSTESİ GÖRÜNÜMÜ
    if (this.streamTab === 'EXPECTED') {
      if (expectedStudents.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <span class="icon">🎉</span>
            <p style="color: #4ade80; font-weight: bold;">Tebrikler! Beklenen tüm okçular geldi.</p>
            <small style="color: #94a3b8;">${activeSessionName ? activeSessionName + ' seansında fire yok!' : 'Kayıtlı herkes katıldı.'}</small>
          </div>
        `;
        return;
      }

      container.innerHTML = expectedStudents.map(student => `
        <div class="attendance-item" style="border-style: dashed; opacity: 0.9;">
          <div class="attendance-user-info">
            <div class="user-avatar" style="background: rgba(255,255,255,0.03); color: #94a3b8;">
              ${StudentsManager.getInitials(student.name)}
            </div>
            <div class="user-names">
              <h4>${StudentsManager.escapeHtml(student.name)}</h4>
              <p>${StudentsManager.escapeHtml(student.id)} • ${StudentsManager.escapeHtml(student.session || 'Seanssız')}</p>
            </div>
          </div>
          <div class="attendance-meta">
            <button class="btn btn-primary" style="padding: 0.25rem 0.65rem; font-size: 0.78rem;" onclick="AttendanceManager.processCheckIn('${student.id}')">
              + Geldi Yaz
            </button>
          </div>
        </div>
      `).join('');
      return;
    }

    // 2. GELENLER LİSTESİ GÖRÜNÜMÜ
    if (records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="icon">🎯</span>
          <p>Bugün henüz yoklama alınmadı.</p>
          <small style="color: #64748b;">Kamerayı açarak QR kodu gösterin veya aşağıdan aratın.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = records.map(r => {
      const student = Storage.getStudentById(r.studentId);
      const isVip = student && student.role && student.role.trim();
      const isMakeup = r.isMakeup;

      return `
      <div class="attendance-item ${isVip ? 'vip-item' : ''}" style="${isVip ? 'border-color: rgba(212, 163, 115, 0.45); background: rgba(212, 163, 115, 0.05);' : ''}">
        <div class="attendance-user-info">
          <div class="user-avatar" style="${isVip ? 'border-color: #d4a373; color: #fbbf24;' : ''}">
            ${StudentsManager.getInitials(r.studentName)}
          </div>
          <div class="user-names">
            <h4 style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              ${StudentsManager.escapeHtml(r.studentName)}
              ${isVip ? `<span class="badge-role" style="font-size: 0.72rem; padding: 0.1rem 0.5rem;">⚜️ ${StudentsManager.escapeHtml(student.role)}</span>` : ''}
              ${isMakeup ? `<span style="font-size: 0.7rem; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 999px; padding: 0.1rem 0.45rem;">⚠️ Telafi</span>` : ''}
            </h4>
            <p>${StudentsManager.escapeHtml(r.studentId)} • ${StudentsManager.escapeHtml(r.sessionName || r.category || 'Okçu')}</p>
          </div>
        </div>
        <div class="attendance-meta">
          <span class="checkin-time" style="${isVip ? 'background: rgba(212, 163, 115, 0.12); color: #fbbf24; border-color: rgba(212, 163, 115, 0.4);' : ''}">
            ${isVip ? '⚜️' : '🕒'} ${r.time}
          </span>
          <button class="btn btn-danger btn-icon-only" title="Kaydı Geri Al / Sil" onclick="AttendanceManager.removeRecord('${r.recordId}')">
            ✕
          </button>
        </div>
      </div>
    `;
    }).join('');
  },

  // Kaydı Geri Al
  removeRecord(recordId) {
    if (confirm('Bu yoklama kaydını silmek istediğinize emin misiniz?')) {
      Storage.removeAttendanceRecord(recordId);
      this.renderTodayList();
      if (window.HistoryManager) window.HistoryManager.renderHistory();
    }
  },

  // Kartını unutanlar için hızlı arama kutusu
  setupManualSearch() {
    const input = document.getElementById('quick-search-input');
    const results = document.getElementById('quick-search-results');
    if (!input || !results) return;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.style.display = 'none';
        results.innerHTML = '';
        return;
      }

      const today = this.getTodayString();
      const todayRecords = Storage.getAttendance().filter(r => r.date === today);
      const attendedIds = new Set(todayRecords.map(r => r.studentId));

      const students = Storage.getStudents();
      const matches = students.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.id.toLowerCase().includes(q)
      ).slice(0, 5);

      if (matches.length === 0) {
        results.style.display = 'block';
        results.innerHTML = `<div style="padding: 0.75rem; color: #64748b; font-size: 0.85rem;">Eşleşen sporcu bulunamadı</div>`;
        return;
      }

      results.style.display = 'block';
      results.innerHTML = matches.map(s => {
        const isAlreadyIn = attendedIds.has(s.id);
        return `
          <div class="search-result-item" onclick="AttendanceManager.handleManualSelect('${s.id}')">
            <div>
              <strong>${StudentsManager.escapeHtml(s.name)}</strong>
              <small style="color: #94a3b8; margin-left: 0.5rem;">(${s.id})</small>
            </div>
            ${isAlreadyIn 
              ? `<span style="color: #10b981; font-size: 0.8rem; font-weight: bold;">✓ Geldi</span>` 
              : `<button class="btn btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">+ Geldi İşaretle</button>`}
          </div>
        `;
      }).join('');
    });

    // Tıklama dışına basınca kapat
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.style.display = 'none';
      }
    });
  },

  handleManualSelect(studentId) {
    this.processCheckIn(studentId);
    const input = document.getElementById('quick-search-input');
    const results = document.getElementById('quick-search-results');
    if (input) input.value = '';
    if (results) results.style.display = 'none';
  },

  setupDateFilter() {
    // Geçmiş sekmesi için tarih kontrolü
    const historyDate = document.getElementById('history-date-picker');
    if (historyDate) {
      historyDate.value = this.getTodayString();
      historyDate.addEventListener('change', () => {
        if (window.HistoryManager) window.HistoryManager.renderHistory();
      });
    }
  },

  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `btn btn-${type === 'error' ? 'danger' : 'primary'}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.right = '2rem';
    toast.style.zIndex = '3000';
    toast.style.boxShadow = 'var(--shadow-lg)';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

window.AttendanceManager = AttendanceManager;
