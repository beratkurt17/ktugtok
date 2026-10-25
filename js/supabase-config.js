// KTÜ GTOK Okçuluk Kulübü - Supabase Bulut Veritabanı Entegrasyon Modülü
const SUPABASE_CONFIG_KEY = 'gtok_supabase_credentials_v1';

const DEFAULT_SUPABASE_CONFIG = {
  url: 'https://tmgkkmttobketfkgzmcs.supabase.co',
  anonKey: 'sb_publishable_maQ3wMcw7_YbWitk_hwHjQ_0oNP3TxX'
};

const SupabaseDB = {
  client: null,
  isConnected: false,
  isSyncing: false,
  realtimeChannel: null,

  // Kayıtlı bağlantı bilgilerini al (Varsayılan olarak projeye gömülü bilgileri kullanır)
  getConfig() {
    try {
      const data = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.url && parsed.anonKey) return parsed;
      }
      return DEFAULT_SUPABASE_CONFIG;
    } catch {
      return DEFAULT_SUPABASE_CONFIG;
    }
  },

  // Bağlantı bilgilerini kaydet
  saveConfig(url, anonKey) {
    const cleanUrl = (url || '').trim().replace(/\/$/, '');
    const cleanKey = (anonKey || '').trim();
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
  },

  // Bağlantıyı sıfırla / yerel moda dön
  clearConfig() {
    localStorage.removeItem(SUPABASE_CONFIG_KEY);
    this.client = null;
    this.isConnected = false;
    if (this.realtimeChannel) {
      try { this.realtimeChannel.unsubscribe(); } catch (_) {}
      this.realtimeChannel = null;
    }
    this.updateStatusBadge('disconnected', 'Yerel Mod (Çevrimdışı)');
  },

  // Supabase istemcisini başlat
  async init() {
    const config = this.getConfig();
    if (!config.url || !config.anonKey) {
      this.isConnected = false;
      this.updateStatusBadge('disconnected', 'Yerel Mod (Supabase Tanımsız)');
      return false;
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.warn('Supabase istemci kütüphanesi yüklenemedi.');
      this.updateStatusBadge('error', 'Kütüphane Hatası');
      return false;
    }

    try {
      this.updateStatusBadge('connecting', 'Buluta Bağlanıyor...');
      this.client = window.supabase.createClient(config.url, config.anonKey);

      // Bağlantıyı test etmek için ufak bir okuma isteği
      const { data, error } = await this.client.from('students').select('id').limit(1);
      if (error) throw error;

      this.isConnected = true;
      this.updateStatusBadge('connected', 'Bulut Aktif (Supabase)');
      console.log('✅ Supabase bulut veritabanına başarıyla bağlanıldı!');

      // Canlı senkronizasyonu başlat (Realtime)
      this.setupRealtimeSubscription();

      return true;
    } catch (err) {
      console.error('Supabase bağlantı hatası:', err);
      this.isConnected = false;
      this.updateStatusBadge('error', 'Bağlantı Hatası: ' + (err.message || 'Erişilemedi'));
      return false;
    }
  },

  // Test Bağlantısı (Formdan girilen bilgilerle)
  async testConnection(url, anonKey) {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      return { success: false, error: 'Supabase JS kütüphanesi bulunamadı.' };
    }
    try {
      const cleanUrl = (url || '').trim().replace(/\/$/, '');
      const cleanKey = (anonKey || '').trim();
      if (!cleanUrl || !cleanKey) {
        return { success: false, error: 'URL ve Anon Key boş bırakılamaz.' };
      }

      const tempClient = window.supabase.createClient(cleanUrl, cleanKey);
      const { error } = await tempClient.from('students').select('id').limit(1);

      if (error) {
        if (error.code === '42P01') {
          return { success: false, error: 'Tablolar bulunamadı! Lütfen önce "supabase_schema.sql" kodunu Supabase SQL Editor\'de çalıştırın.' };
        }
        return { success: false, error: error.message || 'Supabase erişim hatası' };
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message || 'Bilinmeyen bağlantı hatası' };
    }
  },

  // Canlı Bildirim Dinleyicisi (Farklı cihazlardan yapılan değişiklikleri anlık yakalama)
  setupRealtimeSubscription() {
    if (!this.client || !this.isConnected) return;

    if (this.realtimeChannel) {
      try { this.realtimeChannel.unsubscribe(); } catch (_) {}
    }

    try {
      this.realtimeChannel = this.client
        .channel('gtok_public_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
          console.log('🔄 Buluttan canlı yoklama güncellemesi:', payload);
          if (window.Storage && typeof window.Storage.onRemoteAttendanceChange === 'function') {
            window.Storage.onRemoteAttendanceChange(payload);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
          console.log('🔄 Buluttan canlı sporcu güncellemesi:', payload);
          if (window.Storage && typeof window.Storage.onRemoteStudentChange === 'function') {
            window.Storage.onRemoteStudentChange(payload);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime abonelik başlatılamadı:', e);
    }
  },

  // Üst bardaki ve ayarlardaki durum göstergelerini güncelle
  updateStatusBadge(status, text) {
    const headerBadge = document.getElementById('header-cloud-badge');
    const headerText = document.getElementById('header-cloud-status');
    if (headerBadge) headerBadge.className = 'cloud-badge ' + status;
    if (headerText) headerText.textContent = text;

    const settingsBadge = document.getElementById('settings-cloud-badge');
    const settingsText = document.getElementById('settings-cloud-status');
    if (settingsBadge) settingsBadge.className = 'cloud-badge ' + status;
    if (settingsText) settingsText.textContent = text;

    const btnDisconnect = document.getElementById('btn-disconnect-supabase');
    const btnSync = document.getElementById('btn-sync-to-cloud');
    if (btnDisconnect) {
      btnDisconnect.style.display = (status === 'connected') ? 'inline-flex' : 'none';
    }
    if (btnSync) {
      btnSync.style.display = (status === 'connected') ? 'inline-flex' : 'none';
    }
  },

  // --- SUPABASE VERİ OKUMA / YAZMA İŞLEMLERİ ---

  async getStudents() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client
        .from('students')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Supabase sporcu listesi alma hatası:', err);
      return null;
    }
  },

  async upsertStudent(student) {
    if (!this.isConnected || !this.client) return false;
    try {
      const payload = {
        id: student.id,
        name: student.name,
        faculty: student.faculty || '',
        department: student.department || '',
        category: student.category || 'Genel',
        phone: student.phone || '',
        notes: student.notes || '',
        role: student.role || ''
      };
      let { error } = await this.client.from('students').upsert(payload);
      if (error && error.message && error.message.includes('role')) {
        delete payload.role;
        const retry = await this.client.from('students').upsert(payload);
        error = retry.error;
      }
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase sporcu kaydetme hatası:', err);
      return false;
    }
  },

  async deleteStudent(id) {
    if (!this.isConnected || !this.client) return false;
    try {
      const { error } = await this.client.from('students').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase sporcu silme hatası:', err);
      return false;
    }
  },

  async getAttendance() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client
        .from('attendance')
        .select('*')
        .order('timestamp', { ascending: false });
      if (error) throw error;

      // Veritabanı sütun isimlerini frontend yapısına eşle
      return (data || []).map(r => ({
        recordId: r.record_id,
        studentId: r.student_id,
        studentName: r.student_name,
        category: r.category || 'Genel',
        date: r.date,
        time: r.time,
        status: r.status || 'Geldi',
        timestamp: Number(r.timestamp) || Date.now()
      }));
    } catch (err) {
      console.error('Supabase yoklama listesi alma hatası:', err);
      return null;
    }
  },

  async addAttendance(record) {
    if (!this.isConnected || !this.client) return false;
    try {
      const payload = {
        record_id: record.recordId,
        student_id: record.studentId,
        student_name: record.studentName,
        category: record.category || 'Genel',
        date: record.date,
        time: record.time,
        status: record.status || 'Geldi',
        timestamp: record.timestamp || Date.now()
      };
      const { error } = await this.client.from('attendance').insert(payload);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase yoklama ekleme hatası:', err);
      return false;
    }
  },

  async deleteAttendance(recordId) {
    if (!this.isConnected || !this.client) return false;
    try {
      const { error } = await this.client.from('attendance').delete().eq('record_id', recordId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase yoklama silme hatası:', err);
      return false;
    }
  },

  async getSettings() {
    if (!this.isConnected || !this.client) return null;
    try {
      const { data, error } = await this.client
        .from('settings')
        .select('value')
        .eq('key', 'club_settings')
        .single();
      if (error) return null;
      return data ? data.value : null;
    } catch {
      return null;
    }
  },

  async saveSettings(settings) {
    if (!this.isConnected || !this.client) return false;
    try {
      const { error } = await this.client.from('settings').upsert({
        key: 'club_settings',
        value: settings
      });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase ayar kaydetme hatası:', err);
      return false;
    }
  },

  // Yereldeki mevcut sporcu ve yoklamaları Supabase'e topluca aktarma (Migration / Sync)
  async uploadLocalDataToSupabase(localStudents, localAttendance, localSettings) {
    if (!this.isConnected || !this.client) {
      return { success: false, error: 'Supabase bağlı değil.' };
    }

    try {
      let studentsCount = 0;
      let attendanceCount = 0;

      // 1. Sporcuları yükle
      if (Array.isArray(localStudents) && localStudents.length > 0) {
        const studentRows = localStudents.map(s => ({
          id: s.id,
          name: s.name,
          faculty: s.faculty || '',
          department: s.department || '',
          category: s.category || 'Genel',
          phone: s.phone || '',
          notes: s.notes || ''
        }));
        const { error: sErr } = await this.client.from('students').upsert(studentRows);
        if (sErr) throw sErr;
        studentsCount = studentRows.length;
      }

      // 2. Yoklamaları yükle
      if (Array.isArray(localAttendance) && localAttendance.length > 0) {
        const attRows = localAttendance.map(r => ({
          record_id: r.recordId,
          student_id: r.studentId,
          student_name: r.studentName,
          category: r.category || 'Genel',
          date: r.date,
          time: r.time,
          status: r.status || 'Geldi',
          timestamp: r.timestamp || Date.now()
        }));
        const { error: aErr } = await this.client.from('attendance').upsert(attRows);
        if (aErr) throw aErr;
        attendanceCount = attRows.length;
      }

      // 3. Ayarları yükle
      if (localSettings) {
        await this.saveSettings(localSettings);
      }

      return { success: true, studentsCount, attendanceCount };
    } catch (e) {
      console.error('Buluta aktarma hatası:', e);
      return { success: false, error: e.message || 'Veriler aktarılırken hata oluştu.' };
    }
  },

  // --- KULÜP DUYURULARI BULUT SENKRONİZASYONU (settings.club_announcements) ---
  async getAnnouncementsCloud() {
    try {
      const config = this.getConfig();
      const res = await fetch(`${config.url}/rest/v1/settings?key=eq.club_announcements&select=value`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.length > 0 && Array.isArray(data[0].value)) {
        return data[0].value;
      }
      return null;
    } catch (e) {
      console.warn('Supabase duyurular alınamadı:', e);
      return null;
    }
  },

  async saveAnnouncementsCloud(list) {
    try {
      const config = this.getConfig();
      const res = await fetch(`${config.url}/rest/v1/settings?on_conflict=key`, {
        method: 'POST',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          key: 'club_announcements',
          value: list,
          updated_at: new Date().toISOString()
        })
      });
      return res.ok;
    } catch (e) {
      console.error('Supabase duyuruları kaydetme hatası:', e);
      return false;
    }
  },

  // --- ANTRENMAN SEANSLARI BULUT SENKRONİZASYONU (settings.club_sessions) ---
  async getSessionsCloud() {
    try {
      const config = this.getConfig();
      const res = await fetch(`${config.url}/rest/v1/settings?key=eq.club_sessions&select=value`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.length > 0 && Array.isArray(data[0].value)) {
        return data[0].value;
      }
      return null;
    } catch (e) {
      console.warn('Supabase seanslar alınamadı:', e);
      return null;
    }
  },

  async saveSessionsCloud(list) {
    try {
      const config = this.getConfig();
      const res = await fetch(`${config.url}/rest/v1/settings?on_conflict=key`, {
        method: 'POST',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          key: 'club_sessions',
          value: list,
          updated_at: new Date().toISOString()
        })
      });
      return res.ok;
    } catch (e) {
      console.error('Supabase seansları kaydetme hatası:', e);
      return false;
    }
  },

  // --- YÖNETİM KURULU BULUT SENKRONİZASYONU (settings.rolesMap + students) ---
  async getBoardMembersCloud() {
    try {
      const config = this.getConfig();
      const setRes = await fetch(`${config.url}/rest/v1/settings?key=eq.club_settings&select=value`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });
      if (!setRes.ok) return null;
      const setData = await setRes.json();
      const rolesMap = (setData && setData[0] && setData[0].value && setData[0].value.rolesMap) ? setData[0].value.rolesMap : {};
      const roleIds = Object.keys(rolesMap);
      if (roleIds.length === 0) return null;

      const stuRes = await fetch(`${config.url}/rest/v1/students?id=in.(${roleIds.join(',')})`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });
      if (!stuRes.ok) return null;
      const students = await stuRes.json();
      if (!Array.isArray(students) || students.length === 0) return null;

      const boardList = students.map(s => ({
        ...s,
        role: rolesMap[s.id] || s.role || 'Yönetim Kurulu Üyesi'
      }));

      const rolePriority = [
        'kulüp başkanı',
        'başkan',
        'başkan yardımcısı',
        'okçu başı',
        'antrenör',
        'genel sekreter',
        'sayman',
        'muhasip',
        'birim başkanı',
        'usta',
        'kaptan',
        'sorumlusu',
        'yönetim kurulu'
      ];

      boardList.sort((a, b) => {
        const roleA = (a.role || '').toLowerCase();
        const roleB = (b.role || '').toLowerCase();
        const idxA = rolePriority.findIndex(p => roleA.includes(p));
        const idxB = rolePriority.findIndex(p => roleB.includes(p));
        const prioA = idxA === -1 ? 99 : idxA;
        const prioB = idxB === -1 ? 99 : idxB;
        return prioA - prioB;
      });

      return boardList;
    } catch (e) {
      console.warn('Supabase yönetim kurulu alınamadı:', e);
      return null;
    }
  }
};

window.SupabaseDB = SupabaseDB;

