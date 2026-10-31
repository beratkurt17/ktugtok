// Excel (.xlsx / .csv) Dışa & İçe Aktarım Motoru (SheetJS)
const ExcelExporter = {
  // Excel kütüphanesinin (SheetJS) varlığını garantiye alan yardımcı
  async ensureXLSX() {
    if (window.XLSX) return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload = () => resolve(!!window.XLSX);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  // Yardımcı: SheetJS ile dosyayı XLSX veya CSV olarak indir (Türkçe karakterler için UTF-8 BOM destekli)
  saveFile(wb, ws, baseFilename, format = 'xlsx') {
    if (format === 'csv') {
      const csvStr = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFilename}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, `${baseFilename}.xlsx`);
    }
  },

  // 1. Sporcu Devam Raporu — Her seans için ayrı sayfa, hafta hafta G listesi
  async exportAttendanceReport(format = 'xlsx') {
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }

    const sessions   = Storage.getSessions();
    const students   = Storage.getStudents();
    const attendance = Storage.getAttendance();
    const settings   = Storage.getSettings();
    const todayDate  = new Date(); todayDate.setHours(0,0,0,0);
    const todayStr   = todayDate.toISOString().slice(0, 10);

    // Seans gününden (SALI, ÇARŞAMBA...) JS gün numarasına çevirici
    const DAY_MAP = { PAZARTESI:1, PAZARTESİ:1, SALI:2, ÇARŞAMBA:3, CARSAMBA:3,
                      PERŞEMBE:4, PERSEMBE:4, CUMA:5, CUMARTESİ:6, CUMARTESI:6, PAZAR:0 };

    // Seansın başlangıcından bugüne tüm haftalık tarihleri üret
    function getWeekDates(session, sesStudents) {
      const raw = (session.day || '').toUpperCase()
        .replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ö/g,'O').replace(/Ü/g,'U');
      const dayNum = DAY_MAP[raw] ?? null;

      const studentIds = new Set(sesStudents.map(s => s.id));
      const sesRecs = attendance.filter(a => studentIds.has(a.studentId));

      if (sesRecs.length === 0) return [];

      // En erken kayıt tarihini bul
      const earliest = sesRecs.map(a => a.date).sort()[0];

      if (dayNum === null) {
        // Gün bilgisi yoksa sadece kayıtlı tarihler
        return [...new Set(sesRecs.map(a => a.date))].sort();
      }

      // earliest'ten itibaren seansın gününe (dayNum) atla, sonra haftalık ilerle
      const cursor = new Date(earliest);
      while (cursor.getDay() !== dayNum) cursor.setDate(cursor.getDate() + 1);

      const dates = [];
      while (cursor <= todayDate) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 7);
      }
      return dates;
    }

    const wb = XLSX.utils.book_new();
    let sheetsAdded = 0;

    for (const session of sessions) {
      const sesStudents = students
        .filter(s => (s.session || '').trim().toLowerCase() === (session.name || '').trim().toLowerCase())
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

      if (sesStudents.length === 0) continue;

      const weekDates = getWeekDates(session, sesStudents);
      if (weekDates.length === 0) continue;

      const weekCount = weekDates.length;
      const sesDay    = session.day  || '';
      const sesTime   = session.time || '';

      const titleRow = [`${settings.clubName || 'GTOK'} — SPORCU DEVAM RAPORU — ${session.name}${sesDay ? ` (${sesDay}${sesTime ? ' ' + sesTime : ''})` : ''}`];
      const infoRow  = [`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Toplam ${weekCount} Hafta`];

      const headers = ['No', 'İsim Soyisim', 'Seans',
        ...weekDates.map((d, i) => `${i + 1}. Hafta\n${d.slice(5).replace('-','/')}`),
        'Katılım\n(Gün)', 'Katılım\nOranı'
      ];

      // date → kayıt haritası (status için)
      const recMap = {};
      attendance.filter(a => studentIds.has(a.studentId)).forEach(a => { recMap[a.studentId + '|' + a.date] = a; });

      const weeklyCount = new Array(weekCount).fill(0);
      const studentRows = sesStudents.map((st, idx) => {
        const marks = weekDates.map((d, wi) => {
          const rec = recMap[st.id + '|' + d];
          if (!rec) return '';
          if (rec.status === 'İzinli') return 'İ';
          weeklyCount[wi]++;
          return 'G';
        });
        const totalDays = marks.filter(m => m === 'G').length;
        const rate = `%${Math.round(totalDays / weekCount * 100)}`;
        return [idx + 1, st.name, sesTime || session.name, ...marks, totalDays, rate];
      });

      const footerRow = ['', 'Haftalık Katılan Sporcu Sayısı', '',
        ...weeklyCount, weeklyCount.reduce((a, b) => a + b, 0), ''
      ];

      const wsData = [titleRow, infoRow, [], headers, ...studentRows, [], footerRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const colWidths = [{ wch: 5 }, { wch: 26 }, { wch: 18 }];
      weekDates.forEach(() => colWidths.push({ wch: 10 }));
      colWidths.push({ wch: 10 }, { wch: 10 });
      ws['!cols'] = colWidths;

      const sheetName = (session.name || `Seans${sheetsAdded + 1}`)
        .slice(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      sheetsAdded++;
    }

    if (sheetsAdded === 0) {
      alert('Henüz yoklama kaydı bulunamadı.');
      return;
    }

    XLSX.writeFile(wb, `${settings.clubCode || 'GTOK'}_Sporcu_Devam_Raporu_${todayStr}.xlsx`);
  },

  // 2. Resmi Kulüp Matris Çizelgesi (Satırlarda Sporcular, Sütunlarda Günler)
  async exportMatrix(format = 'xlsx') {
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }

    const monthInput = document.getElementById('excel-month-select')?.value || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = monthInput.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12

    // Seçilen aydaki gün sayısı
    const daysInMonth = new Date(year, month, 0).getDate();

    const students = Storage.getStudents();
    const attendance = Storage.getAttendance();
    const settings = Storage.getSettings();

    // Matris Başlıkları
    const headers = ['Sıra', 'Sporcu No', 'Adı Soyadı', 'Kategori'];
    for (let day = 1; day <= daysInMonth; day++) {
      headers.push(`${day}`);
    }
    headers.push('Toplam Katılım');

    // Satır Verileri
    const rows = [];
    students.forEach((student, index) => {
      const row = [
        index + 1,
        student.id,
        student.name,
        student.category || 'Genel'
      ];

      let studentTotal = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayFormatted = String(day).padStart(2, '0');
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${dayFormatted}`;

        const attended = attendance.some(a => a.studentId === student.id && a.date === dateStr);
        if (attended) {
          row.push('G'); // Geldi
          studentTotal++;
        } else {
          row.push('-'); // Gelmedi
        }
      }

      row.push(studentTotal);
      rows.push(row);
    });

    // Başlık ve Bilgi Satırları
    const monthNames = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const titleRow = [`${settings.clubName || 'OKÇULUK KULÜBÜ'} - AYLIK RESMİ YOKLAMA ÇİZELGESİ`];
    const subTitleRow = [`Dönem: ${monthNames[month]} ${year} | Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`];
    const emptyRow = [];

    const worksheetData = [
      titleRow,
      subTitleRow,
      emptyRow,
      headers,
      ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Sütun genişlikleri
    const colWidths = [
      { wch: 6 },  // Sıra
      { wch: 14 }, // No
      { wch: 24 }, // İsim
      { wch: 22 }  // Kategori
    ];
    for (let i = 1; i <= daysInMonth; i++) {
      colWidths.push({ wch: 4 });
    }
    colWidths.push({ wch: 14 }); // Toplam
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthNames[month]}_Yoklama`);

    const filename = `${settings.clubCode || 'GTOK'}_Yoklama_Cizelgesi_${year}_${String(month).padStart(2, '0')}`;
    this.saveFile(wb, ws, filename, format);
  },

  // 2. Detaylı Liste (Zaman Damgalı Ham Liste)
  async exportDetailedList(format = 'xlsx') {
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }

    const attendance = [...Storage.getAttendance()]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    const settings = Storage.getSettings();

    const headers = ['Kayıt ID', 'Tarih', 'Giriş Saati', 'Sporcu No', 'Adı Soyadı', 'Kategori', 'Seans', 'Durum'];
    const rows = attendance.map(a => [
      a.recordId || '-',
      a.date,
      a.time,
      a.studentId,
      a.studentName,
      a.category,
      a.sessionName || '-',
      a.status || 'Geldi'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 24 },
      { wch: 20 },
      { wch: 26 },
      { wch: 10 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detayli_Yoklama_Kayitlari');

    const filename = `${settings.clubCode || 'GTOK'}_Tum_Yoklama_Kayitlari_${new Date().toISOString().slice(0, 10)}`;
    this.saveFile(wb, ws, filename, format);
  },

  // 3. Her Ders / Seans için Ayrı Sheet — Aylık Matris
  async exportMatrixBySession() {
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }

    const monthInput = document.getElementById('excel-month-select')?.value || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = monthInput.split('-');
    const year  = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const sessions   = Storage.getSessions();
    const students   = Storage.getStudents();
    const attendance = Storage.getAttendance();
    const settings   = Storage.getSettings();

    const monthNames = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

    const wb = XLSX.utils.book_new();
    let sheetsAdded = 0;

    for (const session of sessions) {
      const sesStudents = students.filter(s =>
        (s.session || '').trim().toLowerCase() === (session.name || '').trim().toLowerCase()
      ).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

      if (sesStudents.length === 0) continue;

      const titleRow   = [`${settings.clubName || 'OKÇULUK KULÜBÜ'} — ${session.name} — AYLIK YOKLAMA ÇİZELGESİ`];
      const subTitle   = [`Dönem: ${monthNames[month]} ${year}  |  Rapor: ${new Date().toLocaleDateString('tr-TR')}`];
      const headers    = ['Sıra', 'Sporcu No', 'Adı Soyadı', 'Kategori'];
      for (let d = 1; d <= daysInMonth; d++) headers.push(`${d}`);
      headers.push('Toplam');

      const rows = sesStudents.map((st, idx) => {
        const row = [idx + 1, st.id, st.name, st.category || 'Genel'];
        let total = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const came = attendance.some(a => a.studentId === st.id && a.date === dateStr);
          row.push(came ? 'G' : '-');
          if (came) total++;
        }
        row.push(total);
        return row;
      });

      const wsData = [titleRow, subTitle, [], headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const colWidths = [{ wch: 6 }, { wch: 14 }, { wch: 26 }, { wch: 22 }];
      for (let d = 0; d < daysInMonth; d++) colWidths.push({ wch: 4 });
      colWidths.push({ wch: 8 });
      ws['!cols'] = colWidths;

      const sheetName = (session.name || `Seans${sheetsAdded + 1}`)
        .slice(0, 31)
        .replace(/[:\\\/\?\*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      sheetsAdded++;
    }

    if (sheetsAdded === 0) {
      alert('Hiçbir seans için sporcu bulunamadı.\nÖnce sporculara seans (ders grubu) atayın.');
      return;
    }

    const filename = `${settings.clubCode || 'GTOK'}_Ders_Bazli_Yoklama_${year}_${String(month).padStart(2,'0')}.xlsx`;
    XLSX.writeFile(wb, filename);
  },

  // 4. Tüm Kayıtlı Üyeleri / Okçuları Dışa Aktar (CSV veya XLSX)
  async exportStudents(format = 'csv') {
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }

    const students = Storage.getStudents();
    const settings = Storage.getSettings();

    const headers = ['Okçu No', 'Adı Soyadı', 'Rol / Görev', 'Antrenman Seansı / Grubu', 'Fakülte', 'Bölüm', 'Telefon', 'Kategori', 'Notlar'];
    const rows = students.map(s => [
      s.id || '',
      s.name || '',
      s.role || '',
      s.session || '',
      s.faculty || '',
      s.department || '',
      s.phone || '',
      s.category || 'Geleneksel Türk Okçuluğu',
      s.notes || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 24 },
      { wch: 22 },
      { wch: 26 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 24 },
      { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Okcular_Listesi');

    const filename = `${settings.clubCode || 'GTOK'}_Uye_Listesi_${new Date().toISOString().slice(0, 10)}`;
    this.saveFile(wb, ws, filename, format);
  },

  // 5. Excel (.xlsx / .xls / .csv) Dosyasından Toplu Okçu / Sporcu İçe Aktarma
  async importStudentsFromFile(file) {
    if (!file) return;
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          alert('Hata: Excel dosyasında sayfa bulunamadı.');
          return;
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (!rawRows || rawRows.length < 1) {
          alert('Excel dosyası boş görünüyor.');
          return;
        }

        // 1. Akıllı Başlık Satırı Analizi
        let headerRowIndex = -1;
        const colMap = {
          name: -1,
          id: -1,
          role: -1,
          session: -1,
          faculty: -1,
          department: -1,
          category: -1,
          phone: -1,
          notes: -1
        };

        const normalize = (txt) => String(txt || '').trim().toLowerCase()
          .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');

        for (let r = 0; r < Math.min(10, rawRows.length); r++) {
          const row = (rawRows[r] || []).map(normalize);
          const hasName = row.some(cell => cell.includes('ad') || cell.includes('isim') || cell.includes('name'));
          if (hasName) {
            headerRowIndex = r;
            row.forEach((cell, idx) => {
              if (cell.includes('ad soyad') || cell.includes('adi soyadi') || cell.includes('isim soyisim') || cell === 'ad' || cell === 'isim' || cell === 'name' || cell.includes('ogrenci adi') || cell.includes('sporcu adi') || cell.includes('uye adi')) {
                if (colMap.name === -1) colMap.name = idx;
              } else if (cell.includes('okcu no') || cell.includes('kulup no') || cell.includes('sicil') || cell.includes('ogrenci no') || cell.includes('okul no') || cell === 'no' || cell === 'id') {
                if (colMap.id === -1) colMap.id = idx;
              } else if (cell.includes('rol') || cell.includes('gorev') || cell.includes('unvan') || cell.includes('yk') || cell.includes('baskan')) {
                if (colMap.role === -1) colMap.role = idx;
              } else if (cell.includes('seans') || cell.includes('antrenman saati') || cell.includes('antrenman') || cell.includes('tercih ettiginiz saat') || cell.includes('tercih saati') || (cell.includes('saat') && !cell.includes('giris'))) {
                if (colMap.session === -1) colMap.session = idx;
              } else if (cell.includes('fakulte')) {
                if (colMap.faculty === -1) colMap.faculty = idx;
              } else if (cell.includes('bolum')) {
                if (colMap.department === -1) colMap.department = idx;
              } else if (cell.includes('kategori') || cell.includes('brans')) {
                if (colMap.category === -1) colMap.category = idx;
              } else if (cell.includes('telefon') || cell.includes('tel') || cell.includes('gsm') || cell.includes('phone') || cell.includes('iletisim')) {
                if (colMap.phone === -1) colMap.phone = idx;
              } else if (cell.includes('not') || cell.includes('ekipman') || cell.includes('yay')) {
                if (colMap.notes === -1) colMap.notes = idx;
              }
            });
            break;
          }
        }

        // Başlık bulunamadıysa ilk sütunu isim say
        const startRow = (headerRowIndex >= 0) ? headerRowIndex + 1 : 0;
        if (colMap.name === -1) {
          colMap.name = 0;
        }

        // Mevcut sporcuları al ve sıradaki otomatik no'yu hesapla
        const existingStudents = [...Storage.getStudents()];
        let nextAutoId = 1;
        existingStudents.forEach(s => {
          const m = (s.id || '').trim().match(/^0*(\d+)$/);
          if (m) {
            const num = parseInt(m[1], 10);
            if (!isNaN(num) && num >= nextAutoId && num < 100000) {
              nextAutoId = num + 1;
            }
          }
        });

        let importedCount = 0;
        let updatedCount = 0;
        const discoveredSessions = new Set();

        for (let i = startRow; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const rawName = colMap.name >= 0 ? String(row[colMap.name] || '').trim() : '';
          if (!rawName || rawName.length < 2) continue; // Başlık veya boşluk

          let rawId = colMap.id >= 0 ? String(row[colMap.id] || '').trim() : '';
          if (!rawId) {
            rawId = String(nextAutoId++).padStart(4, '0');
          } else {
            // Eğer düz bir sayıysa 4 haneli yap (örn: 1 -> 0001)
            const numMatch = rawId.match(/^0*(\d+)$/);
            if (numMatch && parseInt(numMatch[1], 10) < 10000) {
              rawId = String(parseInt(numMatch[1], 10)).padStart(4, '0');
            }
          }

          const role = colMap.role >= 0 ? String(row[colMap.role] || '').trim() : '';
          const session = colMap.session >= 0 ? String(row[colMap.session] || '').trim() : '';
          if (session) discoveredSessions.add(session);

          const faculty = colMap.faculty >= 0 ? String(row[colMap.faculty] || '').trim() : '';
          const department = colMap.department >= 0 ? String(row[colMap.department] || '').trim() : '';
          const category = (colMap.category >= 0 && row[colMap.category]) ? String(row[colMap.category]).trim() : 'Geleneksel Türk Okçuluğu';
          const phone = colMap.phone >= 0 ? String(row[colMap.phone] || '').trim() : '';
          const notes = colMap.notes >= 0 ? String(row[colMap.notes] || '').trim() : '';

          const studentObj = {
            id: rawId,
            name: rawName,
            role,
            session,
            faculty,
            department,
            category,
            phone,
            notes
          };

          // Var olanı kontrol et
          const existingIdx = existingStudents.findIndex(s => s.id === rawId || s.name.toLowerCase() === rawName.toLowerCase());
          if (existingIdx >= 0) {
            existingStudents[existingIdx] = { ...existingStudents[existingIdx], ...studentObj };
            updatedCount++;
          } else {
            existingStudents.push(studentObj);
            importedCount++;
          }
        }

        if (importedCount === 0 && updatedCount === 0) {
          alert('Seçilen Excel dosyasından aktarılacak sporcu satırı bulunamadı.');
          return;
        }

        // Excel'den yeni seanslar geldiyse otomatik sisteme ekle
        if (discoveredSessions.size > 0) {
          const currentSessions = Storage.getSessions();
          const currentNames = new Set(currentSessions.map(s => s.name.trim().toLowerCase()));
          discoveredSessions.forEach(sessName => {
            if (sessName && !currentNames.has(sessName.trim().toLowerCase())) {
              Storage.addSession({
                id: 'SES-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                name: sessName,
                date: new Date().toISOString().slice(0, 10),
                startTime: '',
                endTime: '',
                notes: 'Google Form İçe Aktarımı'
              });
            }
          });
          if (window.SessionManager) {
            SessionManager.renderSessionSelector();
            SessionManager.renderSessionFilter();
          }
        }

        // Yerel kaydet
        Storage.saveStudents(existingStudents, false);

        // Supabase bağlıysa buluta da aktar
        let cloudSynced = false;
        if (window.SupabaseDB && window.SupabaseDB.isConnected) {
          try {
            await window.SupabaseDB.uploadLocalDataToSupabase(existingStudents, Storage.getAttendance(), Storage.getSettings());
            cloudSynced = true;
          } catch (err) {
            console.warn('Supabase aktarım uyarısı:', err);
          }
        }

        // UI Güncelle
        if (window.StudentsManager) StudentsManager.renderStudentsList();
        if (window.confetti) {
          window.confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        }

        let msg = `✅ Excel Aktarımı Tamamlandı!\n\n- ${importedCount} Yeni Okçu Eklendi\n- ${updatedCount} Mevcut Okçu Güncellendi\n- Sistemdeki Toplam Okçu: ${existingStudents.length}`;
        if (cloudSynced) {
          msg += '\n- ☁️ Tüm liste anında Supabase bulut veritabanına eşitlendi!';
        }
        alert(msg);

      } catch (err) {
        console.error('Excel okuma hatası:', err);
        alert('Excel dosyası işlenirken hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
      }
    };

    reader.readAsArrayBuffer(file);
  },

  async downloadTemplate(format = 'xlsx') {
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }
    const headers = ['Okçu No', 'Ad Soyad', 'Bölüm', 'Fakülte', 'Telefon', 'Not'];
    const sampleRows = [
      ['0001', 'Ahmet Yılmaz', 'Bilgisayar Mühendisliği', 'Mühendislik Fakültesi', '05551234567', 'Geleneksel Okçu'],
      ['0002', 'Ayşe Demir', 'Hukuk', 'Hukuk Fakültesi', '05559876543', 'Kulüp Lisanslı'],
      ['', 'Mehmet Kaya', 'Tıp Fakültesi', 'Tıp', '05550001122', 'No boş bırakılırsa otomatik 0003, 0004... atanır']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 26 },
      { wch: 24 },
      { wch: 16 },
      { wch: 44 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Uye_Sablonu');
    this.saveFile(wb, ws, 'GTOK_Uye_Yukleme_Sablonu', format);
  },

  // Seansa Özel Yoklama Listesini Excel / CSV İndir
  async exportSessionAttendance(sessionId, format = 'xlsx') {
    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi. Lütfen sayfayı yenileyiniz.');
      return;
    }

    const session = Storage.getSessionById(sessionId);
    if (!session) return;

    const students = Storage.getStudents();
    const assignedStudents = students.filter(s => (s.session || '').trim().toLowerCase() === (session.name || '').trim().toLowerCase());
    const today = new Date().toISOString().slice(0, 10);
    const attendance = Storage.getAttendance();

    const headers = ['Sıra', 'Kulüp / Okçu No', 'Adı Soyadı', 'Fakülte', 'Bölüm', 'Telefon', 'Seans Grubu', 'Yoklama Tarihi', 'Giriş Saati', 'Yoklama Durumu'];
    const rows = [];

    assignedStudents.forEach((st, idx) => {
      const rec = attendance.find(a => a.studentId === st.id && a.date === today);
      rows.push([
        idx + 1,
        st.id,
        st.name,
        st.faculty || '',
        st.department || '',
        st.phone || '',
        session.name,
        today,
        rec ? rec.time : '-',
        rec ? (rec.status || 'Geldi') : 'Gelmedi'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 24 },
      { wch: 22 },
      { wch: 22 },
      { wch: 16 },
      { wch: 28 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    const cleanSheetName = (session.name || 'Seans').slice(0, 30).replace(/[:\\\/\?\*\[\]]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);

    const safeFilename = `GTOK_Yoklama_${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_${today}`;
    this.saveFile(wb, ws, safeFilename, format);
  },

  // Doğrudan belirli bir seansa Excel'den öğrenci aktarma
  async importStudentsToSession(sessionId, file) {
    const session = Storage.getSessionById(sessionId);
    if (!session) return;

    if (!window.XLSX && !(await this.ensureXLSX())) {
      alert('Excel kütüphanesi yüklenemedi.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows || rows.length === 0) {
          alert('Excel dosyasında satır bulunamadı.');
          return;
        }

        const existingStudents = Storage.getStudents();
        let addedCount = 0;

        rows.forEach(row => {
          const name = (row['Adı Soyadı'] || row['Ad Soyad'] || row['İsim'] || row['AD SOYAD'] || row['Adı'] || Object.values(row)[1] || '').toString().trim();
          if (!name) return;

          let id = (row['Kulüp / Okçu No'] || row['Okçu No'] || row['Öğrenci No'] || row['No'] || Object.values(row)[0] || '').toString().trim();
          if (!id) {
            id = StudentsManager.getNextStudentId();
          }

          const faculty = (row['Fakülte'] || row['FAKÜLTE'] || '').toString().trim();
          const department = (row['Bölüm'] || row['BÖLÜM'] || '').toString().trim();
          const phone = (row['Telefon'] || row['Telefon Numarası'] || '').toString().trim();

          const existingIndex = existingStudents.findIndex(s => s.id.toUpperCase() === id.toUpperCase());
          if (existingIndex !== -1) {
            existingStudents[existingIndex].session = session.name;
          } else {
            existingStudents.push({
              id,
              name,
              faculty,
              department,
              category: 'Geleneksel Türk Okçuluğu',
              phone,
              role: '',
              session: session.name,
              notes: ''
            });
          }
          addedCount++;
        });

        Storage.saveStudents(existingStudents, false);

        if (window.SessionManager) {
          SessionManager.renderSessionsGrid();
          SessionManager.renderDetailStudentsList(sessionId);
        }
        if (window.StudentsManager) {
          StudentsManager.renderStudentsList();
        }

        alert(`✅ "${session.name}" seansına ${addedCount} sporcu başarıyla aktarıldı!`);

      } catch (err) {
        console.error('Seans Excel hatası:', err);
        alert('Excel işlenirken hata oluştu: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  handleSessionExcelImport(inputEl) {
    if (inputEl && inputEl.files && inputEl.files[0]) {
      this.importStudentsFromFile(inputEl.files[0]);
      inputEl.value = '';
    }
  },

  handleFileInput(inputEl) {
    if (inputEl && inputEl.files && inputEl.files[0]) {
      this.importStudentsFromFile(inputEl.files[0]);
      inputEl.value = ''; // Reset input
    }
  }
};

window.ExcelExporter = ExcelExporter;
