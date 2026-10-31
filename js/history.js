// Geçmiş Günler Yoklama İnceleme & Raporlama
const HistoryManager = {
  init() {
    this.renderHistory();
    this.setupListeners();
  },

  setupListeners() {
    const dateInput = document.getElementById('history-date-picker');
    if (dateInput) {
      dateInput.addEventListener('change', () => this.renderHistory());
    }
  },

  renderHistory() {
    const dateInput = document.getElementById('history-date-picker');
    const container = document.getElementById('history-list-container');
    const summaryEl = document.getElementById('history-summary-text');
    if (!container || !dateInput) return;

    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    const allStudents  = Storage.getStudents();
    const allAttendance = Storage.getAttendance();
    const dateRecords  = allAttendance.filter(a => a.date === selectedDate);

    const geldiCount   = dateRecords.filter(r => (r.status || 'Geldi') !== 'İzinli').length;
    const izinliCount  = dateRecords.filter(r => r.status === 'İzinli').length;
    const totalCount   = allStudents.length;
    const percentage   = totalCount > 0 ? Math.round((geldiCount / totalCount) * 100) : 0;

    if (summaryEl) {
      summaryEl.innerHTML = `
        <span style="color:#10b981;font-weight:bold;">${geldiCount} Geldi</span>
        ${izinliCount > 0 ? `· <span style="color:#f59e0b;font-weight:600;">${izinliCount} İzinli</span>` : ''}
        / ${totalCount} Kayıtlı Sporcu
        <span style="color:var(--gold);margin-left:0.5rem;">(Katılım Oranı: %${percentage})</span>
      `;
    }

    if (allStudents.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Kayıtlı sporcu bulunmuyor.</p></div>';
      return;
    }

    let html = `
      <table style="width:100%;border-collapse:collapse;text-align:left;font-size:0.9rem;">
        <thead>
          <tr style="border-bottom:2px solid var(--border-color);color:var(--text-muted);">
            <th style="padding:0.75rem 0.5rem;">Sporcu</th>
            <th style="padding:0.75rem 0.5rem;">Kategori</th>
            <th style="padding:0.75rem 0.5rem;">Durum</th>
            <th style="padding:0.75rem 0.5rem;">Saat</th>
            <th style="padding:0.75rem 0.5rem;text-align:right;">İşlem</th>
          </tr>
        </thead>
        <tbody>
    `;

    allStudents.forEach(student => {
      const record = dateRecords.find(r => r.studentId === student.id);
      const status = record ? (record.status || 'Geldi') : null;

      // Satır arka plan rengi
      const rowBg = status === 'Geldi'   ? 'background:rgba(16,185,129,0.03);'
                  : status === 'İzinli'  ? 'background:rgba(245,158,11,0.04);'
                  : '';

      // Durum rozeti
      const statusBadge = status === 'Geldi'
        ? `<span style="color:#10b981;font-weight:700;background:rgba(16,185,129,0.1);padding:0.2rem 0.6rem;border-radius:6px;border:1px solid rgba(16,185,129,0.2);">G Geldi</span>`
        : status === 'İzinli'
        ? `<span style="color:#f59e0b;font-weight:700;background:rgba(245,158,11,0.1);padding:0.2rem 0.6rem;border-radius:6px;border:1px solid rgba(245,158,11,0.2);">İ İzinli</span>`
        : `<span style="color:#64748b;font-weight:600;padding:0.2rem 0.6rem;border-radius:6px;border:1px solid rgba(100,116,139,0.2);">— Gelmedi</span>`;

      // İşlem butonları
      let actionBtns = '';
      if (!record) {
        actionBtns = `
          <button class="btn btn-success" style="padding:0.22rem 0.55rem;font-size:0.78rem;" onclick="HistoryManager.setStatus('${student.id}','${selectedDate}','Geldi')">G Geldi</button>
          <button class="btn btn-secondary" style="padding:0.22rem 0.55rem;font-size:0.78rem;color:#f59e0b;border-color:rgba(245,158,11,0.3);" onclick="HistoryManager.setStatus('${student.id}','${selectedDate}','İzinli')">İ İzinli</button>
        `;
      } else if (status === 'Geldi') {
        actionBtns = `
          <button class="btn btn-secondary" style="padding:0.22rem 0.55rem;font-size:0.78rem;color:#f59e0b;border-color:rgba(245,158,11,0.3);" onclick="HistoryManager.setStatus('${student.id}','${selectedDate}','İzinli','${record.recordId}')">İ İzinli</button>
          <button class="btn btn-danger btn-icon-only" title="Kaldır" onclick="HistoryManager.setStatus('${student.id}','${selectedDate}',null,'${record.recordId}')">✕</button>
        `;
      } else if (status === 'İzinli') {
        actionBtns = `
          <button class="btn btn-success" style="padding:0.22rem 0.55rem;font-size:0.78rem;" onclick="HistoryManager.setStatus('${student.id}','${selectedDate}','Geldi','${record.recordId}')">G Geldi</button>
          <button class="btn btn-danger btn-icon-only" title="Kaldır" onclick="HistoryManager.setStatus('${student.id}','${selectedDate}',null,'${record.recordId}')">✕</button>
        `;
      }

      html += `
        <tr style="border-bottom:1px solid var(--border-color);${rowBg}">
          <td style="padding:0.75rem 0.5rem;">
            <strong>${StudentsManager.escapeHtml(student.name)}</strong>
            <div style="font-size:0.75rem;color:#64748b;">${student.id}</div>
          </td>
          <td style="padding:0.75rem 0.5rem;">
            <span class="badge-category">${StudentsManager.escapeHtml(student.category || 'Genel')}</span>
          </td>
          <td style="padding:0.75rem 0.5rem;">${statusBadge}</td>
          <td style="padding:0.75rem 0.5rem;font-family:monospace;">${record ? (record.time || '—') : '-'}</td>
          <td style="padding:0.75rem 0.5rem;text-align:right;white-space:nowrap;display:flex;gap:0.35rem;justify-content:flex-end;">${actionBtns}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  setStatus(studentId, date, newStatus, existingRecordId) {
    // Önce mevcut kaydı sil
    if (existingRecordId) {
      Storage.removeAttendanceRecord(existingRecordId);
    }

    // null ise sadece silmek istedi — bitti
    if (newStatus) {
      const student = Storage.getStudentById(studentId);
      if (!student) return;
      const sessions = Storage.getSessions();
      const session  = sessions.find(s => (s.name||'').trim().toLowerCase() === (student.session||'').trim().toLowerCase());
      Storage.addAttendanceRecord({
        recordId:    'REC-' + Date.now() + '-' + Math.random().toString(36).slice(2,5),
        date,
        time:        newStatus === 'Geldi' ? new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : '—',
        studentId:   student.id,
        studentName: student.name,
        category:    student.category || 'Genel',
        status:      newStatus,
        sessionId:   session?.id   || '',
        sessionName: session?.name || '',
        isMakeup:    false,
        timestamp:   Date.now()
      });
    }

    this.renderHistory();
    if (window.AttendanceManager) window.AttendanceManager.renderTodayList();
  },

  // Geriye dönük uyumluluk
  toggleAttendance(studentId, date, markAsAttended, recordId) {
    this.setStatus(studentId, date, markAsAttended ? 'Geldi' : null, recordId);
  }
};

window.HistoryManager = HistoryManager;
