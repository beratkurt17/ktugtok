// KTÜ GTOK Veri Saklama ve Yönetim Katmanı (LocalStorage + Supabase Hibrit)
const STORAGE_KEYS = {
  STUDENTS: 'gtok_students_data_v2',
  ATTENDANCE: 'gtok_attendance_data',
  SETTINGS: 'gtok_settings_data_v2',
  ROLES: 'gtok_member_roles_v2',
  SESSIONS: 'gtok_training_sessions_v1',
  ACTIVE_SESSION: 'gtok_active_session_id'
};

const DEFAULT_SETTINGS = {
  clubName: 'Karadeniz Teknik Üniversitesi Geleneksel Türk Okçuluk Kulübü',
  clubCode: 'KTÜ GTOK',
  soundEnabled: true,
  cameraFacing: 'environment'
};

const DEFAULT_SESSIONS = (typeof OFFICIAL_SESSIONS !== 'undefined' && Array.isArray(OFFICIAL_SESSIONS)) 
  ? OFFICIAL_SESSIONS 
  : [
    { id: 'SES-SALI-1', code: 'SALI 1', name: 'SALI 1 (17:15 - 18:15)', startTime: '17:15', endTime: '18:15', day: 'SALI', location: 'Hasan Polat Spor Salonu' },
    { id: 'SES-SALI-2', code: 'SALI 2', name: 'SALI 2 (18:25 - 19:25)', startTime: '18:25', endTime: '19:25', day: 'SALI', location: 'Hasan Polat Spor Salonu' },
    { id: 'SES-CARS-1', code: 'ÇARŞAMBA 1', name: 'ÇARŞAMBA 1 (17:15 - 18:15)', startTime: '17:15', endTime: '18:15', day: 'ÇARŞAMBA', location: 'Hasan Polat Spor Salonu' },
    { id: 'SES-CARS-2', code: 'ÇARŞAMBA 2', name: 'ÇARŞAMBA 2 (18:25 - 19:25)', startTime: '18:25', endTime: '19:25', day: 'ÇARŞAMBA', location: 'Hasan Polat Spor Salonu' },
    { id: 'SES-PERS-1', code: 'PERŞEMBE 1', name: 'PERŞEMBE 1 (19:15 - 20:15)', startTime: '19:15', endTime: '20:15', day: 'PERŞEMBE', location: 'Hasan Polat Spor Salonu' },
    { id: 'SES-PERS-2', code: 'PERŞEMBE 2', name: 'PERŞEMBE 2 (20:25 - 21:25)', startTime: '20:25', endTime: '21:25', day: 'PERŞEMBE', location: 'Hasan Polat Spor Salonu' },
    { id: 'SES-CUMA-1', code: 'CUMA 1', name: 'CUMA 1 (17:15 - 18:15)', startTime: '17:15', endTime: '18:15', day: 'CUMA', location: 'Hasan Polat Spor Salonu' },
    { id: 'SES-CUMA-2', code: 'CUMA 2', name: 'CUMA 2 (18:25 - 19:25)', startTime: '18:25', endTime: '19:25', day: 'CUMA', location: 'Hasan Polat Spor Salonu' }
  ];

const SAMPLE_STUDENTS = (typeof OFFICIAL_137_STUDENTS !== 'undefined' && Array.isArray(OFFICIAL_137_STUDENTS)) 
  ? OFFICIAL_137_STUDENTS 
  : [];

