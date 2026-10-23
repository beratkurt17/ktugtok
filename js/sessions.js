// KTÜ GTOK Antrenman Gün ve Seansları / Ders Grubu Yönetim Motoru
const SessionManager = {
  currentDetailSessionId: null,
  mismatchCallback: null,

  init() {
    this.renderSessionsGrid();
    this.renderActiveSessionSelector();
    this.renderSessionFilter();
    this.updateStats();
  },

  // 1. KUTUCUK KUTUCUK SEANS KARTLARI (Antrenman Seansları & Dersler Sayfası)
  renderSessionsGrid() {
    const container = document.getElementById('sessions-grid-container');
    if (!container) return;

    const sessions = Storage.getSessions();
    const students = Storage.getStudents();
    const attendance = Storage.getAttendance();
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = attendance.filter(a => a.date === today);
    const activeSessionId = Storage.getActiveSessionId();

    // Üst bardaki seans sayaç rozeti
    const badgeEl = document.getElementById('total-sessions-count');
    if (badgeEl) badgeEl.textContent = `${sessions.length} Seans`;

    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; background: var(--bg-card); border-radius: var(--radius-xl); border: 1px dashed var(--border-color); padding: 3rem 1.5rem;">
          <span class="icon" style="font-size: 3rem;">🏹</span>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 0.5rem; color: #fff;">Kayıtlı Antrenman Seansı Bulunmuyor</h3>
          <p style="color: #94a3b8; max-width: 480px; margin: 0.5rem auto 1.5rem auto;">
            Google Forms'dan aldığınız Excel dosyasını yükleyerek saat gruplarını otomatik oluşturabilir veya yukarıdaki "+ Yeni Seans Ekle" butonuna basabilirsiniz.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="SessionManager.openCreateModal()">
              <span>+ Yeni Seans Oluştur</span>
            </button>
            <button class="btn btn-secondary" onclick="document.getElementById('excel-sessions-auto-import').click()">
              <span>📥 Form / Excel Dosyası Yükle</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions.map(s => {
      const sNameClean = (s.name || '').trim().toLowerCase();
      const assigned = students.filter(st => (st.session || '').trim().toLowerCase() === sNameClean);
      const totalCount = assigned.length;

      // Bu seansa bugün gelenler (Doğrudan bu seansla kaydedilenler veya bu gruba kayıtlı olup giriş yapanlar)
      const attended = todayRecords.filter(r => {
        if (r.sessionId === s.id) return true;
        return assigned.some(st => st.id === r.studentId);
      });
      const attendedCount = attended.length;
      const pct = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;
      const isActive = (s.id === activeSessionId);

      return `
        <div class="session-box-card ${isActive ? 'active-session' : ''}" onclick="SessionManager.openDetailModal('${s.id}')">
          <div>
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.75rem;">
              <div>
                <span class="session-badge-time">⏰ ${this.escapeHtml(s.startTime || '17:00')} - ${this.escapeHtml(s.endTime || '18:00')}</span>
                ${s.date ? `<span style="font-size: 0.75rem; color: #94a3b8; margin-left: 0.4rem;">📅 ${this.escapeHtml(s.date)}</span>` : ''}
              </div>
              ${isActive ? `
                <span style="font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 999px; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-weight: 700;">
                  ● Canlı Seans
                </span>
              ` : ''}
            </div>

            <h3 style="font-size: 1.18rem; font-weight: 800; color: #fff; margin-bottom: 0.35rem; line-height: 1.3;">
              ${this.escapeHtml(s.name)}
            </h3>
            ${s.notes ? `<p style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.6rem;">${this.escapeHtml(s.notes)}</p>` : ''}

            <div style="background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md); padding: 0.75rem; margin-top: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.04);">
              <div style="display: flex; justify-content: space-between; font-size: 0.84rem; margin-bottom: 0.35rem;">
                <span style="color: #94a3b8;">Kayıtlı Okçular:</span>
                <span style="font-weight: 700; color: #fff;">👥 ${totalCount} Okçu</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.84rem;">
                <span style="color: #94a3b8;">Bugün Katılım:</span>
                <span style="font-weight: 700; color: ${attendedCount > 0 ? '#4ade80' : '#94a3b8'};">🎯 ${attendedCount} / ${totalCount} (%${pct})</span>
              </div>
              <div class="session-progress-bar">
                <div class="session-progress-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 1.15rem; padding-top: 0.85rem; border-top: 1px solid var(--border-color);" onclick="event.stopPropagation()">
            <button class="btn btn-primary" style="flex: 1; font-size: 0.82rem; padding: 0.45rem 0.65rem;" onclick="SessionManager.openDetailModal('${s.id}')">
              <span>📋 Listeyi Aç</span>
            </button>
            <button class="btn btn-secondary" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" onclick="SessionManager.startQRForThisSession('${s.id}')" title="Bu seansı aktif yap ve QR Yoklamayı Başlat">
              <span>🎯 Yoklama Al</span>
            </button>
            <button class="btn btn-secondary btn-icon-only" onclick="SessionManager.exportSessionExcel('${s.id}')" title="Bu Seansın Yoklama Listesini Excel İndir">
              📊
            </button>
            <button class="btn btn-danger btn-icon-only" onclick="SessionManager.deleteSession('${s.id}')" title="Seansı Sil">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // 2. KUTUCUĞA BASINCA AÇILAN ÖĞRENCİ LİSTESİ & AYRI DERS YOKLAMASI MODALI
  openDetailModal(sessionId) {
    const session = Storage.getSessionById(sessionId);
    if (!session) return;

    this.currentDetailSessionId = sessionId;
    const modal = document.getElementById('session-detail-modal');
    if (!modal) return;

    const titleEl = document.getElementById('session-detail-title');
    const subtitleEl = document.getElementById('session-detail-subtitle');

    if (titleEl) {
      titleEl.innerHTML = `<span>🏹</span> ${this.escapeHtml(session.name)} (${this.escapeHtml(session.startTime || '')} - ${this.escapeHtml(session.endTime || '')})`;
    }

    this.renderDetailStudentsList(sessionId);
    modal.classList.add('active');
  },

  closeDetailModal() {
    const modal = document.getElementById('session-detail-modal');
    if (modal) modal.classList.remove('active');
    this.currentDetailSessionId = null;
    this.renderSessionsGrid();
    this.updateStats();
  },

  renderDetailStudentsList(sessionId) {
    const session = Storage.getSessionById(sessionId);
    if (!session) return;

    const tbody = document.getElementById('session-detail-students-tbody');
    const subtitleEl = document.getElementById('session-detail-subtitle');
    if (!tbody) return;

    const sNameClean = (session.name || '').trim().toLowerCase();
    const students = Storage.getStudents();
    const assigned = students.filter(st => (st.session || '').trim().toLowerCase() === sNameClean);

    const today = new Date().toISOString().slice(0, 10);
    const attendance = Storage.getAttendance();
    const todayRecords = attendance.filter(a => a.date === today);

    let attendedCount = 0;

    if (assigned.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">
            Bu antrenman seansına kayıtlı sporcu bulunmuyor.<br>
            Yukarıdaki "📥 Bu Seansa Excel ile Sporcu Ekle" butonuna basarak Excel yükleyebilir veya Sporcular sekmesinden sporcu atayabilirsiniz.
          </td>
        </tr>
      `;
      if (subtitleEl) subtitleEl.textContent = `Toplam: 0 Sporcu • 0 Geldi • 0 Bekleniyor`;
      return;
    }

    tbody.innerHTML = assigned.map(st => {
      const record = todayRecords.find(r => r.studentId === st.id);
      const isPresent = !!record;
      if (isPresent) attendedCount++;

      return `
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 0.65rem 0.75rem; font-weight: 700; color: var(--gold);">${this.escapeHtml(st.id)}</td>
          <td style="padding: 0.65rem 0.75rem; font-weight: 600; color: #fff;">${this.escapeHtml(st.name)}</td>
          <td style="padding: 0.65rem 0.75rem; color: #94a3b8; font-size: 0.82rem;">${this.escapeHtml(st.faculty || '')} ${st.department ? '• ' + this.escapeHtml(st.department) : ''}</td>
          <td style="padding: 0.65rem 0.75rem;">
            ${isPresent ? `
              <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-size: 0.78rem; font-weight: 700;">
                ✅ Geldi (${record.time || ''})
              </span>
            ` : `
              <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: rgba(239, 68, 68, 0.08); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); font-size: 0.78rem;">
                ⏳ Bekleniyor
              </span>
            `}
          </td>
          <td style="padding: 0.65rem 0.75rem; text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem; align-items: center;">
              ${isPresent ? `
                <button class="btn btn-secondary btn-icon-only" style="padding: 0.3rem 0.5rem; font-size: 0.78rem; color: #f87171;" title="Yoklamayı Geri Al / İptal Et" onclick="SessionManager.toggleAttendance('${st.id}', '${sessionId}')">
                  ✕ Yoklamayı Kaldır
                </button>
              ` : `
                <button class="btn btn-primary" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" onclick="SessionManager.toggleAttendance('${st.id}', '${sessionId}')">
                  ✓ Geldi Yaz
                </button>
              `}
              <button class="btn btn-secondary btn-icon-only" style="padding: 0.3rem 0.5rem;" title="Başka Saate / Seansa Taşı" onclick="SessionManager.promptChangeStudentSession('${st.id}')">
                🔄
              </button>
              <button class="btn btn-danger btn-icon-only" style="padding: 0.3rem 0.5rem;" title="Bu Seans Grubundan Çıkar" onclick="SessionManager.removeStudentFromSession('${st.id}')">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (subtitleEl) {
      subtitleEl.textContent = `Toplam: ${assigned.length} Sporcu • ${attendedCount} Geldi • ${assigned.length - attendedCount} Bekleniyor`;
    }
  },

  // Tek tıkla Geldi / Gelmedi yoklama kaydı
  toggleAttendance(studentId, sessionId) {
    const student = Storage.getStudentById(studentId);
    if (!student) return;

    const session = Storage.getSessionById(sessionId);
    const today = new Date().toISOString().slice(0, 10);
    const attendance = Storage.getAttendance();
    const existingIndex = attendance.findIndex(a => a.studentId === studentId && a.date === today);

    if (existingIndex !== -1) {
      // Yoklamayı geri al
      attendance.splice(existingIndex, 1);
      Storage.saveAttendance(attendance);
    } else {
      // Geldi yaz
      const now = new Date();
      const time = now.toTimeString().slice(0, 5);
      const newRec = {
        recordId: 'ATT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        studentId: student.id,
        studentName: student.name,
        category: student.category || 'Genel',
        date: today,
        time: time,
        status: 'Geldi',
        sessionId: session ? session.id : '',
        sessionName: session ? session.name : '',
        timestamp: Date.now()
      };
      Storage.addAttendance(newRec);
      if (window.soundFX) window.soundFX.playCheckin();
    }

    this.renderDetailStudentsList(sessionId);
    this.renderSessionsGrid();
    this.updateStats();
    if (window.AttendanceManager) {
      AttendanceManager.renderTodayList();
    }
  },

  // Seans detayından QR Yoklamaya geçiş
  startQRForThisSession(sessionId = null) {
    const targetId = sessionId || this.currentDetailSessionId;
    if (targetId) {
      Storage.setActiveSessionId(targetId);
    }
    this.closeDetailModal();
    if (typeof window.appSwitchTab === 'function') {
      window.appSwitchTab('tab-scanner');
    }
    this.renderActiveSessionSelector();
    this.updateStats();
    if (window.AttendanceManager) {
      AttendanceManager.renderTodayList();
    }
  },

  // Bu seansın yoklamasını Excel olarak indir
  exportThisSessionExcel() {
    if (this.currentDetailSessionId && window.ExcelExporter) {
      ExcelExporter.exportSessionAttendance(this.currentDetailSessionId, 'xlsx');
    }
  },

  exportSessionExcel(sessionId) {
    if (window.ExcelExporter) {
      ExcelExporter.exportSessionAttendance(sessionId, 'xlsx');
    }
  },

  // Bu seansa özel Excel yükleme
  handleSessionSpecificExcelUpload(inputEl) {
    if (inputEl && inputEl.files && inputEl.files[0] && this.currentDetailSessionId) {
      if (window.ExcelExporter) {
        ExcelExporter.importStudentsToSession(this.currentDetailSessionId, inputEl.files[0]);
      }
      inputEl.value = '';
    }
  },

  // Sporcuyu bu seanstan çıkar
  removeStudentFromSession(studentId) {
    const student = Storage.getStudentById(studentId);
    if (!student) return;

    if (confirm(`"${student.name}" sporcusunu bu antrenman grubundan çıkarmak istiyor musunuz?`)) {
      Storage.changeStudentSession(studentId, '');
      if (this.currentDetailSessionId) {
        this.renderDetailStudentsList(this.currentDetailSessionId);
      }
      this.renderSessionsGrid();
      this.updateStats();
      if (window.StudentsManager) {
        StudentsManager.renderStudentsList();
      }
    }
  },

  deleteCurrentDetailSession() {
    if (this.currentDetailSessionId) {
      this.deleteSession(this.currentDetailSessionId);
    }
  },

  // 3. YENİ SEANS OLUŞTURMA PENCERESİ
  openCreateModal() {
    const modal = document.getElementById('session-create-modal');
    if (!modal) return;

    const count = Storage.getSessions().length + 1;
    document.getElementById('session-name-input').value = `${count}. Grup`;
    document.getElementById('session-date-input').value = '';
    document.getElementById('session-start-input').value = '17:00';
    document.getElementById('session-end-input').value = '18:00';
    document.getElementById('session-notes-input').value = '';

    modal.classList.add('active');
  },

  closeCreateModal() {
    const modal = document.getElementById('session-create-modal');
    if (modal) modal.classList.remove('active');
  },

  handleSaveNewSession(e) {
    e.preventDefault();
    const name = document.getElementById('session-name-input').value.trim();
    const date = document.getElementById('session-date-input').value.trim();
    const startTime = document.getElementById('session-start-input').value;
    const endTime = document.getElementById('session-end-input').value;
    const notes = document.getElementById('session-notes-input').value.trim();

    if (!name) {
      alert('Lütfen grup / seans adını giriniz.');
      return;
    }

    const newSession = {
      id: 'SES-' + Date.now(),
      name: `${name} (${startTime} - ${endTime})`,
      date,
      startTime,
      endTime,
      notes
    };

    Storage.addSession(newSession);
    Storage.setActiveSessionId(newSession.id);

    this.closeCreateModal();
    this.renderSessionsGrid();
    this.renderActiveSessionSelector();
    this.renderSessionFilter();
    this.updateStats();

    alert(`✅ "${newSession.name}" antrenman seansı oluşturuldu!`);
  },

  deleteSession(id) {
    const session = Storage.getSessionById(id);
    if (!session) return;

    if (confirm(`"${session.name}" seansını silmek istediğinize emin misiniz?`)) {
      Storage.deleteSession(id);
      if (this.currentDetailSessionId === id) {
        this.closeDetailModal();
      }
      this.renderSessionsGrid();
      this.renderActiveSessionSelector();
      this.renderSessionFilter();
      this.updateStats();
    }
  },

  // 4. SCANNER VE DİĞER SEKMELER İÇİN SEÇİCİLER
  renderActiveSessionSelector() {
    const select = document.getElementById('active-session-select');
    if (!select) return;

    const sessions = Storage.getSessions();
    const activeId = Storage.getActiveSessionId();

    let html = `<option value="ALL">🌐 Tüm Gruplar / Genel Serbest Yoklama</option>`;
    sessions.forEach(s => {
      const timeStr = [s.startTime, s.endTime].filter(Boolean).join(' - ');
      const label = `🏹 ${s.name} ${timeStr ? '(' + timeStr + ')' : ''}`;
      html += `<option value="${s.id}" ${s.id === activeId ? 'selected' : ''}>${this.escapeHtml(label)}</option>`;
    });

    select.innerHTML = html;
    this.updateStats();
  },

  handleSessionChange(sessionId) {
    Storage.setActiveSessionId(sessionId);
    this.updateStats();
    if (window.AttendanceManager) {
      AttendanceManager.renderTodayList();
    }
  },

  renderSessionFilter() {
    const select = document.getElementById('student-session-filter');
    if (!select) return;

    const currentVal = select.value || 'ALL';
    const sessions = Storage.getSessions();

    let html = `<option value="ALL">Tüm Antrenman Grupları</option>`;
    sessions.forEach(s => {
      html += `<option value="${this.escapeHtml(s.name)}" ${currentVal === s.name ? 'selected' : ''}>⏰ ${this.escapeHtml(s.name)}</option>`;
    });
    html += `<option value="UNASSIGNED" ${currentVal === 'UNASSIGNED' ? 'selected' : ''}>⚠️ Seansı Belirlenmemişler</option>`;

    select.innerHTML = html;
  },

  populateSessionSelectOptions(selectedVal = '') {
    const select = document.getElementById('student-session-select');
    if (!select) return;

    const sessions = Storage.getSessions();
    let html = `<option value="">Antrenman Seansı Seçilmedi</option>`;

    let hasMatch = false;
    sessions.forEach(s => {
      const isMatch = s.name.trim() === String(selectedVal).trim();
      if (isMatch) hasMatch = true;
      html += `<option value="${this.escapeHtml(s.name)}" ${isMatch ? 'selected' : ''}>⏰ ${this.escapeHtml(s.name)} (${s.startTime || ''} - ${s.endTime || ''})</option>`;
    });

    if (selectedVal && !hasMatch && selectedVal !== 'CUSTOM') {
      html += `<option value="${this.escapeHtml(selectedVal)}" selected>⏰ ${this.escapeHtml(selectedVal)}</option>`;
    }

    html += `<option value="CUSTOM" ${selectedVal === 'CUSTOM' ? 'selected' : ''}>✏️ Yeni / Özel Antrenman Saati Yaz...</option>`;
    select.innerHTML = html;
  },

  updateStats() {
    const attendedEl = document.getElementById('session-attended-count');
    const totalEl = document.getElementById('session-total-count');
    if (!attendedEl || !totalEl) return;

    const activeSession = Storage.getActiveSession();
    const students = Storage.getStudents();
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = Storage.getAttendance().filter(r => r.date === today);

    if (!activeSession) {
      attendedEl.textContent = todayRecords.length;
      totalEl.textContent = students.length;
    } else {
      const sessionName = activeSession.name.trim().toLowerCase();
      const assigned = students.filter(s => (s.session || '').trim().toLowerCase() === sessionName);
      const sessionAttended = todayRecords.filter(r => {
        if (r.sessionId === activeSession.id) return true;
        return assigned.some(s => s.id === r.studentId);
      });

      attendedEl.textContent = sessionAttended.length;
      totalEl.textContent = assigned.length;
    }
  },

  promptChangeStudentSession(studentId) {
    const student = Storage.getStudentById(studentId);
    if (!student) return;

    const sessions = Storage.getSessions();
    const sessionNames = sessions.map(s => s.name);
    
    let promptMsg = `🎯 "${student.name}" okçusunun yeni antrenman seansını belirleyin:\n\n`;
    sessions.forEach((s, idx) => {
      promptMsg += `${idx + 1}. ${s.name} (${s.startTime || ''} - ${s.endTime || ''})\n`;
    });
    promptMsg += `\nNumara seçin (1-${sessions.length}) veya yeni bir seans adı yazın:`;

    const input = prompt(promptMsg, student.session || '');
    if (input === null) return;

    let newSession = input.trim();
    const chosenIndex = parseInt(input.trim(), 10) - 1;
    if (!isNaN(chosenIndex) && chosenIndex >= 0 && chosenIndex < sessionNames.length) {
      newSession = sessionNames[chosenIndex];
    }

    Storage.changeStudentSession(student.id, newSession);
    if (window.StudentsManager) StudentsManager.renderStudentsList();
    if (this.currentDetailSessionId) this.renderDetailStudentsList(this.currentDetailSessionId);
    this.renderSessionsGrid();
    this.updateStats();

    alert(`✅ "${student.name}" sporcusunun seansı "${newSession || 'Seanssız'}" olarak güncellendi!`);
  },

  showMismatchModal(student, activeSession, onResolve) {
    const modal = document.getElementById('session-mismatch-modal');
    if (!modal) {
      onResolve('MAKEUP');
      return;
    }

    document.getElementById('mismatch-student-name').textContent = student.name;
    document.getElementById('mismatch-student-no').textContent = student.id;
    document.getElementById('mismatch-registered-session').textContent = student.session || 'Belirtilmemiş';
    document.getElementById('mismatch-current-session').textContent = activeSession.name;

    this.mismatchCallback = onResolve;
    modal.classList.add('active');
  },

  resolveMismatch(action) {
    const modal = document.getElementById('session-mismatch-modal');
    if (modal) modal.classList.remove('active');

    if (typeof this.mismatchCallback === 'function') {
      this.mismatchCallback(action);
      this.mismatchCallback = null;
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }
};

window.SessionManager = SessionManager;
