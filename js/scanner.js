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
      if (devices && devices.length) {
        const currentId = this.currentCameraId;
        select.innerHTML = '<option value="">Otomatik Seç</option>';
        devices.forEach((dev, idx) => {
          const opt = document.createElement('option');
          opt.value = dev.id;
          opt.textContent = dev.label || `Kamera ${idx + 1}`;
          select.appendChild(opt);
        });
        const backCam = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('arka') ||
          d.label.toLowerCase().includes('environment')
        );
        if (currentId && devices.find(d => d.id === currentId)) {
          select.value = currentId;
        } else if (backCam) {
          select.value = backCam.id;
        }
        this.currentCameraId = select.value || null;
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
      // Kamera listesinden arka kamerayı bul
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          // 1. Label ile arka kamerayı ara
          const backCam = devices.find(d => {
            const label = (d.label || '').toLowerCase();
            return label.includes('back') || label.includes('arka') ||
                   label.includes('environment') || label.includes('rear');
          });

          if (backCam) {
            this.currentCameraId = backCam.id;
            cameraConfig = { deviceId: { exact: backCam.id } };
          } else if (devices.length > 1) {
            // 2. Label eşleşmezse: getCapabilities ile facingMode kontrol et
            let foundByCapability = null;
            for (const dev of devices) {
              try {
                const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: dev.id } } });
                const track = s.getVideoTracks()[0];
                const caps = track.getCapabilities ? track.getCapabilities() : {};
                s.getTracks().forEach(t => t.stop());
                if (caps.facingMode && caps.facingMode.includes('environment')) {
                  foundByCapability = dev;
                  break;
                }
              } catch (_) {}
            }

            if (foundByCapability) {
              this.currentCameraId = foundByCapability.id;
              cameraConfig = { deviceId: { exact: foundByCapability.id } };
            } else {
              // 3. Genellikle son sıradaki kamera arka kameradır
              const lastCam = devices[devices.length - 1];
              this.currentCameraId = lastCam.id;
              cameraConfig = { deviceId: { exact: lastCam.id } };
            }
          } else {
            cameraConfig = { facingMode: 'environment' };
          }
        } else {
          cameraConfig = { facingMode: 'environment' };
        }
      } catch (_) {
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
        if (this.currentCameraId) {
          // Belirli kamerayla başarısız → facingMode ile tekrar dene
          this.currentCameraId = null;
          if (select) select.value = '';
          if (statusText) statusText.textContent = '📷 Varsayılan kamerayla tekrar deneniyor...';
          setTimeout(() => this.start(), 500);
        } else {
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