const Storage = {
  // Bellek içi önbellek (Performans ve UI akıcılığı için)
  _cache: {
    students: null,
    attendance: null,
    settings: null
  },

  // Başlatma ve Bulut Senkronizasyonu
  async init() {
    // 1. Varsa sahte/test yönetim kurulu kayıtlarını temizle
    try {
      const fakeNames = ['Alp Eren Yılmaz', 'Ayşe Sena Kaya', 'Mehmet Fatih Demir', 'Zeynep Serra Aydın', 'Emre Can Yıldız', 'Burak Öztürk'];
      const savedRoles = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (savedRoles) {
        const rolesMap = JSON.parse(savedRoles);
        let rolesChanged = false;
        Object.keys(rolesMap).forEach(key => {
          if (key.startsWith('GTOK-YK-') || key.startsWith('YK-')) {
            delete rolesMap[key];
            rolesChanged = true;
          }
        });
        if (rolesChanged) {
          localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(rolesMap));
        }
      }

      const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      if (savedStudents) {
        const students = JSON.parse(savedStudents);
        if (Array.isArray(students)) {
          const filtered = students.filter(s => {
            if (!s) return false;
            if (s.id && (String(s.id).startsWith('GTOK-YK-') || String(s.id).startsWith('YK-'))) return false;
            if (s.name && fakeNames.includes(s.name.trim())) return false;
            return true;
          });
          if (filtered.length !== students.length) {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(filtered));
          }
        }
      }
    } catch (e) {
      console.warn('Sahte verileri temizleme:', e);
    }

    // 137 kişilik resmi sporcu listesi ve Yönetim Kurulu senkronizasyonu
    try {
      const ver = localStorage.getItem('gtok_roster_ver_clean_v8');
      if (ver !== 'active' && typeof OFFICIAL_137_STUDENTS !== 'undefined') {
        const rolesMap = this.getRolesMap();
        const boardIds = ['0001','0003','0004','0005','0007','0008','0009','0017','0067','0172','0366','0395'];
        const existing = this.getStudents();
        
        // 137 resmi sporcu
        const list = OFFICIAL_137_STUDENTS.map(s => ({
          ...s,
          role: rolesMap[s.id] || s.role || ''
        }));

        // Yalnızca kullanıcının eklediği yönetim kurulu üyelerini koru
        existing.forEach(ex => {
          if (!ex) return;
          const cleanId = String(ex.id || '').trim().toUpperCase();
          if (boardIds.includes(cleanId) && !list.some(s => String(s.id).trim().toUpperCase() === cleanId)) {
            list.push({
              ...ex,
              role: rolesMap[cleanId] || ex.role || 'Yönetim Kurulu Üyesi'
            });
          }
        });

        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(list));
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(DEFAULT_SESSIONS));
        localStorage.setItem('gtok_roster_ver_clean_v8', 'active');
      }
    } catch (e) {
      console.warn('Roster eşitleme:', e);
    }

    // 1. Yerel verileri önbelleğe yükle
    this.getStudents();
    this.getAttendance();
    this.getSettings();

    // 2. Supabase varsa bağlan ve buluttan en son verileri çek
    if (window.SupabaseDB) {
      const connected = await window.SupabaseDB.init();
      if (connected) {
        await this.pullFromCloud();
      }
    }
  },

  // Buluttaki verileri çekip yerel önbelleğe aktar
  async pullFromCloud() {
    if (!window.SupabaseDB || !window.SupabaseDB.isConnected) return;

    try {
      const [remoteStudents, remoteAttendance, remoteSettings] = await Promise.all([
        window.SupabaseDB.getStudents(),
        window.SupabaseDB.getAttendance(),
        window.SupabaseDB.getSettings()
      ]);

      let hasChanges = false;

      if (remoteSettings) {
        this.saveSettings(remoteSettings, false);
        hasChanges = true;
      }

      if (Array.isArray(remoteStudents) && remoteStudents.length > 0) {
        const localStudents = this.getStudents();
        const rolesMap = this.getRolesMap();

        if (remoteSettings && remoteSettings.rolesMap) {
          Object.assign(rolesMap, remoteSettings.rolesMap);
          localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(rolesMap));
        }

        const mergedStudents = remoteStudents.map(rs => {
          const cleanId = String(rs.id || '').trim().toUpperCase();
          const local = localStudents.find(ls => String(ls.id || '').trim().toUpperCase() === cleanId);
          const role = (rs.role && rs.role.trim()) 
            ? rs.role.trim() 
            : (rolesMap[cleanId] || (local ? local.role : '') || '');

          return {
            ...rs,
            session: rs.session || (local ? local.session : '') || rs.department || '',
            role: role || ''
          };
        });

        this.saveStudents(mergedStudents, false); // false = buluta tekrar yazma
        hasChanges = true;
      }

      if (Array.isArray(remoteAttendance)) {
        this.saveAttendance(remoteAttendance, false);
        hasChanges = true;
      }

      if (hasChanges) {
        this.refreshActiveViews();
      }
    } catch (e) {
      console.warn('Buluttan veri çekilirken hata:', e);
    }
  },

  // Realtime: Başka bir cihaz yoklama okuttuğunda veya sildiğinde
  onRemoteAttendanceChange(payload) {
    const { eventType, new: newRec, old: oldRec } = payload;
    let attendance = this.getAttendance();

    if (eventType === 'INSERT' && newRec) {
      const mapped = {
        recordId: newRec.record_id,
        studentId: newRec.student_id,
        studentName: newRec.student_name,
        category: newRec.category || 'Genel',
        date: newRec.date,
        time: newRec.time,
        status: newRec.status || 'Geldi',
        timestamp: Number(newRec.timestamp) || Date.now()
      };
      // Mükerrer eklemeyi önle
      if (!attendance.some(r => r.recordId === mapped.recordId)) {
        attendance.unshift(mapped);
        this.saveAttendance(attendance, false);
        this.refreshActiveViews();
      }
    } else if (eventType === 'DELETE' && oldRec) {
      attendance = attendance.filter(r => r.recordId !== oldRec.record_id);
      this.saveAttendance(attendance, false);
      this.refreshActiveViews();
    }
  },

  // Realtime: Başka bir cihaz sporcu eklediğinde veya sildiğinde
  onRemoteStudentChange(payload) {
    const { eventType, new: newStudent, old: oldStudent } = payload;
    let students = this.getStudents();
    const rolesMap = this.getRolesMap();

    if (eventType === 'INSERT' && newStudent) {
      const cleanNewId = String(newStudent.id || '').trim().toUpperCase();
      if (!students.some(s => String(s.id || '').trim().toUpperCase() === cleanNewId)) {
        const role = (newStudent.role && newStudent.role.trim()) 
          ? newStudent.role.trim() 
          : (rolesMap[cleanNewId] || '');
        students.push({ ...newStudent, role });
        this.saveStudents(students, false);
        this.refreshActiveViews();
      }
    } else if (eventType === 'UPDATE' && newStudent) {
      const cleanNewId = String(newStudent.id || '').trim().toUpperCase();
      students = students.map(s => {
        if (String(s.id || '').trim().toUpperCase() === cleanNewId) {
          // Eğer buluttan gelen nesnede role kolonu yoksa yereldeki mevcut rolü asla silme!
          const role = (newStudent.role && newStudent.role.trim()) 
            ? newStudent.role.trim() 
            : (rolesMap[cleanNewId] || s.role || '');
          return { ...s, ...newStudent, role };
        }
        return s;
      });
      this.saveStudents(students, false);
      this.refreshActiveViews();
    } else if (eventType === 'DELETE' && oldStudent) {
      const cleanOldId = String(oldStudent.id || '').trim().toUpperCase();
      students = students.filter(s => String(s.id || '').trim().toUpperCase() !== cleanOldId);
      this.saveStudents(students, false);
      this.refreshActiveViews();
    }
  },

  // Ekranda açık olan modülleri güncelle
  refreshActiveViews() {
    if (window.AttendanceManager && typeof window.AttendanceManager.renderTodayList === 'function') {
      window.AttendanceManager.renderTodayList();
    }
    if (window.StudentsManager && typeof window.StudentsManager.renderStudentsList === 'function') {
      window.StudentsManager.renderStudentsList();
    }
    if (window.HistoryManager && typeof window.HistoryManager.renderHistory === 'function') {
      window.HistoryManager.renderHistory();
    }
  },

  // --- AYARLAR ---
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const parsed = data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
      this._cache.settings = parsed;
      return parsed;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  // --- YÖNETİM KURULU VE ÜYE ROLLERİ HARİTASI ---
  getRolesMap() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (data) return JSON.parse(data);
      const settings = this.getSettings();
      if (settings && settings.rolesMap) return settings.rolesMap;
      return {};
    } catch {
      return {};
    }
  },

  saveRole(studentId, role) {
    if (!studentId) return;
    const cleanId = String(studentId).trim().toUpperCase();
    const map = this.getRolesMap();
    if (role && String(role).trim()) {
      map[cleanId] = String(role).trim();
    } else {
      delete map[cleanId];
    }
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(map));

    // Supabase ayarlar tablosu üzerinden buluta da kalıcı olarak yedekle
    const settings = this.getSettings();
    settings.rolesMap = map;
    this.saveSettings(settings, true);
  },

  saveSettings(settings, syncToCloud = true) {
    this._cache.settings = settings;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

    if (syncToCloud && window.SupabaseDB && window.SupabaseDB.isConnected) {
      window.SupabaseDB.saveSettings(settings);
    }
  },

  // --- SPORCULAR ---
  getStudents() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      let list;
      if (!data) {
        list = SAMPLE_STUDENTS;
        this.saveStudents(SAMPLE_STUDENTS, false);
      } else {
        list = JSON.parse(data);
      }

      // Her zaman güncel rolesMap ile harmanla (Bulut geri almalarını ve kaybolmaları 100% önler)
      const rolesMap = this.getRolesMap();
      list = list.map(s => {
        const cleanId = String(s.id || '').trim().toUpperCase();
        const mappedRole = rolesMap[cleanId];
        return {
          ...s,
          role: (s.role !== undefined && s.role !== null && s.role !== '') 
            ? s.role 
            : (mappedRole || '')
        };
      });

      this._cache.students = list;
      return list;
    } catch {
      return SAMPLE_STUDENTS;
    }
  },

  saveStudents(students, syncToCloud = true) {
    this._cache.students = students;
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  },

  getStudentById(id) {
    if (!id) return null;
    const students = this.getStudents();
    const cleanQuery = String(id).trim().toUpperCase();

    // 1. Doğrudan tam eşleşme (Örn: '415820' === '415820')
    let found = students.find(s => (s.id || '').trim().toUpperCase() === cleanQuery);
    if (found) return found;

    // 2. JSON formatı kontrolü (Örn: {"id":"415820"})
    try {
      if (cleanQuery.startsWith('{') && cleanQuery.endsWith('}')) {
        const parsed = JSON.parse(id);
        const targetId = parsed.id || parsed.studentId || parsed.no;
        if (targetId) {
          found = students.find(s => (s.id || '').trim().toUpperCase() === String(targetId).trim().toUpperCase());
          if (found) return found;
        }
      }
    } catch (_) {}

    // 3. URL formatı kontrolü (Örn: https://.../?id=415820 veya #415820)
    if (cleanQuery.includes('HTTP://') || cleanQuery.includes('HTTPS://') || cleanQuery.includes('?')) {
      try {
        const url = new URL(cleanQuery.toLowerCase());
        const paramId = url.searchParams.get('id') || url.searchParams.get('no') || url.hash.replace('#', '');
        if (paramId) {
          found = students.find(s => (s.id || '').trim().toUpperCase() === paramId.trim().toUpperCase());
          if (found) return found;
        }
      } catch (_) {}
    }

    // 4. Özel önek / boşluk temizleme (Örn: 'GTOK-415820', 'NO: 415820' -> '415820')
    const digitsOnly = cleanQuery.replace(/\D/g, '');
    if (digitsOnly.length >= 4) {
      found = students.find(s => (s.id || '').replace(/\D/g, '') === digitsOnly);
      if (found) return found;
    }

    // 5. İsimle eşleşme alternatifi
    found = students.find(s => (s.name || '').trim().toLowerCase() === String(id).trim().toLowerCase());
    return found || null;
  },

  addStudent(student) {
    const students = this.getStudents();
    students.push(student);
    if (student.role) {
      this.saveRole(student.id, student.role);
    }
    this.saveStudents(students);

    if (window.SupabaseDB && window.SupabaseDB.isConnected) {
      window.SupabaseDB.upsertStudent(student);
    }
  },

  updateStudent(oldId, updated) {
    const cleanOldId = String(oldId).trim().toUpperCase();
    const cleanNewId = String(updated.id).trim().toUpperCase();
    let students = this.getStudents();

    students = students.map(s => {
      if (String(s.id || '').trim().toUpperCase() === cleanOldId) {
        return { ...s, ...updated };
      }
      return s;
    });

    // Rolü bağımsız rolesMap'e kalıcı olarak yaz
    this.saveRole(updated.id, updated.role);
    if (cleanOldId !== cleanNewId) {
      this.saveRole(oldId, null);
    }

    this.saveStudents(students);

    // Eğer numara değiştirildiyse, geçmiş yoklama kayıtlarını da yeni numaraya güncelle
    if (cleanOldId !== cleanNewId) {
      let attendance = this.getAttendance();
      let changed = false;
      attendance = attendance.map(a => {
        if (String(a.studentId || '').trim().toUpperCase() === cleanOldId) {
          changed = true;
          return { ...a, studentId: updated.id, studentName: updated.name };
        }
        return a;
      });
      if (changed) {
        this.saveAttendance(attendance, false);
      }
    }

    if (window.SupabaseDB && window.SupabaseDB.isConnected) {
      if (cleanOldId !== cleanNewId) {
        window.SupabaseDB.deleteStudent(oldId);
      }
      window.SupabaseDB.upsertStudent(updated);
    }
  },

  findStudentByExactId(id) {
    if (!id) return null;
    const clean = String(id).trim().toUpperCase();
    const students = this.getStudents();
    let found = students.find(s => (s.id || '').trim().toUpperCase() === clean);
    if (found) return found;

    const numClean = parseInt(clean, 10);
    if (!isNaN(numClean)) {
      found = students.find(s => {
        const numS = parseInt(s.id, 10);
        return !isNaN(numS) && numS === numClean;
      });
      if (found) return found;
    }
    return null;
  },

  // İki okçu arasında numaraları takas et (Swapping IDs)
  swapAndUpdateStudent(oldId, studentData, targetStudent) {
    let students = this.getStudents();
    const newId = studentData.id;
    const targetOldId = targetStudent.id;

    students = students.map(s => {
      if ((s.id || '').trim().toUpperCase() === oldId.trim().toUpperCase()) {
        return { ...s, ...studentData, id: newId };
      }
      if ((s.id || '').trim().toUpperCase() === targetOldId.trim().toUpperCase()) {
        return { ...s, id: oldId };
      }
      return s;
    });
    this.saveStudents(students);

    // Geçmiş yoklama kayıtlarını da hatasız takas et (çakışmayı önlemek için geçici ID kullan)
    let attendance = this.getAttendance();
    const TEMP_SWAP_ID = '___TEMP_SWAP_' + Date.now();

    attendance = attendance.map(a => {
      if ((a.studentId || '').trim().toUpperCase() === oldId.trim().toUpperCase()) {
        return { ...a, studentId: TEMP_SWAP_ID, studentName: studentData.name };
      }
      return a;
    });

    attendance = attendance.map(a => {
      if ((a.studentId || '').trim().toUpperCase() === targetOldId.trim().toUpperCase()) {
        return { ...a, studentId: oldId, studentName: targetStudent.name };
      }
      return a;
    });

    attendance = attendance.map(a => {
      if (a.studentId === TEMP_SWAP_ID) {
        return { ...a, studentId: newId };
      }
      return a;
    });
    this.saveAttendance(attendance, false);

    // Rolleri de takas et
    this.saveRole(newId, studentData.role);
    this.saveRole(oldId, targetStudent.role || null);

    // Supabase bulut veritabanını güncelle
    if (window.SupabaseDB && window.SupabaseDB.isConnected) {
      try {
        window.SupabaseDB.upsertStudent({ ...studentData, id: newId });
        window.SupabaseDB.upsertStudent({ ...targetStudent, id: oldId });
      } catch (err) {
        console.warn('Supabase takas eşitleme hatası:', err);
      }
    }
  },

  // Yeni okçu eklenirken var olan bir numara seçilirse hedef okçuyu boş bir numaraya kaydır
  assignIdAndShiftTarget(studentData, targetStudent, vacantId) {
    let students = this.getStudents();
    const newId = studentData.id;
    const targetOldId = targetStudent.id;

    // Hedef okçunun numarasını vacantId yap
    students = students.map(s => {
      if ((s.id || '').trim().toUpperCase() === targetOldId.trim().toUpperCase()) {
        return { ...s, id: vacantId };
      }
      return s;
    });
    // Yeni okçuyu ekle
    students.push({ ...studentData, id: newId });

    this.saveRole(newId, studentData.role);
    this.saveRole(vacantId, targetStudent.role || null);
    this.saveRole(targetOldId, null);

    this.saveStudents(students);

    // Hedef okçunun yoklama kayıtlarını da yeni numarasına güncelle
    let attendance = this.getAttendance();
    let changed = false;
    attendance = attendance.map(a => {
      if ((a.studentId || '').trim().toUpperCase() === targetOldId.trim().toUpperCase()) {
        changed = true;
        return { ...a, studentId: vacantId, studentName: targetStudent.name };
      }
      return a;
    });
    if (changed) {
      this.saveAttendance(attendance, false);
    }

    // Supabase buluta aktar
    if (window.SupabaseDB && window.SupabaseDB.isConnected) {
      try {
        window.SupabaseDB.upsertStudent({ ...targetStudent, id: vacantId });
        window.SupabaseDB.upsertStudent({ ...studentData, id: newId });
      } catch (err) {
        console.warn('Supabase aktarım hatası:', err);
      }
    }
  },

  deleteStudent(id) {
    const cleanId = String(id || '').trim().toUpperCase();
    let students = this.getStudents();
    students = students.filter(s => String(s.id || '').trim().toUpperCase() !== cleanId);
    this.saveRole(id, null);
    this.saveStudents(students);

    if (window.SupabaseDB && window.SupabaseDB.isConnected) {
      window.SupabaseDB.deleteStudent(id);
    }
  },

  // --- YOKLAMA KAYITLARI ---
  getAttendance() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      const parsed = data ? JSON.parse(data) : [];
      this._cache.attendance = parsed;
      return parsed;
    } catch {
      return [];
    }
  },

  saveAttendance(attendanceList, syncToCloud = true) {
    this._cache.attendance = attendanceList;
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceList));
  },

  addAttendanceRecord(record) {
    const list = this.getAttendance();
    list.unshift(record);
    this.saveAttendance(list);

    if (window.SupabaseDB && window.SupabaseDB.isConnected) {
      window.SupabaseDB.addAttendance(record);
    }
  },

  removeAttendanceRecord(recordId) {
    let list = this.getAttendance();
    list = list.filter(r => r.recordId !== recordId);
    this.saveAttendance(list);

    if (window.SupabaseDB && window.SupabaseDB.isConnected) {
      window.SupabaseDB.deleteAttendance(recordId);
    }
  },

  // --- ANTRENMAN SEANSLARI & GRUPLARI ---
  getSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (!data) {
        this.saveSessions(DEFAULT_SESSIONS);
        return DEFAULT_SESSIONS;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_SESSIONS;
    }
  },

  saveSessions(sessions) {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    if (window.SupabaseDB && typeof window.SupabaseDB.saveSessionsCloud === 'function') {
      window.SupabaseDB.saveSessionsCloud(sessions).catch(() => {});
    }
  },

  getSessionById(id) {
    if (!id) return null;
    return this.getSessions().find(s => s.id === id) || null;
  },

  addSession(session) {
    const sessions = this.getSessions();
    if (!session.id) {
      session.id = 'SES-' + Date.now();
    }
    sessions.push(session);
    this.saveSessions(sessions);
    return session;
  },

  updateSession(id, data) {
    let sessions = this.getSessions();
    sessions = sessions.map(s => s.id === id ? { ...s, ...data } : s);
    this.saveSessions(sessions);
  },

  deleteSession(id) {
    let sessions = this.getSessions();
    sessions = sessions.filter(s => s.id !== id);
    this.saveSessions(sessions);
    if (this.getActiveSessionId() === id) {
      this.setActiveSessionId(sessions.length > 0 ? sessions[0].id : 'ALL');
    }
  },

  getActiveSessionId() {
    const val = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (val) return val;
    const sessions = this.getSessions();
    return sessions.length > 0 ? sessions[0].id : 'ALL';
  },

  setActiveSessionId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, id || 'ALL');
  },

  getActiveSession() {
    const id = this.getActiveSessionId();
    if (!id || id === 'ALL') return null;
    return this.getSessionById(id);
  },

  // Sporcunun seansını/grubunu anında güncelle (1 tıkla esnek değiştirme)
  changeStudentSession(studentId, newSessionName) {
    const student = this.getStudentById(studentId);
    if (!student) return false;
    this.updateStudent(student.id, { ...student, session: newSessionName || '' });
    return true;
  },

  // --- YEDEKLEME & GERİ YÜKLEME ---
  exportAllDataJSON() {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      club: this.getSettings().clubName,
      students: this.getStudents(),
      attendance: this.getAttendance(),
      settings: this.getSettings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KTU_GTOK_Yoklama_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importAllDataJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.students && Array.isArray(parsed.students)) {
        this.saveStudents(parsed.students);
      }
      if (parsed.attendance && Array.isArray(parsed.attendance)) {
        this.saveAttendance(parsed.attendance);
      }
      if (parsed.settings) {
        this.saveSettings(parsed.settings);
      }
      return true;
    } catch (e) {
      console.error('Yedek yükleme hatası:', e);
      return false;
    }
  }
};

window.Storage = Storage;
