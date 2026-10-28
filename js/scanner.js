// QR Kod Kamera ve Resim/Dosya Tarayıcı Motoru (KTÜ GTOK)
// Kamera yönetimi: getUserMedia (html5-qrcode'un kamera API'si bypass edildi)
// QR tarama: BarcodeDetector (native) veya canvas+html5-qrcode.scanFile fallback
const Scanner = {
  videoEl: null,
  stream: null,
  scanLoop: null,
  barcodeDetector: null,
  isScanning: false,
  currentCameraId: null,
  lastScanned: null,
  lastScannedTime: 0,

  init() {
    if ('BarcodeDetector' in window) {
      BarcodeDetector.getSupportedFormats().then(formats => {
        if (formats.includes('qr_code')) {
          this.barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        }
      }).catch(() => {});
    }
    this.setupCameraSelect();
    this.setupButtons();
    this.setupFileAndClipboardScan();
  },

  async setupCameraSelect() {
    const select = document.getElementById('camera-select');
    if (!select) return;
    select.innerHTML = '<option value="">Arka Kamera</option>';
  },

  async refreshCameraList() {
    const select = document.getElementById('camera-select');
    if (!select) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      if (!videoInputs.length) return;

      const FRONT_KW = ['front', 'ön', 'selfie', 'user', 'facing front', 'forward'];
      const EXTRA_KW = ['ultra', 'wide', 'geniş', 'tele', 'macro', 'depth', '0.6', '0.5'];

      const frontCams = videoInputs.filter(d => FRONT_KW.some(kw => (d.label || '').toLowerCase().includes(kw)));
      const backCams  = videoInputs.filter(d => !FRONT_KW.some(kw => (d.label || '').toLowerCase().includes(kw)));
      const mainBack  = backCams.find(d => !EXTRA_KW.some(kw => (d.label || '').toLowerCase().includes(kw))) || backCams[0];
      const mainFront = frontCams[0];

      select.innerHTML = '';
      if (mainBack) {
        const opt = document.createElement('option');
        opt.value = mainBack.deviceId;
        opt.textContent = 'Arka Kamera';
        select.appendChild(opt);
      }
      if (mainFront) {
        const opt = document.createElement('option');
        opt.value = mainFront.deviceId;
        opt.textContent = 'Ön Kamera';
        select.appendChild(opt);
      }

      if (this.currentCameraId) {
        const match = select.querySelector(`option[value="${CSS.escape(this.currentCameraId)}"]`);
        if (match) select.value = this.currentCameraId;
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
        this.currentCameraId = select.value || null;
        if (this.isScanning) {
          this.stop().then(() => this.start());
        }
      });
    }
  },

  setupFileAndClipboardScan() {
    const fileInput = document.getElementById('qr-file-input');
    const dropZone  = document.getElementById('camera-box-dropzone');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.scanImageFile(file);
      });
    }

    if (dropZone) {
      ['dragenter', 'dragover'].forEach(ev => {
        dropZone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropZone.classList.add('drag-active');
        }, false);
      });
      ['dragleave', 'drop'].forEach(ev => {
        dropZone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropZone.classList.remove('drag-active');
        }, false);
      });
      dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files?.length > 0) this.scanImageFile(files[0]);
      });
    }

    document.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          AttendanceManager.showToast('📋 Panodan yapıştırılan QR resmi taranıyor...', 'info');
          this.scanImageFile(item.getAsFile());
          break;
        }
      }
    });
  },

  async scanImageFile(imageFile) {
    if (!imageFile) return;
    const statusText = document.getElementById('camera-status-text');
    if (statusText) statusText.textContent = '🖼️ Resimdeki QR kod taranıyor...';
    try {
      const fileScanner = new Html5Qrcode('reader-file-temp');
      const decodedText = await fileScanner.scanFile(imageFile, true);
      await fileScanner.clear();
      if (statusText) statusText.textContent = `✓ Resim Başarıyla Okundu (${decodedText})`;
      AttendanceManager.processCheckIn(decodedText);
    } catch (err) {
      console.warn('Dosyadan QR okunamadı:', err);
      if (statusText) statusText.textContent = '⚠️ Seçilen resimde net bir QR kod bulunamadı.';
      AttendanceManager.showToast('Resimde QR kod bulunamadı veya çözülemedi.', 'error');
    }
    const fileInput = document.getElementById('qr-file-input');
    if (fileInput) fileInput.value = '';
  },

  async start() {
    const readerElement = document.getElementById('reader');
    const statusText    = document.getElementById('camera-status-text');
    const toggleBtn     = document.getElementById('btn-toggle-camera');
    const select        = document.getElementById('camera-select');

    if (!readerElement) return;

    await this.stop();
    readerElement.innerHTML = '';

    if (statusText) statusText.textContent = 'Kamera izni isteniyor...';

    // Video elementi
    this.videoEl = document.createElement('video');
    this.videoEl.setAttribute('autoplay', '');
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.setAttribute('muted', '');
    readerElement.appendChild(this.videoEl);

    // Kamera kısıtı: dropdown seçimi varsa o cihazı, yoksa arka kamera ideal
    const selectedId = select?.value || null;
    const videoConstraint = selectedId
      ? { deviceId: { exact: selectedId } }
      : { facingMode: { ideal: 'environment' } };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint });
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();

      const settings = this.stream.getVideoTracks()[0]?.getSettings?.() || {};
      if (settings.deviceId) this.currentCameraId = settings.deviceId;

      this.isScanning = true;
      if (statusText) statusText.textContent = 'Kamera Aktif • QR Kodu Hedefe Gösterin';
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span>⏹️ Kamerayı Kapat</span>';
        toggleBtn.className = 'btn btn-danger';
      }
      document.getElementById('scanner-overlay')?.style.setProperty('display', 'flex');

      await this.refreshCameraList();
      if (this.currentCameraId && select) {
        const match = select.querySelector(`option[value="${CSS.escape(this.currentCameraId)}"]`);
        if (match) select.value = this.currentCameraId;
      }

      this._startScanLoop();

    } catch (err) {
      console.error('Kamera hatası:', err);
      readerElement.innerHTML = '';
      this.videoEl = null;
      const msg = String(err).toLowerCase();
      if (statusText) {
        if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
          statusText.textContent = '🚫 Kamera izni reddedildi. Tarayıcı ayarlarından izni verin.';
        } else {
          statusText.textContent = `⚠️ Kamera açılamadı: ${err.name} – ${err.message}`;
        }
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span>📷 Kamerayı Başlat</span>';
        toggleBtn.className = 'btn btn-primary';
      }
    }
  },

  _startScanLoop() {
    if (this.scanLoop) clearInterval(this.scanLoop);

    if (this.barcodeDetector) {
      this.scanLoop = setInterval(async () => {
        if (!this.videoEl || this.videoEl.readyState < 2 || this.videoEl.paused) return;
        try {
          const barcodes = await this.barcodeDetector.detect(this.videoEl);
          if (barcodes.length > 0) this._onQrFound(barcodes[0].rawValue);
        } catch (_) {}
      }, 100);
    } else {
      // BarcodeDetector yoksa canvas üzerinden html5-qrcode.scanFile ile tara
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');
      let scanning = false;
      const fileScanner = new Html5Qrcode('reader-file-temp');

      this.scanLoop = setInterval(async () => {
        if (scanning || !this.videoEl || this.videoEl.readyState < 2 || this.videoEl.paused) return;
        scanning = true;
        canvas.width  = this.videoEl.videoWidth  || 640;
        canvas.height = this.videoEl.videoHeight || 480;
        ctx.drawImage(this.videoEl, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const result = await fileScanner.scanFile(new File([blob], 'f.jpg', { type: 'image/jpeg' }), false);
              this._onQrFound(result);
            } catch (_) {}
          }
          scanning = false;
        }, 'image/jpeg', 0.7);
      }, 250);
    }
  },

  _onQrFound(text) {
    const now = Date.now();
    if (text === this.lastScanned && now - this.lastScannedTime < 3000) return;
    this.lastScanned     = text;
    this.lastScannedTime = now;
    AttendanceManager.processCheckIn(text);
  },

  async stop() {
    const statusText = document.getElementById('camera-status-text');
    const toggleBtn  = document.getElementById('btn-toggle-camera');

    if (this.scanLoop) { clearInterval(this.scanLoop); this.scanLoop = null; }
    if (this.stream)   { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.videoEl)  { this.videoEl.srcObject = null; this.videoEl.remove(); this.videoEl = null; }

    const readerEl = document.getElementById('reader');
    if (readerEl) readerEl.innerHTML = '';

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
