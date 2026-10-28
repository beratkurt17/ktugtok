// QR Kod Kamera ve Resim/Dosya Tarayıcı Motoru (KTÜ GTOK)
const Scanner = {
  html5QrCode: null,
  isScanning: false,
  currentCameraId: null,

  init() {
    this.setupCameraSelect();
    this.setupButtons();
    this.setupFileAndClipboardScan();
  },

  async setupCameraSelect() {
    const select = document.getElementById('camera-select');
    if (!select) return;
    // Kamera listesi sadece izin verildikten sonra doldurulur (start() sonrasında)
    // Başlangıçta sadece varsayılan seçenek göster
    select.innerHTML = '<option value="">Otomatik Seç</option>';
  },

  async refreshCameraList() {
    const select = document.getElementById('camera-select');
    if (!select || !window.Html5Qrcode) return;
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || !devices.length) return;

      const FRONT_KW = ['front', 'ön', 'selfie', 'user', 'facing front', 'forward'];
      const EXTRA_KW = ['ultra', 'wide', 'geniş', 'tele', 'macro', 'depth', '0.6', '0.5'];

      const frontCams = devices.filter(d => FRONT_KW.some(kw => (d.label || '').toLowerCase().includes(kw)));
      const backCams  = devices.filter(d => !FRONT_KW.some(kw => (d.label || '').toLowerCase().includes(kw)));

      // Extra keyword içermeyen arka kamera = ana kamera; yoksa ilk arka kamera
      const mainBack  = backCams.find(d => !EXTRA_KW.some(kw => (d.label || '').toLowerCase().includes(kw))) || backCams[0];
      const mainFront = frontCams[0];

      select.innerHTML = '';
      if (mainBack) {
        const opt = document.createElement('option');
        opt.value = mainBack.id;
        opt.textContent = 'Arka Kamera';
        select.appendChild(opt);
      }
      if (mainFront) {
        const opt = document.createElement('option');
        opt.value = mainFront.id;
        opt.textContent = 'Ön Kamera';
        select.appendChild(opt);
      }

      if (this.currentCameraId && select.querySelector(`option[value="${CSS.escape(this.currentCameraId)}"]`)) {
        select.value = this.currentCameraId;
      } else if (mainBack) {
        select.value = mainBack.id;
        this.currentCameraId = mainBack.id;
      }
    } catch (err) {
      console.warn('Kamera listesi alınamadı:', err);
    }
  },

  setupButtons() {
    const toggleBtn = document.getElementById('btn-toggle-camera');
    const select = document.getElementById('camera-select');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (this.isScanning) {
          this.stop();
        } else {
          this.start();
        }
      });
    }

    if (select) {
      select.addEventListener('change', () => {
        this.currentCameraId = select.value;
        if (this.isScanning) {
          this.stop().then(() => this.start());
        }
      });
    }
  },

  // 1. Resimden / Galeriden QR Okuma & Ctrl+V Pano Desteği
  setupFileAndClipboardScan() {
    const fileInput = document.getElementById('qr-file-input');
    const dropZone = document.getElementById('camera-box-dropzone');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.scanImageFile(file);
      });
    }

    // Sürükle - Bırak ile Resim QR Okuma
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropZone.classList.add('drag-active');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropZone.classList.remove('drag-active');
        }, false);
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          this.scanImageFile(files[0]);
        }
      });
    }

    // Pano Yapıştırma (Ctrl + V) Desteği (Örn: WhatsApp Web'den kopyalanan QR resmi!)
    document.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          AttendanceManager.showToast('📋 Panodan yapıştırılan QR resmi taranıyor...', 'info');
          this.scanImageFile(blob);
          break;
        }
      }
    });
  },

  // Resim Dosyasından QR Çözümleme
  async scanImageFile(imageFile) {
    if (!imageFile) return;

    const statusText = document.getElementById('camera-status-text');
    if (statusText) statusText.textContent = '🖼️ Resimdeki QR kod taranıyor...';

    // Eğer kamera açıksa geçici olarak durdurma gereği duyabilir veya bağımsız scanner nesnesi kullanabiliriz
    try {
      const fileScanner = new Html5Qrcode("reader-file-temp");
      const decodedText = await fileScanner.scanFile(imageFile, true);
      await fileScanner.clear();

      // Başarılı Çözümleme!
      if (statusText) statusText.textContent = `✓ Resim Başarıyla Okundu (${decodedText})`;
      AttendanceManager.processCheckIn(decodedText);
    } catch (err) {
      console.warn('Dosyadan QR okunamadı:', err);
      if (statusText) statusText.textContent = '⚠️ Seçilen resimde net bir QR kod bulunamadı.';
      AttendanceManager.showToast('Resimde QR kod bulunamadı veya çözülemedi.', 'error');
    }

    // Inputu temizle ki aynı dosya tekrar seçilebilsin
    const fileInput = document.getElementById('qr-file-input');
    if (fileInput) fileInput.value = '';
  },

  async start() {
    const readerElement = document.getElementById('reader');
    const statusText = document.getElementById('camera-status-text');
    const toggleBtn = document.getElementById('btn-toggle-camera');

    if (!readerElement) return;

    if (!window.Html5Qrcode) {
      if (statusText) statusText.textContent = '⚠️ QR kamera kütüphanesi yüklenemedi. Sayfayı yenileyin.';
      return;
    }

    // Her başlatmada temiz bir instance kullan
    if (this.html5QrCode) {
      try { await this.html5QrCode.clear(); } catch(_) {}
      this.html5QrCode = null;
    }
    readerElement.innerHTML = '';
    this.html5QrCode = new Html5Qrcode("reader");

    // Kullanıcı dropdown'dan bir kamera seçtiyse onu kullan
    const select = document.getElementById('camera-select');
    const selectedId = select && select.value && select.value !== '' ? select.value : null;

    let cameraConfig;
    if (selectedId) {
      this.currentCameraId = selectedId;
      cameraConfig = { deviceId: { exact: selectedId } };
    } else {
      // getUserMedia ile önceden açmadan direkt label ile seç (çift açma → siyah ekran sorununu önler)
      try {
        const devices = await Html5Qrcode.getCameras();
        const FRONT_KW = ['front', 'ön', 'selfie', 'user', 'facing front', 'forward'];
        const EXTRA_KW = ['ultra', 'wide', 'geniş', 'tele', 'macro', 'depth', '0.6', '0.5'];

        const backCams = devices.filter(d => !FRONT_KW.some(kw => (d.label || '').toLowerCase().includes(kw)));
        const picked = backCams.find(d => !EXTRA_KW.some(kw => (d.label || '').toLowerCase().includes(kw)))
          || backCams[0]
          || devices[0];

        if (picked) {
          this.currentCameraId = picked.id;
          cameraConfig = { deviceId: { exact: picked.id } };
        }
      } catch (_) {}

      if (!cameraConfig) {
        cameraConfig = { facingMode: 'environment' };
      }
    }

    const qrConfig = {
      fps: 25,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const edge = Math.max(220, Math.floor(minEdge * 0.72));
        return { width: edge, height: edge };
      },
      aspectRatio: 1.0
    };

    try {
      if (statusText) statusText.textContent = 'Kamera izni isteniyor...';

      await this.html5QrCode.start(
        cameraConfig,
        qrConfig,
        (decodedText) => {
          AttendanceManager.processCheckIn(decodedText);
        },
        (_errorMessage) => {
          // Karede QR yokken normal tarama akışı
        }
      );

      this.isScanning = true;
      this._facingModeFallback = false;
      if (statusText) statusText.textContent = 'Kamera Aktif • QR Kodu Hedefe Gösterin';
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span>⏹️ Kamerayı Kapat</span>';
        toggleBtn.className = 'btn btn-danger';
      }
      document.getElementById('scanner-overlay')?.style.setProperty('display', 'flex');

      // Kamera başladıktan sonra gerçek kamera listesini güncelle
      this.refreshCameraList();
    } catch (err) {
      console.error('Kamera başlatma hatası:', err);
      this.isScanning = false;
      try { await this.html5QrCode.clear(); } catch(_) {}
      this.html5QrCode = null;

      if (toggleBtn) {
        toggleBtn.innerHTML = '<span>📷 Kamerayı Başlat</span>';
        toggleBtn.className = 'btn btn-primary';
      }

      const msg = String(err).toLowerCase();
      if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
        if (statusText) statusText.textContent = '🚫 Kamera izni reddedildi. Tarayıcı ayarlarından kamera iznini verin.';
      } else if (msg.includes('notfound') || msg.includes('nodevice') || msg.includes('overconstrained')) {
        if (this.currentCameraId && !this._facingModeFallback) {
          // deviceId ile başarısız → facingMode:environment ile bir kez daha dene
          this.currentCameraId = null;
          this._facingModeFallback = true;
          if (select) select.value = '';
          if (statusText) statusText.textContent = '📷 facingMode ile tekrar deneniyor...';
          setTimeout(() => this.start(), 500);
        } else {
          this._facingModeFallback = false;
          if (statusText) statusText.textContent = '📷 Kamera bulunamadı. Cihazınızın kamera iznini kontrol edin.';
        }
      } else {
        if (statusText) statusText.textContent = `⚠️ Kamera açılamadı: ${err.message || err}`;
      }
    }
  },


  async stop() {
    const statusText = document.getElementById('camera-status-text');
    const toggleBtn = document.getElementById('btn-toggle-camera');

    if (this.html5QrCode) {
      try {
        if (this.isScanning) {
          await this.html5QrCode.stop();
        }
        await this.html5QrCode.clear();
      } catch (e) {
        console.warn('Kamera durdurma:', e);
      }
      this.html5QrCode = null;
    }
    this.isScanning = false;

    if (statusText) statusText.textContent = 'Kamera Kapalı';
    if (toggleBtn) {
      toggleBtn.innerHTML = '<span>📷 Kamerayı Başlat</span>';
      toggleBtn.className = 'btn btn-primary';
    }
    document.getElementById('scanner-overlay')?.style.setProperty('display', 'none');
  }
};

window.Scanner = Scanner;
