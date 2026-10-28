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
    const attendance = Storage.getAttendance();
    const records = attendance
      .filter(a => a.studentId === student.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Aylara göre grupla
    const byMonth = {};
    records.forEach(r => {
      const m = r.date.substring(0, 7);
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(r);
    });

    // Öğrencinin seansından haftalık gün çıkar (beklenen seans sayısı için)
    const sessions = Storage.getSessions();
    const session = sessions.find(s =>
      (s.name || '').trim().toLowerCase() === (student.session || '').trim().toLowerCase()
    );
    const DAY_MAP = { PAZARTESI:1, SALI:2, ÇARŞAMBA:3, PERŞEMBE:4, CUMA:5, CUMARTESİ:6, PAZAR:0 };
    const sessionDayNum = session?.day ? (DAY_MAP[session.day.toUpperCase().replace('İ','I')] ?? null) : null;

    const MONTH_NAMES = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const months = Object.keys(byMonth).sort();

    let totalAttended = 0, totalExpected = 0;

    const rows = months.map(m => {
      const [y, mo] = m.split('-').map(Number);
      const attended = byMonth[m].length;
      totalAttended += attended;

      let expected = null;
      if (sessionDayNum !== null) {
        const daysInMonth = new Date(y, mo, 0).getDate();
        let cnt = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(y, mo - 1, d).getDay() === sessionDayNum) cnt++;
        }
        expected = cnt;
        totalExpected += cnt;
      }

      const pct = (expected !== null && expected > 0) ? Math.round(attended / expected * 100) : null;
      const clr = pct === null ? '#94a3b8' : pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e';

      return `<tr style="border-bottom:1px solid var(--border-color);">
        <td style="padding:0.45rem 0.75rem;">${MONTH_NAMES[mo]} ${y}</td>
        <td style="padding:0.45rem 0.75rem;color:#10b981;font-weight:600;">${attended}</td>
        <td style="padding:0.45rem 0.75rem;color:#94a3b8;">${expected ?? '—'}</td>
        <td style="padding:0.45rem 0.75rem;">
          ${pct !== null
            ? `<span style="color:${clr};font-weight:700;">%${pct}</span>`
            : '<span style="color:#64748b;">—</span>'}
        </td>
      </tr>`;
    }).join('');

    const overallPct = totalExpected > 0 ? Math.round(totalAttended / totalExpected * 100) : null;
    const opClr = overallPct === null ? '#94a3b8' : overallPct >= 75 ? '#10b981' : overallPct >= 50 ? '#f59e0b' : '#f43f5e';

    return `
      <div style="margin-top:1rem;padding:1rem 1.1rem;background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:var(--radius-md);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.9rem;">
          <div>
            <div style="font-size:1.05rem;font-weight:700;color:#fff;">${this.escapeHtml(student.name)}</div>
            <div style="font-size:0.8rem;color:#64748b;margin-top:0.15rem;">${student.id} · ${this.escapeHtml(student.session || 'Seans atanmamış')}</div>
          </div>
          ${overallPct !== null ? `
            <div style="text-align:center;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:0.35rem 0.9rem;">
              <div style="font-size:1.45rem;font-weight:800;color:${opClr};">%${overallPct}</div>
              <div style="font-size:0.7rem;color:#94a3b8;">Genel Devam</div>
            </div>` : ''}
        </div>

        ${months.length === 0
          ? '<p style="color:#64748b;font-size:0.88rem;">Henüz yoklama kaydı bulunmuyor.</p>'
          : `<table style="width:100%;border-collapse:collapse;font-size:0.86rem;">
              <thead>
                <tr style="border-bottom:2px solid var(--border-color);color:#64748b;">
                  <th style="padding:0.35rem 0.75rem;text-align:left;">Ay</th>
                  <th style="padding:0.35rem 0.75rem;text-align:left;">Geldi</th>
                  <th style="padding:0.35rem 0.75rem;text-align:left;">Beklenen</th>
                  <th style="padding:0.35rem 0.75rem;text-align:left;">Devam %</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:0.5rem;font-size:0.8rem;color:#64748b;">
              Toplam: ${totalAttended} katılım${totalExpected ? ` / ${totalExpected} beklenen` : ''}
            </div>`}
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
