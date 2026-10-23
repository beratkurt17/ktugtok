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

    const allStudents = Storage.getStudents();
    const allAttendance = Storage.getAttendance();

    const dateRecords = allAttendance.filter(a => a.date === selectedDate);
    const attendedStudentIds = new Set(dateRecords.map(r => r.studentId));

    const attendedCount = dateRecords.length;
    const totalCount = allStudents.length;
    const percentage = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;

    if (summaryEl) {
      summaryEl.innerHTML = `
        <span style="color: #10b981; font-weight: bold;">${attendedCount} Katılım</span> / ${totalCount} Kayıtlı Sporcu 
        <span style="color: var(--gold); margin-left: 0.5rem;">(Katılım Oranı: %${percentage})</span>
      `;
    }

    if (allStudents.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Kayıtlı sporcu bulunmuyor.</p></div>';
      return;
    }

    // Tablo görünümü
    let html = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
            <th style="padding: 0.75rem 0.5rem;">Sporcu</th>
            <th style="padding: 0.75rem 0.5rem;">Kategori</th>
            <th style="padding: 0.75rem 0.5rem;">Durum</th>
            <th style="padding: 0.75rem 0.5rem;">Giriş Saati</th>
            <th style="padding: 0.75rem 0.5rem; text-align: right;">İşlem</th>
          </tr>
        </thead>
        <tbody>
    `;

    allStudents.forEach(student => {
      const record = dateRecords.find(r => r.studentId === student.id);
      const isAttended = !!record;

      html += `
        <tr style="border-bottom: 1px solid var(--border-color); ${isAttended ? 'background: rgba(16, 185, 129, 0.03);' : ''}">
          <td style="padding: 0.75rem 0.5rem;">
            <strong>${StudentsManager.escapeHtml(student.name)}</strong>
            <div style="font-size: 0.75rem; color: #64748b;">${student.id}</div>
          </td>
          <td style="padding: 0.75rem 0.5rem;">
            <span class="badge-category">${StudentsManager.escapeHtml(student.category || 'Genel')}</span>
          </td>
          <td style="padding: 0.75rem 0.5rem;">
            ${isAttended 
              ? `<span style="color: #10b981; font-weight: 700; background: rgba(16,185,129,0.1); padding: 0.2rem 0.6rem; border-radius: 6px; border: 1px solid rgba(16,185,129,0.2);">✓ Geldi</span>`
              : `<span style="color: #f43f5e; font-weight: 600; background: rgba(244,63,94,0.1); padding: 0.2rem 0.6rem; border-radius: 6px; border: 1px solid rgba(244,63,94,0.2);">✕ Gelmedi</span>`}
          </td>
          <td style="padding: 0.75rem 0.5rem; font-family: monospace;">
            ${isAttended ? record.time : '-'}
          </td>
          <td style="padding: 0.75rem 0.5rem; text-align: right;">
            ${isAttended
              ? `<button class="btn btn-danger btn-icon-only" title="Gelmedi Olarak Değiştir" onclick="HistoryManager.toggleAttendance('${student.id}', '${selectedDate}', false, '${record.recordId}')">✕</button>`
              : `<button class="btn btn-success" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;" onclick="HistoryManager.toggleAttendance('${student.id}', '${selectedDate}', true)">+ Geldi Yap</button>`}
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  toggleAttendance(studentId, date, markAsAttended, recordId) {
    if (markAsAttended) {
      const student = Storage.getStudentById(studentId);
      if (!student) return;
      const now = new Date();
      const currentTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const newRec = {
        recordId: 'REC-' + Date.now(),
        date: date,
        time: currentTime,
        studentId: student.id,
        studentName: student.name,
        category: student.category || 'Genel',
        status: 'Geldi',
        timestamp: Date.now()
      };
      Storage.addAttendanceRecord(newRec);
    } else {
      if (recordId) {
        Storage.removeAttendanceRecord(recordId);
      }
    }

    this.renderHistory();
    if (window.AttendanceManager) window.AttendanceManager.renderTodayList();
  }
};

window.HistoryManager = HistoryManager;
