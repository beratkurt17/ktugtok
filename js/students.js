// KTÜ GTOK Sporcu Yönetimi ve Yüksek Kontrastlı QR Kimlik Kartı Motoru
const StudentsManager = {
  activeStudent: null,

  init() {
    this.renderStudentsList();
    this.setupListeners();
  },

  setupListeners() {
    const searchInput = document.getElementById('student-search-input');
    const categoryFilter = document.getElementById('student-category-filter');
    const roleFilter = document.getElementById('student-role-filter');
    const sessionFilter = document.getElementById('student-session-filter');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderStudentsList());
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.renderStudentsList());
    }
    if (roleFilter) {
      roleFilter.addEventListener('change', () => this.renderStudentsList());
    }
    if (sessionFilter) {
      sessionFilter.addEventListener('change', () => this.renderStudentsList());
    }

    const studentForm = document.getElementById('student-form');
    if (studentForm) {
      studentForm.addEventListener('submit', (e) => this.handleSaveStudent(e));
    }
  },

  renderStudentsList() {
    const container = document.getElementById('students-container');
    if (!container) return;

    const search = (document.getElementById('student-search-input')?.value || '').toLowerCase();
    const category = document.getElementById('student-category-filter')?.value || 'ALL';
    const roleFilter = document.getElementById('student-role-filter')?.value || 'ALL';
    const sessionFilter = document.getElementById('student-session-filter')?.value || 'ALL';

    let list = Storage.getStudents();

    if (category !== 'ALL') {
      list = list.filter(s => s.category === category);
    }

    if (roleFilter === 'YK') {
      list = list.filter(s => !!(s.role && s.role.trim()));
    } else if (roleFilter === 'MEMBER') {
      list = list.filter(s => !(s.role && s.role.trim()));
    }

    if (sessionFilter === 'UNASSIGNED') {
      list = list.filter(s => !s.session || !s.session.trim());
    } else if (sessionFilter !== 'ALL') {
      list = list.filter(s => (s.session || '').trim().toLowerCase() === sessionFilter.trim().toLowerCase());
    }

    if (search.trim()) {
      list = list.filter(s => 
        s.name.toLowerCase().includes(search) || 
        s.id.toLowerCase().includes(search) ||
        (s.role && s.role.toLowerCase().includes(search)) ||
        (s.session && s.session.toLowerCase().includes(search)) ||
        (s.faculty && s.faculty.toLowerCase().includes(search)) ||
        (s.department && s.department.toLowerCase().includes(search)) ||
        (s.phone && s.phone.includes(search))
      );
    }

    this.updateCategoryOptions();

    const countBadge = document.getElementById('total-students-count');
    if (countBadge) countBadge.textContent = `${list.length} Sporcu`;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="icon">🏹</span>
          <h3>Kriterlere uygun öğrenci/sporcu bulunamadı</h3>
          <p>Yeni bir okçu eklemek için yukarıdaki 'Yeni Sporcu Ekle' butonuna tıklayabilirsiniz.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(student => {
      const isVip = !!(student.role && student.role.trim());
      return `
      <div class="student-card ${isVip ? 'vip-card' : ''}" id="card-${student.id}">
        <div class="student-card-top">
          <div class="student-avatar-big">
            ${this.getInitials(student.name)}
          </div>
          <div class="student-details">
            <h3>${this.escapeHtml(student.name)}</h3>
            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.2rem;">
              ${isVip 
                ? `<span class="badge-role">⚜️ ${this.escapeHtml(student.role)}</span>` 
                : `<span class="badge-category">${this.escapeHtml(student.category || 'Okçu')}</span>`}
              ${student.session ? `
                <span style="font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 600; cursor: pointer;" onclick="SessionManager.promptChangeStudentSession('${student.id}')" title="Seansı Değiştirmek İçin Tıklayın">
                  ⏰ ${this.escapeHtml(student.session)} ✏️
                </span>` : `
                <span style="font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: rgba(255,255,255,0.05); color: #94a3b8; cursor: pointer;" onclick="SessionManager.promptChangeStudentSession('${student.id}')" title="Seans Belirle">
                  + Seans Ata
                </span>`}
            </div>
          </div>
        </div>

        <div class="student-info-row">
          <span>Okçu No:</span>
          <strong style="color: var(--gold);">${this.escapeHtml(student.id)}</strong>
        </div>
        <div class="student-info-row">
          <span>Antrenman Saati:</span>
          <span style="color: #38bdf8; font-weight: 600; cursor: pointer;" onclick="SessionManager.promptChangeStudentSession('${student.id}')" title="Seansı Değiştirmek İçin Tıklayın">
            ${this.escapeHtml(student.session || 'Seçilmedi')} ✏️
          </span>
        </div>
        ${isVip ? `
        <div class="student-info-row" style="color: var(--gold); font-weight: 600;">
          <span>YK Görevi:</span>
          <span>⚜️ ${this.escapeHtml(student.role)}</span>
        </div>` : ''}
        ${student.faculty ? `
        <div class="student-info-row">
          <span>Fakülte:</span>
          <span>${this.escapeHtml(student.faculty)}</span>
        </div>` : ''}
        ${student.department ? `
        <div class="student-info-row">
          <span>Bölüm:</span>
          <span>${this.escapeHtml(student.department)}</span>
        </div>` : ''}
        ${student.phone ? `
        <div class="student-info-row">
          <span>Telefon:</span>
          <span>${this.escapeHtml(student.phone)}</span>
        </div>` : ''}
        ${student.notes ? `
        <div class="student-info-row">
          <span>Ekipman/Not:</span>
          <span>${this.escapeHtml(student.notes)}</span>
        </div>` : ''}

        <div class="student-card-actions">
          <button class="btn btn-primary" style="flex: 1;" onclick="StudentsManager.showQRCard('${student.id}')">
            <span>🪪 ${isVip ? '⚜️ YK QR Kartı' : 'KTÜ QR Kartı'}</span>
          </button>
          <button class="btn btn-secondary btn-icon-only" title="Düzenle" onclick="StudentsManager.openEditModal('${student.id}')">
            ✏️
          </button>
          <button class="btn btn-danger btn-icon-only" title="Sil" onclick="StudentsManager.deleteStudent('${student.id}')">
            🗑️
          </button>
        </div>
      </div>
    `;
    }).join('');
  },

  updateCategoryOptions() {
    const select = document.getElementById('student-category-filter');
    if (!select) return;

    const currentVal = select.value;
    const students = Storage.getStudents();
    const categories = Array.from(new Set(students.map(s => s.category).filter(Boolean)));

    let html = '<option value="ALL">Tüm Kategoriler</option>';
    categories.forEach(cat => {
      html += `<option value="${this.escapeHtml(cat)}" ${currentVal === cat ? 'selected' : ''}>${this.escapeHtml(cat)}</option>`;
    });
    select.innerHTML = html;
  },

  getInitials(name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  },

  // Sıradaki Kulüp / Okçu Sicil Numarasını Otomatik Hesapla (0001, 0002...)
  getNextStudentId() {
    const students = Storage.getStudents();
    if (!students || students.length === 0) return '0001';

    let maxNum = 0;
    students.forEach(s => {
      const clean = (s.id || '').trim();
      const match = clean.match(/^0*(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum && num < 100000) {
          maxNum = num;
        }
      }
    });

    const next = maxNum + 1;
    return String(next).padStart(4, '0');
  },

  handleRoleSelectChange(selectEl) {
    const customInput = document.getElementById('student-role-custom-input');
    if (!customInput) return;
    if (selectEl.value === 'CUSTOM') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  },

  handleSessionSelectChange(selectEl) {
    const customInput = document.getElementById('student-session-custom-input');
    if (!customInput) return;
    if (selectEl.value === 'CUSTOM') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  },

  openAddModal() {
    document.getElementById('student-modal-title').textContent = 'Yeni KTÜ Okçusu / Üye Ekle';
    document.getElementById('student-id-input').value = this.getNextStudentId();
    document.getElementById('student-id-input').removeAttribute('readonly');
    document.getElementById('student-name-input').value = '';
    document.getElementById('student-faculty-input').value = '';
    document.getElementById('student-department-input').value = '';
    document.getElementById('student-category-input').value = 'Geleneksel Türk Okçuluğu';
    document.getElementById('student-phone-input').value = '';
    document.getElementById('student-notes-input').value = '';

    // Rol ve Görev Alanı Sıfırlama
    const roleSelect = document.getElementById('student-role-select');
    const roleCustomInput = document.getElementById('student-role-custom-input');
    if (roleSelect) roleSelect.value = '';
    if (roleCustomInput) {
      roleCustomInput.style.display = 'none';
      roleCustomInput.value = '';
    }

    // Seans / Grup Seçimi
    if (window.SessionManager) {
      SessionManager.populateSessionSelectOptions('');
    }
    const sessionCustomInput = document.getElementById('student-session-custom-input');
    if (sessionCustomInput) {
      sessionCustomInput.style.display = 'none';
      sessionCustomInput.value = '';
    }

    document.getElementById('student-is-edit').value = '0';
    const oldIdEl = document.getElementById('student-old-id');
    if (oldIdEl) oldIdEl.value = '';

    document.getElementById('student-modal').classList.add('active');
    setTimeout(() => {
      document.getElementById('student-id-input').focus();
    }, 150);
  },

  openEditModal(id) {
    const student = Storage.getStudentById(id);
    if (!student) return;

    document.getElementById('student-modal-title').textContent = 'Okçu / Üye Bilgilerini Düzenle';
    document.getElementById('student-id-input').value = student.id;
    // Numara serbestçe kafanıza göre değiştirilebilir!
    document.getElementById('student-id-input').removeAttribute('readonly');
    document.getElementById('student-name-input').value = student.name;
    document.getElementById('student-faculty-input').value = student.faculty || '';
    document.getElementById('student-department-input').value = student.department || '';
    document.getElementById('student-category-input').value = student.category || '';
    document.getElementById('student-phone-input').value = student.phone || '';
    document.getElementById('student-notes-input').value = student.notes || '';

    // Rol / Görev Bilgisini Doldur
    const roleSelect = document.getElementById('student-role-select');
    const roleCustomInput = document.getElementById('student-role-custom-input');
    const role = (student.role || '').trim();
    if (roleSelect && roleCustomInput) {
      if (!role) {
        roleSelect.value = '';
        roleCustomInput.style.display = 'none';
        roleCustomInput.value = '';
      } else {
        const matchingOption = Array.from(roleSelect.options).find(opt => opt.value === role && opt.value !== 'CUSTOM');
        if (matchingOption) {
          roleSelect.value = role;
          roleCustomInput.style.display = 'none';
          roleCustomInput.value = '';
        } else {
          roleSelect.value = 'CUSTOM';
          roleCustomInput.style.display = 'block';
          roleCustomInput.value = role;
        }
      }
    }

    // Seans / Grup Bilgisini Doldur
    if (window.SessionManager) {
      SessionManager.populateSessionSelectOptions(student.session || '');
    }
    const sessionCustomInput = document.getElementById('student-session-custom-input');
    if (sessionCustomInput) {
      sessionCustomInput.style.display = 'none';
      sessionCustomInput.value = '';
    }

    document.getElementById('student-is-edit').value = '1';
    const oldIdEl = document.getElementById('student-old-id');
    if (oldIdEl) oldIdEl.value = student.id;

    document.getElementById('student-modal').classList.add('active');
    setTimeout(() => {
      document.getElementById('student-id-input').focus();
    }, 150);
  },

  closeModal() {
    document.getElementById('student-modal').classList.remove('active');
  },

  handleSaveStudent(e) {
    e.preventDefault();
    const isEdit = document.getElementById('student-is-edit').value === '1';
    const oldId = (document.getElementById('student-old-id')?.value || '').trim();
    const id = document.getElementById('student-id-input').value.trim();
    const name = document.getElementById('student-name-input').value.trim();
    const faculty = document.getElementById('student-faculty-input').value.trim();
    const department = document.getElementById('student-department-input').value.trim();
    const category = document.getElementById('student-category-input').value.trim();
    const phone = document.getElementById('student-phone-input').value.trim();
    const notes = document.getElementById('student-notes-input').value.trim();

    // Rol / Görev Belirleme
    let role = '';
    const roleSelect = document.getElementById('student-role-select')?.value || '';
    if (roleSelect === 'CUSTOM') {
      role = (document.getElementById('student-role-custom-input')?.value || '').trim();
    } else {
      role = roleSelect;
    }

    // Seans / Grup Belirleme
    let session = '';
    const sessionSelect = document.getElementById('student-session-select')?.value || '';
    if (sessionSelect === 'CUSTOM') {
      session = (document.getElementById('student-session-custom-input')?.value || '').trim();
    } else {
      session = sessionSelect;
    }

    if (!id || !name) {
      alert('Lütfen Okçu No ve İsim alanlarını doldurun.');
      return;
    }

    const studentData = { id, name, faculty, department, category, phone, notes, role, session };

    // 1. DÜZENLEME DURUMU (Mevcut okçunun numarasını veya bilgilerini güncelleme)
    if (isEdit) {
      const isSameId = id.toUpperCase() === oldId.toUpperCase();
      if (isSameId) {
        // Numara aynı, sadece profil bilgilerini güncelle
        Storage.updateStudent(oldId, studentData);
      } else {
        // Numara değiştirilmiş! Hedef numarayı kullanan başka biri var mı?
        const targetStudent = Storage.findStudentByExactId(id);
        if (targetStudent && targetStudent.id.toUpperCase() !== oldId.toUpperCase()) {
          // KARŞILIKLI NUMARA TAKASI (Ben 17'yi alırım, 17'deki okçu benim eski numaramı alır!)
          const confirmed = confirm(
            `🎯 "${id}" numarası şu anda "${targetStudent.name}" isimli okçuya ait.\n\n` +
            `Karşılıklı numara takası yapılacak:\n` +
            `• Sizin yeni numaranız: ${id}\n` +
            `• "${targetStudent.name}" okçusunun yeni numarası: ${oldId}\n\n` +
            `Numaraları takas etmek istiyor musunuz?`
          );
          if (!confirmed) return;

          Storage.swapAndUpdateStudent(oldId, studentData, targetStudent);
          alert(`✅ Numara takası tamamlandı!\n\n- Sizin numaranız: ${id}\n- ${targetStudent.name} isimli okçunun yeni numarası: ${oldId}`);
        } else {
          // Hedef numara tamamen boşta
          Storage.updateStudent(oldId, studentData);
        }
      }
    } else {
      // 2. YENİ OKÇU EKLEME DURUMU
      const targetStudent = Storage.findStudentByExactId(id);
      if (targetStudent) {
        const vacantId = this.getNextStudentId();
        const confirmed = confirm(
          `🎯 "${id}" numarası şu anda "${targetStudent.name}" isimli okçuya ait.\n\n` +
          `• Yeni üyeye bu numara (${id}) verilecek.\n` +
          `• "${targetStudent.name}" okçusuna sıradaki boş numara (${vacantId}) aktarılacak.\n\n` +
          `Onaylıyor musunuz?`
        );
        if (!confirmed) return;

        Storage.assignIdAndShiftTarget(studentData, targetStudent, vacantId);
        alert(`✅ Yeni okçuya ${id} numarası verildi.\n\n"${targetStudent.name}" isimli okçunun yeni numarası ${vacantId} olarak güncellendi.`);
      } else {
        Storage.addStudent(studentData);
      }
    }

    this.closeModal();
    this.renderStudentsList();
    if (window.AttendanceManager) {
      window.AttendanceManager.renderTodayList();
    }

    // Sadece yeni okçu eklendiğinde veya numarası değiştiğinde kartı aç
    if (!isEdit || oldId !== id) {
      setTimeout(() => {
        this.showQRCard(id);
      }, 150);
    }
  },

  deleteStudent(id) {
    const student = Storage.getStudentById(id);
    if (!student) return;

    if (confirm(`"${student.name}" isimli okçuyu silmek istediğinize emin misiniz?`)) {
      Storage.deleteStudent(id);
      this.renderStudentsList();
    }
  },

  // KTÜ GTOK QR Kimlik Kartını Göster
  showQRCard(id) {
    const student = Storage.getStudentById(id);
    if (!student) return;

    this.activeStudent = student;
    const isVip = !!(student.role && student.role.trim());

    document.getElementById('idcard-name').textContent = student.name;
    document.getElementById('idcard-number').textContent = `OKÇU NO: ${student.id}`;
    document.getElementById('idcard-faculty-dept').textContent = [student.faculty, student.department].filter(Boolean).join(' • ') || 'Karadeniz Teknik Üniversitesi';
    document.getElementById('idcard-category').textContent = student.category || 'Okçu';

    const roleBanner = document.getElementById('idcard-role-banner');
    const printableCard = document.getElementById('printable-id-card');

    if (roleBanner) {
      if (isVip) {
        roleBanner.style.display = 'block';
        roleBanner.textContent = `⚜️ YÖNETİM KURULU • ${student.role.toUpperCase()}`;
      } else {
        roleBanner.style.display = 'none';
      }
    }

    if (printableCard) {
      if (isVip) {
        printableCard.classList.add('vip-card');
      } else {
        printableCard.classList.remove('vip-card');
      }
    }

    const qrContainer = document.getElementById('idcard-qrcode');
    qrContainer.innerHTML = '';

    // Optimum hata düzeltme seviyesi (Level M) ile telefon kameralarının anında okuyacağı net QR üretimi
    if (window.QRCode) {
      new QRCode(qrContainer, {
        text: String(student.id).trim(),
        width: 190,
        height: 190,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    document.getElementById('qr-card-modal').classList.add('active');
  },

  closeQRCardModal() {
    document.getElementById('qr-card-modal').classList.remove('active');
  },

  // KTÜ GTOK Telefon Uyumlu Yüksek Çözünürlüklü Dijital Kart PNG İndirme
  downloadCardImage() {
    if (!this.activeStudent) return;
    const student = this.activeStudent;
    const settings = Storage.getSettings();
    const isVip = !!(student.role && student.role.trim());

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');

    // 1. Asil Derin Koyu Zemin
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#1a1d24');
    bgGrad.addColorStop(0.4, '#13161c');
    bgGrad.addColorStop(1, '#0c0e12');
    ctx.fillStyle = bgGrad;
    ctx.roundRect(0, 0, canvas.width, canvas.height, 36);
    ctx.fill();

    // 2. Altın Yaldızlı Çerçeve
    if (isVip) {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
      ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 4;
    ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 28);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. İç İnce Hat
    ctx.strokeStyle = isVip ? 'rgba(251, 191, 36, 0.5)' : 'rgba(212, 163, 115, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(26, 26, canvas.width - 52, canvas.height - 52, 22);
    ctx.stroke();

    // 4. KTÜ & Kulüp Başlığı
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KARADENİZ TEKNİK ÜNİVERSİTESİ', 320, 75);

    ctx.fillStyle = '#d4a373';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText('GELENEKSEL TÜRK OKÇULUK KULÜBÜ', 320, 108);

    ctx.fillStyle = isVip ? '#fbbf24' : '#94a3b8';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(isVip ? '⚜️ YÖNETİM KURULU RESMİ KİMLİK KARTI' : 'RESMİ DİJİTAL SPORCU KİMLİK KARTI', 320, 134);

    // Çizgi
    ctx.strokeStyle = 'rgba(212, 163, 115, 0.3)';
    ctx.beginPath();
    ctx.moveTo(50, 150);
    ctx.lineTo(590, 150);
    ctx.stroke();

    // 5. Yüksek Kontrastlı QR Kodu
    const qrCanvas = document.querySelector('#idcard-qrcode canvas') || document.querySelector('#idcard-qrcode img');
    
    // QR Arkası Beyaz Güvenli Alan
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(145, 180, 350, 350, 24);
    ctx.fill();

    // QR İçi İnce Çerçeve
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.roundRect(155, 190, 330, 330, 16);
    ctx.stroke();

    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 175, 210, 290, 290);
    }

    // 6. Sporcu Kimlik Bilgileri
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText(student.name, 320, 585);

    ctx.fillStyle = '#d4a373';
    ctx.font = 'bold 25px Arial, sans-serif';
    ctx.fillText(`OKÇU NO: ${student.id}`, 320, 630);

    // Fakülte & Bölüm
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '18px Arial, sans-serif';
    const facDept = [student.faculty, student.department].filter(Boolean).join(' • ');
    ctx.fillText(facDept || 'KTÜ Öğrencisi', 320, 668);

    // Rol veya Kategori Rozeti
    if (isVip) {
      ctx.fillStyle = 'rgba(212, 163, 115, 0.22)';
      ctx.roundRect(120, 690, 400, 38, 19);
      ctx.fill();
      ctx.strokeStyle = '#d4a373';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText(`⚜️ ${student.role.toUpperCase()}`, 320, 715);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText(`Kategori: ${student.category || 'Okçu'}`, 320, 706);
    }

    // 7. Alt Güvenlik ve Talimat Kutusu
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.roundRect(45, 745, 550, 150, 18);
    ctx.fill();

    ctx.fillStyle = isVip ? '#fbbf24' : '#34d399';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(isVip ? '⚜️ KTÜ GTOK YÖNETİM KURULU ÜYESİ' : '✓ KTÜ GTOK LİSANSLI KEMANKEŞ', 320, 785);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText('Salona girişte telefonunuzdan bu karekodu kameraya gösteriniz.', 320, 820);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('KTÜ GELENEKSEL TÜRK OKÇULUK KULÜBÜ (KTÜ GTOK)', 320, 855);

    // İndir
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `KTU_GTOK_Kart_${student.id}_${student.name.replace(/\s+/g, '_')}.png`;
    a.click();
  },

  // Toplu A4 Baskı
  printAllCards() {
    const students = Storage.getStudents();
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>KTÜ GTOK Sporcu Kartları - Toplu A4 Baskı</title>
        <script src="lib/qrcode.min.js"></script>
        <style>
          body { font-family: sans-serif; background: #fff; margin: 10mm; }
          .cards-container { display: flex; flex-wrap: wrap; gap: 12px; }
          .card {
            width: 86mm;
            height: 54mm;
            border: 2px solid #b45309;
            border-radius: 8px;
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            background: #fff;
          }
          .card-header { font-size: 10px; font-weight: bold; color: #b45309; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
          .card-body { display: flex; align-items: center; justify-content: space-between; margin: 4px 0; }
          .qr-box { width: 95px; height: 95px; }
          .info-box { text-align: left; max-width: 170px; }
          .student-name { font-size: 13px; font-weight: bold; color: #000; }
          .student-no { font-size: 12px; font-weight: bold; color: #b45309; margin: 2px 0; }
          .student-dept { font-size: 9px; color: #555; }
          .student-cat { font-size: 9px; color: #2563eb; font-weight: bold; }
          .card-footer { font-size: 8px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 2px; }
        </style>
      </head>
      <body>
        <h3 style="text-align: center; margin-bottom: 15px;">Karadeniz Teknik Üniversitesi GTOK - Sporcu QR Kimlik Kartları</h3>
        <div class="cards-container" id="print-container"></div>
        <script>
          const students = ${JSON.stringify(students)};
          const container = document.getElementById('print-container');
          students.forEach(s => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = \`
              <div class="card-header">KTÜ GELENEKSEL TÜRK OKÇULUK KULÜBÜ</div>
              <div class="card-body">
                <div class="info-box">
                  <div class="student-name">\${s.name}</div>
                  <div class="student-no">Okçu No: \${s.id}</div>
                  <div class="student-dept">\${s.faculty || ''} \${s.department ? '• ' + s.department : ''}</div>
                  <div class="student-cat">\${s.category || 'Okçu'}</div>
                </div>
                <div class="qr-box" id="qr-\${s.id}"></div>
              </div>
              <div class="card-footer">KTÜ GTOK Yoklama • Girişte Kameraya Okutunuz</div>
            \`;
            container.appendChild(div);
            new QRCode(document.getElementById('qr-' + s.id), {
              text: s.id,
              width: 90,
              height: 90,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel.H
            });
          });
          setTimeout(() => { window.print(); }, 800);
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
};

window.StudentsManager = StudentsManager;
