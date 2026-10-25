// KTÜ GTOK Okçuluk Kulübü - Firebase Firestore Bulut Veritabanı Modülü
// Supabase BTK engeli nedeniyle Firebase (Google altyapısı) kullanılıyor.
// window.SupabaseDB arayüzüyle tam geriye dönük uyumlu.

const FIREBASE_CONFIG_KEY = 'gtok_firebase_credentials_v1';

const FirebaseDB = {
  db: null,
  isConnected: false,
  isSyncing: false,
  unsubscribers: [],

  // Kayıtlı kimlik bilgilerini al (hem yeni firebase hem eski supabase formatı desteklenir)
  getConfig() {
    try {
      const data = localStorage.getItem(FIREBASE_CONFIG_KEY);
      if (data) {
        const p = JSON.parse(data);
        const apiKey = p.apiKey || p.url || '';
        const projectId = p.projectId || p.anonKey || '';
        if (apiKey && projectId) {
          return { apiKey, projectId, url: apiKey, anonKey: projectId };
        }
      }
    } catch (_) {}
    return { apiKey: '', projectId: '', url: '', anonKey: '' };
  },

  // Kimlik bilgilerini kaydet (url/anonKey parametreleri geriye dönük uyumluluk için)
  saveConfig(apiKeyOrUrl, projectIdOrAnonKey) {
    const apiKey = (apiKeyOrUrl || '').trim();
    const projectId = (projectIdOrAnonKey || '').trim();
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify({ apiKey, projectId }));
    // Eski Supabase kimlik bilgilerini temizle
    localStorage.removeItem('gtok_supabase_credentials_v1');
  },

  // Bağlantıyı sıfırla / yerel moda dön
  clearConfig() {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    localStorage.removeItem('gtok_supabase_credentials_v1');

    if (this.db) {
      try { window.firebase.app('gtok').delete(); } catch (_) {}
    }
    this.db = null;
    this.isConnected = false;

    this.unsubscribers.forEach(u => { try { u(); } catch (_) {} });
    this.unsubscribers = [];

    this.updateStatusBadge('disconnected', 'Yerel Mod (Çevrimdışı)');
  },

  // Firebase Firestore istemcisini başlat
  async init() {
    const config = this.getConfig();
    if (!config.apiKey || !config.projectId) {
      this.isConnected = false;
      this.updateStatusBadge('disconnected', 'Yerel Mod (Firebase Tanımsız)');
      return false;
    }

    if (typeof window.firebase === 'undefined' || typeof window.firebase.firestore === 'undefined') {
      console.warn('Firebase Firestore kütüphanesi yüklenemedi.');
      this.updateStatusBadge('error', 'Firebase Kütüphanesi Eksik');
      return false;
    }

    if (this.isConnected && this.db) return true;

    try {
      this.updateStatusBadge('connecting', 'Buluta Bağlanıyor...');

      try { await window.firebase.app('gtok').delete(); } catch (_) {}

      const app = window.firebase.initializeApp({
        apiKey: config.apiKey,
        projectId: config.projectId,
        authDomain: config.projectId + '.firebaseapp.com',
      }, 'gtok');

      this.db = window.firebase.firestore(app);

      await this.db.collection('settings').doc('_ping_').get();

      this.isConnected = true;
      this.updateStatusBadge('connected', 'Bulut Aktif (Firebase)');
      console.log('✅ Firebase Firestore bulut veritabanına başarıyla bağlanıldı!');

      this.setupRealtimeSubscription();
      return true;
    } catch (err) {
      console.error('Firebase bağlantı hatası:', err);
      this.isConnected = false;
      this.db = null;
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('permission_denied')) {
        this.updateStatusBadge('error', 'Erişim Reddedildi — Firestore güvenlik kurallarını güncelleyin');
      } else {
        this.updateStatusBadge('error', 'Bağlantı Hatası: ' + (err.message || 'Erişilemedi').substring(0, 60));
      }
      return false;
    }
  },

  // Bağlı değilse bağlanmayı dene (public website için otomatik init)
  async _ensureConnected() {
    if (this.isConnected && this.db) return true;
    return await this.init();
  },

  // Test bağlantısı — Ayarlar formundan girilen bilgilerle
  async testConnection(apiKeyOrUrl, projectIdOrAnonKey) {
    const apiKey = (apiKeyOrUrl || '').trim();
    const projectId = (projectIdOrAnonKey || '').trim();

    if (!apiKey || !projectId) {
      return { success: false, error: 'API Key ve Project ID alanları boş bırakılamaz.' };
    }

    if (typeof window.firebase === 'undefined' || typeof window.firebase.firestore === 'undefined') {
      return { success: false, error: 'Firebase JS kütüphanesi bulunamadı. Sayfa yenilemeyi deneyin.' };
    }

    const testName = 'gtok_test_' + Date.now();
    let testApp = null;
    try {
      testApp = window.firebase.initializeApp({
        apiKey,
        projectId,
        authDomain: projectId + '.firebaseapp.com',
      }, testName);

      const testDb = window.firebase.firestore(testApp);
      await testDb.collection('settings').doc('_ping_').get();

      return { success: true };
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('permission_denied')) {
        return { success: false, error: 'Firebase güvenlik kuralları erişimi engelledi. Firestore kurallarını "test moduna" alın.' };
      }
      if (msg.includes('invalid') || msg.includes('api key') || msg.includes('bad request')) {
        return { success: false, error: 'Geçersiz API Key. Firebase konsolundan doğru anahtarı kopyalayın.' };
      }
      if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('project')) {
        return { success: false, error: 'Proje bulunamadı. Project ID\'yi kontrol edin.' };
      }
      return { success: false, error: e.message || 'Bilinmeyen bağlantı hatası' };
    } finally {
      if (testApp) { try { await testApp.delete(); } catch (_) {} }
    }
  },

  // Realtime: Yoklama koleksiyonu değişikliklerini dinle
  setupRealtimeSubscription() {
    if (!this.db || !this.isConnected) return;

    this.unsubscribers.forEach(u => { try { u(); } catch (_) {} });
    this.unsubscribers = [];

    try {
      let isInitial = true;
      const unsub = this.db.collection('attendance')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .onSnapshot((snapshot) => {
          if (isInitial) { isInitial = false; return; }
          snapshot.docChanges().forEach((change) => {
            const d = change.doc.data();
            const mapped = {
              recordId: d.record_id || change.doc.id,
              studentId: d.student_id,
              studentName: d.student_name,
              category: d.category || 'Genel',
              date: d.date,
              time: d.time,
              status: d.status || 'Geldi',
              timestamp: Number(d.timestamp) || Date.now()
            };
            const payload = {
              eventType: change.type === 'added' ? 'INSERT' : change.type === 'removed' ? 'DELETE' : 'UPDATE',
              new: mapped,
              old: { record_id: change.doc.id }
            };
            if (window.Storage && typeof window.Storage.onRemoteAttendanceChange === 'function') {
              window.Storage.onRemoteAttendanceChange(payload);
            }
          });
        }, (err) => {
          console.warn('Firebase realtime dinleyici hatası:', err);
        });
      this.unsubscribers.push(unsub);
    } catch (e) {
      console.warn('Firebase realtime abonelik başlatılamadı:', e);
    }
  },

  // Üst bar ve ayarlar rozetlerini güncelle
  updateStatusBadge(status, text) {
    ['header', 'settings'].forEach(prefix => {
      const badge = document.getElementById(prefix + '-cloud-badge');
      const textEl = document.getElementById(prefix + '-cloud-status');
      if (badge) badge.className = 'cloud-badge ' + status;
      if (textEl) textEl.textContent = text;
    });

    const btnDisconnect = document.getElementById('btn-disconnect-supabase');
    const btnSync = document.getElementById('btn-sync-to-cloud');
    const connected = status === 'connected';
    if (btnDisconnect) btnDisconnect.style.display = connected ? 'inline-flex' : 'none';
    if (btnSync) btnSync.style.display = connected ? 'inline-flex' : 'none';
  },

  // --- VERİ OKUMA / YAZMA İŞLEMLERİ ---

  async getStudents() {
    if (!await this._ensureConnected()) return null;
    try {
      const snap = await this.db.collection('students').orderBy('name').get();
      return snap.docs.map(doc => doc.data());
    } catch (err) {
      console.error('Firebase sporcu listesi alma hatası:', err);
      return null;
    }
  },

  async upsertStudent(student) {
    if (!this.isConnected || !this.db) return false;
    try {
      await this.db.collection('students').doc(String(student.id)).set({
        id: student.id,
        name: student.name,
        faculty: student.faculty || '',
        department: student.department || '',
        category: student.category || 'Genel',
        phone: student.phone || '',
        notes: student.notes || '',
        role: student.role || ''
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Firebase sporcu kaydetme hatası:', err);
      return false;
    }
  },

  async deleteStudent(id) {
    if (!this.isConnected || !this.db) return false;
    try {
      await this.db.collection('students').doc(String(id)).delete();
      return true;
    } catch (err) {
      console.error('Firebase sporcu silme hatası:', err);
      return false;
    }
  },

  async getAttendance() {
    if (!await this._ensureConnected()) return null;
    try {
      const snap = await this.db.collection('attendance').orderBy('timestamp', 'desc').get();
      return snap.docs.map(doc => {
        const d = doc.data();
        return {
          recordId: d.record_id || doc.id,
          studentId: d.student_id,
          studentName: d.student_name,
          category: d.category || 'Genel',
          date: d.date,
          time: d.time,
          status: d.status || 'Geldi',
          timestamp: Number(d.timestamp) || Date.now()
        };
      });
    } catch (err) {
      console.error('Firebase yoklama listesi alma hatası:', err);
      return null;
    }
  },

  async addAttendance(record) {
    if (!this.isConnected || !this.db) return false;
    try {
      await this.db.collection('attendance').doc(String(record.recordId)).set({
        record_id: record.recordId,
        student_id: record.studentId,
        student_name: record.studentName,
        category: record.category || 'Genel',
        date: record.date,
        time: record.time,
        status: record.status || 'Geldi',
        timestamp: record.timestamp || Date.now()
      });
      return true;
    } catch (err) {
      console.error('Firebase yoklama ekleme hatası:', err);
      return false;
    }
  },

  async deleteAttendance(recordId) {
    if (!this.isConnected || !this.db) return false;
    try {
      await this.db.collection('attendance').doc(String(recordId)).delete();
      return true;
    } catch (err) {
      console.error('Firebase yoklama silme hatası:', err);
      return false;
    }
  },

  async getSettings() {
    if (!await this._ensureConnected()) return null;
    try {
      const doc = await this.db.collection('settings').doc('club_settings').get();
      return doc.exists ? doc.data().value : null;
    } catch {
      return null;
    }
  },

  async saveSettings(settings) {
    if (!this.isConnected || !this.db) return false;
    try {
      await this.db.collection('settings').doc('club_settings').set({ value: settings }, { merge: true });
      return true;
    } catch (err) {
      console.error('Firebase ayar kaydetme hatası:', err);
      return false;
    }
  },

  // Chunk helper: Firebase batch max 500 dok
  async _batchWrite(collection, items) {
    const CHUNK = 480;
    for (let i = 0; i < items.length; i += CHUNK) {
      const batch = this.db.batch();
      items.slice(i, i + CHUNK).forEach(({ id, data }) => {
        batch.set(this.db.collection(collection).doc(String(id)), data, { merge: true });
      });
      await batch.commit();
    }
  },

  // Yereldeki tüm verileri Firebase'e aktar
  async uploadLocalDataToSupabase(localStudents, localAttendance, localSettings) {
    if (!this.isConnected || !this.db) {
      return { success: false, error: 'Firebase bağlı değil.' };
    }
    try {
      let studentsCount = 0;
      let attendanceCount = 0;

      if (Array.isArray(localStudents) && localStudents.length > 0) {
        const items = localStudents.map(s => ({
          id: s.id,
          data: {
            id: s.id,
            name: s.name,
            faculty: s.faculty || '',
            department: s.department || '',
            category: s.category || 'Genel',
            phone: s.phone || '',
            notes: s.notes || '',
            role: s.role || ''
          }
        }));
        await this._batchWrite('students', items);
        studentsCount = items.length;
      }

      if (Array.isArray(localAttendance) && localAttendance.length > 0) {
        const items = localAttendance.map(r => ({
          id: r.recordId,
          data: {
            record_id: r.recordId,
            student_id: r.studentId,
            student_name: r.studentName,
            category: r.category || 'Genel',
            date: r.date,
            time: r.time,
            status: r.status || 'Geldi',
            timestamp: r.timestamp || Date.now()
          }
        }));
        await this._batchWrite('attendance', items);
        attendanceCount = items.length;
      }

      if (localSettings) {
        await this.saveSettings(localSettings);
      }

      return { success: true, studentsCount, attendanceCount };
    } catch (e) {
      console.error('Firebase buluta aktarma hatası:', e);
      return { success: false, error: e.message || 'Veriler aktarılırken hata oluştu.' };
    }
  },

  // --- DUYURULAR ---
  async getAnnouncementsCloud() {
    try {
      if (!await this._ensureConnected()) return null;
      const doc = await this.db.collection('settings').doc('club_announcements').get();
      const val = doc.exists ? doc.data().value : null;
      return Array.isArray(val) ? val : null;
    } catch (e) {
      console.warn('Firebase duyurular alınamadı:', e);
      return null;
    }
  },

  async saveAnnouncementsCloud(list) {
    try {
      if (!this.isConnected || !this.db) return false;
      await this.db.collection('settings').doc('club_announcements').set({ value: list });
      return true;
    } catch (e) {
      console.error('Firebase duyurular kaydetme hatası:', e);
      return false;
    }
  },

  // --- ANTRENMAN SEANSLARI ---
  async getSessionsCloud() {
    try {
      if (!await this._ensureConnected()) return null;
      const doc = await this.db.collection('settings').doc('club_sessions').get();
      const val = doc.exists ? doc.data().value : null;
      return Array.isArray(val) ? val : null;
    } catch (e) {
      console.warn('Firebase seanslar alınamadı:', e);
      return null;
    }
  },

  async saveSessionsCloud(list) {
    try {
      if (!this.isConnected || !this.db) return false;
      await this.db.collection('settings').doc('club_sessions').set({ value: list });
      return true;
    } catch (e) {
      console.error('Firebase seansları kaydetme hatası:', e);
      return false;
    }
  },

  // --- YÖNETİM KURULU ---
  async getBoardMembersCloud() {
    try {
      if (!await this._ensureConnected()) return null;
      const settingsDoc = await this.db.collection('settings').doc('club_settings').get();
      if (!settingsDoc.exists) return null;
      const rolesMap = (settingsDoc.data().value || {}).rolesMap || {};
      const roleIds = Object.keys(rolesMap);
      if (roleIds.length === 0) return null;

      const snap = await this.db.collection('students').get();
      const students = snap.docs.map(d => d.data()).filter(s => roleIds.includes(String(s.id)));
      if (!students.length) return null;

      const boardList = students.map(s => ({
        ...s,
        role: rolesMap[s.id] || s.role || 'Yönetim Kurulu Üyesi'
      }));

      const rolePriority = ['kulüp başkanı', 'başkan', 'başkan yardımcısı', 'okçu başı', 'antrenör', 'genel sekreter', 'sayman', 'muhasip', 'yönetim kurulu'];
      boardList.sort((a, b) => {
        const iA = rolePriority.findIndex(p => (a.role || '').toLowerCase().includes(p));
        const iB = rolePriority.findIndex(p => (b.role || '').toLowerCase().includes(p));
        return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
      });

      return boardList;
    } catch (e) {
      console.warn('Firebase yönetim kurulu alınamadı:', e);
      return null;
    }
  }
};

// Geriye dönük uyumluluk: tüm mevcut kod window.SupabaseDB kullanıyor
window.SupabaseDB = FirebaseDB;
window.FirebaseDB = FirebaseDB;
