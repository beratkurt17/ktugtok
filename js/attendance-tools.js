// Devamsızlık Sorgusu & Toplu Geçmiş Yoklama Girişi
const AttendanceTools = {

  // ─── Yardımcılar ───────────────────────────────────────────────────────────

  escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  populateSessionSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const sessions = Storage.getSessions();
    sel.innerHTML = '<option value="">— Seans Seçin —</option>';
    sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
  },

  // ─── Feature 1: Devamsızlık / Devam Durumu Sorgusu ────────────────────────

  runAbsenceQuery() {
    const term = (document.getElementById('absence-search-input')?.value || '').trim();
    const container = document.getElementById('absence-result-container');
    if (!container) return;

    if (term.length < 2) {
      container.innerHTML = '<p style="color:#94a3b8;margin-top:0.5rem;">En az 2 karakter girin.</p>';
      return;
    }

    const students = Storage.getStudents();
    const lower = term.toLowerCase();
    const matches = students.filter(s =>
      s.id.toLowerCase().includes(lower) ||
      s.name.toLowerCase().includes(lower)
    );

    if (matches.length === 0) {
      container.innerHTML = '<p style="color:#f43f5e;margin-top:0.75rem;">Eşleşen sporcu bulunamadı.</p>';
      return;
    }

    container.innerHTML = matches.slice(0, 6).map(s => this._renderStudentStats(s)).join('');
  },

  _renderStudentStats(student) {
    const MONTH_NAMES = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const TURK_DAYS  = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

    const records = Storage.getAttendance()
      .filter(a => a.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date)); // yeniden eskiye

    let listHtml = '';
    if (records.length === 0) {
      listHtml = '<p style="color:#64748b;font-size:0.88rem;padding:0.5rem 0;">Henüz yoklama kaydı bulunmuyor.</p>';
    } else {
      listHtml = records.map(r => {
        const d       = new Date(r.date);
        const day     = d.getDate();
        const month   = MONTH_NAMES[d.getMonth() + 1];
        const year    = d.getFullYear();
        const dName   = TURK_DAYS[d.getDay()];
        const timeStr = r.time && r.time !== '—' ? r.time : '';
        const izinli  = r.status === 'İzinli';
        const badge   = izinli ? 'İ' : 'G';
        const clr     = izinli ? '#f59e0b' : '#10b981';
        const bg      = izinli ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)';
        const border  = izinli ? 'rgba(245,158,11,0.3)'  : 'rgba(16,185,129,0.3)';
        return `
          <div style="display:flex;align-items:center;gap:0.7rem;padding:0.38rem 0.5rem;
            border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="color:${clr};font-weight:700;font-size:0.85rem;
              background:${bg};border:1px solid ${border};
              padding:0.08rem 0.55rem;border-radius:4px;flex-shrink:0;">${badge}</span>
            <span style="color:#e2e8f0;font-size:0.9rem;">${day} ${month} ${year}</span>
            <span style="color:#64748b;font-size:0.82rem;">${dName}</span>
            ${timeStr ? `<span style="color:#64748b;font-size:0.75rem;margin-left:auto;">${timeStr}</span>` : ''}
          </div>`;
      }).join('');
    }

    return `
      <div style="margin-top:1rem;padding:1rem 1.1rem;background:rgba(255,255,255,0.02);
        border:1px solid var(--border-color);border-radius:var(--radius-md);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;
          flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
          <div>
            <div style="font-size:1.05rem;font-weight:700;color:#fff;">${this.escapeHtml(student.name)}</div>
            <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">
              ${student.id} · ${this.escapeHtml(student.session || 'Seans atanmamış')}
            </div>
          </div>
          <div style="text-align:center;background:rgba(16,185,129,0.07);
            border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:0.35rem 0.9rem;">
            <div style="font-size:1.45rem;font-weight:800;color:#10b981;">${records.length}</div>
            <div style="font-size:0.7rem;color:#94a3b8;">Katılım</div>
          </div>
        </div>
        ${listHtml}
      </div>`;
  },

  // ─── Feature 2: Toplu Geçmiş Yoklama Girişi ───────────────────────────────

  loadBulkStudents() {
    const dateVal   = document.getElementById('bulk-entry-date')?.value;
    const sessionId = document.getElementById('bulk-entry-session')?.value;
    const container = document.getElementById('bulk-entry-students');
    const saveBtn   = document.getElementById('bulk-entry-save');
    if (!container) return;

    if (!dateVal) {
      container.innerHTML = '<p style="color:#f59e0b;">Lütfen bir tarih seçin.</p>';
      if (saveBtn) saveBtn.style.display = 'none';
      return;
    }
    if (!sessionId) {
      container.innerHTML = '<p style="color:#f59e0b;">Lütfen seans seçin.</p>';
      if (saveBtn) saveBtn.style.display = 'none';
      return;
    }

    const session = Storage.getSessionById(sessionId);
    if (!session) return;

    const students = Storage.getStudents()
      .filter(s => (s.session || '').trim().toLowerCase() === (session.name || '').trim().toLowerCase())
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    if (students.length === 0) {
      container.innerHTML = `<p style="color:#f59e0b;">Bu seans için kayıtlı sporcu yok.<br>Sporcu düzenleme ekranından seans ataması yapın.</p>`;
      if (saveBtn) saveBtn.style.display = 'none';
      return;
    }

    const attendance  = Storage.getAttendance();
    const existingIds = new Set(attendance.filter(a => a.date === dateVal).map(a => a.studentId));

    let html = `
      <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-secondary" style="font-size:0.82rem;padding:0.3rem 0.8rem;" onclick="AttendanceTools.bulkCheckAll(true)">Tümünü Seç</button>
        <button class="btn btn-secondary" style="font-size:0.82rem;padding:0.3rem 0.8rem;" onclick="AttendanceTools.bulkCheckAll(false)">Temizle</button>
        <span style="color:#94a3b8;font-size:0.82rem;">${students.length} sporcu · ${this.escapeHtml(session.name)}</span>
      </div>
      <div id="bulk-student-list" style="display:flex;flex-direction:column;gap:0.3rem;">`;

    students.forEach(s => {
      const checked = existingIds.has(s.id);
      html += `
        <label style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;border-radius:6px;cursor:pointer;
          background:${checked ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.01)'};
          border:1px solid ${checked ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'};">
          <input type="checkbox" value="${this.escapeHtml(s.id)}" ${checked ? 'checked' : ''}
            style="width:16px;height:16px;accent-color:#10b981;flex-shrink:0;">
          <span style="font-weight:600;color:#fff;flex:1;">${this.escapeHtml(s.name)}</span>
          <span style="font-size:0.78rem;color:#64748b;">${s.id}</span>
        </label>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    if (saveBtn) saveBtn.style.display = 'block';
  },

  bulkCheckAll(checked) {
    document.getElementById('bulk-student-list')
      ?.querySelectorAll('input[type=checkbox]')
      .forEach(cb => cb.checked = checked);
  },

  saveBulkEntry() {
    const dateVal   = document.getElementById('bulk-entry-date')?.value;
    const sessionId = document.getElementById('bulk-entry-session')?.value;
    if (!dateVal || !sessionId) return;

    const session = Storage.getSessionById(sessionId);
    if (!session) return;

    const list = document.getElementById('bulk-student-list');
    if (!list) return;

    const checkedIds   = new Set([...list.querySelectorAll('input:checked')].map(cb => cb.value));
    const uncheckedIds = new Set([...list.querySelectorAll('input:not(:checked)')].map(cb => cb.value));

    const attendance  = Storage.getAttendance();
    const dateRecords = attendance.filter(a => a.date === dateVal);

    let added = 0, removed = 0;

    checkedIds.forEach(id => {
      if (dateRecords.find(r => r.studentId === id)) return; // zaten var
      const student = Storage.getStudentById(id);
      if (!student) return;
      Storage.addAttendanceRecord({
        recordId:    'REC-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        date:        dateVal,
        time:        '—',
        studentId:   student.id,
        studentName: student.name,
        category:    student.category || 'Genel',
        status:      'Geldi',
        sessionId:   session.id,
        sessionName: session.name,
        isMakeup:    false,
        timestamp:   Date.now()
      });
      added++;
    });

    uncheckedIds.forEach(id => {
      const rec = dateRecords.find(r => r.studentId === id);
      if (!rec) return;
      Storage.removeAttendanceRecord(rec.recordId);
      removed++;
    });

    if (window.AttendanceManager) AttendanceManager.renderTodayList();
    if (window.HistoryManager)    HistoryManager.renderHistory();

    // Listeyi güncelle (mevcut işaretler korunsun)
    this.loadBulkStudents();

    const msg = `${added > 0 ? `${added} giriş eklendi` : ''}${added > 0 && removed > 0 ? ', ' : ''}${removed > 0 ? `${removed} giriş silindi` : ''}`.trim() || 'Değişiklik yok';
    AttendanceManager.showToast(`✅ ${dateVal} — ${msg}`, 'success');
  }
};

window.AttendanceTools = AttendanceTools;
