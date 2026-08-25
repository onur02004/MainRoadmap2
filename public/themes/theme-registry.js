let activeModuleInstance = null;

export async function loadThemeModule(modulePath) {
  if (activeModuleInstance && typeof activeModuleInstance.destroy === 'function') {
    activeModuleInstance.destroy();
    activeModuleInstance = null;
  }

  if (modulePath) {
    try {
      const module = await import(`./modules/${modulePath}`);
      if (typeof module.init === 'function') {
        setTimeout(() => {
          activeModuleInstance = module.init();
        }, 50);
      }
    } catch (err) {
      console.warn('Theme interactive module failed to load:', err);
    }
  }
}

// Şık Toast Bildirim Motoru
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('themeToastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'themeToastContainer';
    toastContainer.className = 'theme-toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `theme-toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✔' : (type === 'info' ? '⚡' : '✖')}</span>
    <span class="toast-text">${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

export class ThemeManager {
  constructor(onThemeChangeCallback) {
    this.themes = {};
    this.currentThemeKey = localStorage.getItem('app-theme') || 'supabase-dark';
    this.activeCategory = 'all';
    this.searchTerm = '';
    this.isInspectMode = false;
    this.customBgDataUrl = null;
    this.onThemeChangeCallback = onThemeChangeCallback;
    this.init();
  }

  async init() {
    await this.fetchThemes();
    this.applyTheme(this.currentThemeKey, null, false);
    this.bindModalEvents();
    this.bindEditorEvents();
    this.bindDragAndDrop();
    this.bindInspectMode();
    this.renderModalGrid();
  }

  async fetchThemes() {
    const localCustomThemes = JSON.parse(localStorage.getItem('local-custom-themes') || '{}');

    try {
      const res = await fetch('/api/themes?userId=onur');
      if (res.ok) {
        const apiThemes = await res.json();
        this.themes = { ...apiThemes, ...localCustomThemes };
        return;
      }
    } catch (e) {
      // API Offline
    }

    try {
      const fallback = await fetch('themes/themes.json');
      if (fallback.ok) {
        const baseThemes = await fallback.json();
        this.themes = { ...baseThemes, ...localCustomThemes };
      }
    } catch (err) {
      this.themes = {
        'supabase-dark': {
          name: 'SUPABASE EMERALD',
          category: 'cli',
          hasCli: true,
          showGrid: true,
          dotColor: '#3ecf8e',
          statusText: 'POSTGRES V15.2 HEALTHY',
          stylesheet: null
        },
        ...localCustomThemes
      };
    }
  }

  renderModalGrid() {
    const grid = document.getElementById('modalThemesGrid');
    const badge = document.getElementById('themeCountBadge');
    if (!grid) return;

    grid.innerHTML = '';

    const filtered = Object.entries(this.themes).filter(([key, conf]) => {
      const matchCat = (this.activeCategory === 'all') || (conf.category === this.activeCategory);
      const matchSearch = conf.name.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
                          key.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });

    if (badge) {
      badge.textContent = `${filtered.length} of ${Object.keys(this.themes).length} Themes Available`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="modal-empty-state">
          <span>&#128269;</span>
          <p>No themes matching "<strong>${this.searchTerm}</strong>"</p>
        </div>
      `;
      return;
    }

    filtered.forEach(([key, conf]) => {
      const card = document.createElement('div');
      const isSelected = (key === this.currentThemeKey);
      card.className = `theme-card-item ${isSelected ? 'selected' : ''}`;
      card.dataset.theme = key;

      card.innerHTML = `
        <div class="theme-card-header">
          <span class="theme-card-dot" style="background:${conf.dotColor}; box-shadow: 0 0 8px ${conf.dotColor};"></span>
          <span class="theme-card-cat">${(conf.category || 'CUSTOM').toUpperCase()}</span>
          ${conf.isPublic ? '<span class="theme-card-badge public">PUBLIC</span>' : ''}
          ${conf.hasCli ? '<span class="theme-card-badge cli">CLI</span>' : '<span class="theme-card-badge gui">GUI</span>'}
        </div>
        <div class="theme-card-title">${conf.name}</div>
        <div class="theme-card-status">${conf.statusText || 'RUNTIME ACTIVE'}</div>
      `;

      card.addEventListener('click', () => {
        this.applyTheme(key, null, true);
        this.closeModal();
      });

      grid.appendChild(card);
    });
  }

  applyTheme(themeKey, overrideConfig = null, notify = false) {
    const conf = overrideConfig || this.themes[themeKey] || this.themes['supabase-dark'] || {
      name: themeKey.toUpperCase(),
      category: 'cli',
      hasCli: true,
      showGrid: true,
      dotColor: '#3ecf8e',
      statusText: 'ONLINE',
      stylesheet: null
    };

    this.currentThemeKey = themeKey;
    if (!overrideConfig) {
      localStorage.setItem('app-theme', themeKey);
    }
    document.documentElement.setAttribute('data-theme', themeKey);

    // 1. Özel CSS Değişkenlerini (Variables) Enjekte Et
    if (conf.cssVariables) {
      Object.entries(conf.cssVariables).forEach(([cssVar, value]) => {
        document.documentElement.style.setProperty(cssVar, value);
      });
    } else {
      document.documentElement.removeAttribute('style');
    }

    // 2. Özel Arka Plan Resmi
    const bgUrl = conf.bgImage || this.customBgDataUrl;
    if (bgUrl) {
      document.body.style.backgroundImage = `linear-gradient(rgba(10, 10, 14, 0.82), rgba(6, 6, 10, 0.94)), url('${bgUrl}')`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
    }

    // 3. Scanline CRT Overlay
    if (conf.scanlines) {
      document.body.classList.add('custom-crt-scanlines');
    } else {
      document.body.classList.remove('custom-crt-scanlines');
    }

    // 4. Nav Bar Etiketi ve Durum Işığı
    const labelEl = document.getElementById('currentThemeName');
    const navDot = document.getElementById('navThemeDot');
    if (labelEl) labelEl.textContent = `THEME: ${conf.name}`;
    if (navDot) {
      navDot.style.backgroundColor = conf.dotColor;
      navDot.style.boxShadow = `0 0 8px ${conf.dotColor}`;
    }

    // 5. CLI vs GUI Panel Değişimi
    const terminalViewport = document.getElementById('cliTerminalViewport');
    const guiUserPanel = document.getElementById('guiUserPanel');

    if (conf.hasCli) {
      if (terminalViewport) terminalViewport.style.display = 'flex';
      if (guiUserPanel) guiUserPanel.style.display = 'none';
    } else {
      if (terminalViewport) terminalViewport.style.display = 'none';
      if (guiUserPanel) guiUserPanel.style.display = 'flex';
    }

    // 6. Sağ Üst Arka Plan Izgarası
    const bgGridLayer = document.getElementById('bgGridLayer');
    if (bgGridLayer) {
      const isGridVisible = conf.showGrid !== undefined ? conf.showGrid : true;
      bgGridLayer.style.display = isGridVisible ? 'flex' : 'none';
    }

    // 7. Harici CSS Dosyasını Dahil Et
    this.injectExternalStylesheet(conf.stylesheet);

    // 8. İnteraktif Modülü Yükle
    loadThemeModule(conf.module);

    this.renderModalGrid();

    if (notify) {
      showToast(`Applied Theme: <strong>${conf.name}</strong>`, 'success');
    }

    if (this.onThemeChangeCallback) {
      this.onThemeChangeCallback(themeKey, conf);
    }
  }

  injectExternalStylesheet(href) {
    const existingLink = document.getElementById('dynamicThemeStyle');
    if (existingLink) {
      existingLink.remove();
    }

    if (href) {
      const link = document.createElement('link');
      link.id = 'dynamicThemeStyle';
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  openModal() {
    const backdrop = document.getElementById('themeModalBackdrop');
    const searchInput = document.getElementById('themeSearchInput');
    if (!backdrop) return;

    backdrop.style.display = 'flex';
    this.renderModalGrid();
    
    if (searchInput) {
      searchInput.value = '';
      this.searchTerm = '';
      setTimeout(() => searchInput.focus(), 50);
    }
  }

  closeModal() {
    const backdrop = document.getElementById('themeModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  bindModalEvents() {
    const openBtn = document.getElementById('themeModalOpenBtn');
    const closeBtn = document.getElementById('themeModalCloseBtn');
    const backdrop = document.getElementById('themeModalBackdrop');
    const searchInput = document.getElementById('themeSearchInput');
    const categoryChips = document.querySelectorAll('.cat-chip');

    if (openBtn) openBtn.addEventListener('click', () => this.openModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const isOpen = backdrop && backdrop.style.display === 'flex';
        if (isOpen) this.closeModal();
        else this.openModal();
      }
      if (e.key === 'Escape') {
        const drawer = document.getElementById('themeEditorDrawer');
        if (drawer && drawer.style.display === 'flex') {
          drawer.style.display = 'none';
          this.disableInspectMode();
          return;
        }
        if (backdrop && backdrop.style.display === 'flex') {
          this.closeModal();
        }
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        this.renderModalGrid();
      });
    }

    categoryChips.forEach(chip => {
      if (chip.id === 'btnOpenThemeStudio') return;
      chip.addEventListener('click', () => {
        categoryChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.dataset.cat;
        this.renderModalGrid();
      });
    });
  }

  // --- GELİŞMİŞ EDİTÖR ETKİLEŞİMLERİ ---
  bindEditorEvents() {
    const btnOpenEditor = document.getElementById('btnOpenThemeStudio');
    const btnCloseEditor = document.getElementById('btnCloseEditor');
    const drawer = document.getElementById('themeEditorDrawer');
    const form = document.getElementById('themeEditorForm');
    const btnPreview = document.getElementById('btnPreviewTheme');

    // Slider Senkronizasyonları
    const radiusSlider = document.getElementById('edBorderRadius');
    const glowSlider = document.getElementById('edGlowIntensity');
    const blurSlider = document.getElementById('edBackdropBlur');

    if (radiusSlider) {
      radiusSlider.addEventListener('input', (e) => {
        document.getElementById('valBorderRadius').textContent = `${e.target.value}px`;
        this.liveQuickUpdate();
      });
    }
    if (glowSlider) {
      glowSlider.addEventListener('input', (e) => {
        document.getElementById('valGlowIntensity').textContent = `${e.target.value}%`;
        this.liveQuickUpdate();
      });
    }
    if (blurSlider) {
      blurSlider.addEventListener('input', (e) => {
        document.getElementById('valBackdropBlur').textContent = `${e.target.value}px`;
        this.liveQuickUpdate();
      });
    }

    // Renk ve Font Anlık Tepkisi
    ['edColorAccent', 'edColorBg', 'edColorPanel', 'edColorText', 'edFontFamily', 'edScanlines'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.liveQuickUpdate());
      }
    });

    // Hazır Renk Presetleri
    const presets = {
      neon: { accent: '#ff007f', bg: '#0b0014', panel: '#1a0029', text: '#ffe6f2', font: "'Orbitron', sans-serif", radius: 8, glow: 75 },
      matrix: { accent: '#00ff66', bg: '#030a05', panel: '#07170b', text: '#b3ffcc', font: "'VT323', monospace", radius: 0, glow: 60 },
      dracula: { accent: '#bd93f9', bg: '#282a36', panel: '#44475a', text: '#f8f8f2', font: "'JetBrains Mono', monospace", radius: 10, glow: 40 },
      clean: { accent: '#0066ff', bg: '#f4f6f9', panel: '#ffffff', text: '#1e293b', font: "'JetBrains Mono', monospace", radius: 12, glow: 20 }
    };

    document.querySelectorAll('.preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const p = presets[pill.dataset.preset];
        if (!p) return;

        document.getElementById('edColorAccent').value = p.accent;
        document.getElementById('edColorBg').value = p.bg;
        document.getElementById('edColorPanel').value = p.panel;
        document.getElementById('edColorText').value = p.text;
        document.getElementById('edFontFamily').value = p.font;
        document.getElementById('edBorderRadius').value = p.radius;
        document.getElementById('valBorderRadius').textContent = `${p.radius}px`;
        document.getElementById('edGlowIntensity').value = p.glow;
        document.getElementById('valGlowIntensity').textContent = `${p.glow}%`;

        this.liveQuickUpdate();
        showToast(`Loaded Preset: <strong>${pill.textContent}</strong>`, 'info');
      });
    });

    if (btnOpenEditor) {
      btnOpenEditor.addEventListener('click', () => {
        this.closeModal();
        if (drawer) drawer.style.display = 'flex';
      });
    }

    if (btnCloseEditor) {
      btnCloseEditor.addEventListener('click', () => {
        if (drawer) drawer.style.display = 'none';
        this.disableInspectMode();
      });
    }

    if (btnPreview) {
      btnPreview.addEventListener('click', () => {
        const previewConf = this.getEditorFormData();
        this.applyTheme('custom-preview', previewConf, false);
        showToast(`Previewing: <strong>${previewConf.name}</strong>`, 'info');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const themeData = this.getEditorFormData();
        const submitBtn = form.querySelector('button[type="submit"]');
        const origText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        let isSavedToDb = false;

        try {
          const res = await fetch('/api/themes/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(themeData)
          });
          if (res.ok) isSavedToDb = true;
        } catch (err) {
          // Backend offline ise yerel depolamaya devam et
        }

        const localCustoms = JSON.parse(localStorage.getItem('local-custom-themes') || '{}');
        localCustoms[themeData.themeKey] = themeData;
        localStorage.setItem('local-custom-themes', JSON.stringify(localCustoms));

        this.themes[themeData.themeKey] = themeData;
        this.applyTheme(themeData.themeKey, null, false);
        this.renderModalGrid();

        if (drawer) drawer.style.display = 'none';
        this.disableInspectMode();
        submitBtn.textContent = origText;
        submitBtn.disabled = false;

        if (isSavedToDb) {
          showToast(`Theme <strong>${themeData.name}</strong> saved to Cloud DB & Applied!`, 'success');
        } else {
          showToast(`Theme <strong>${themeData.name}</strong> saved to Local Studio & Applied!`, 'success');
        }
      });
    }
  }

  liveQuickUpdate() {
    const previewConf = this.getEditorFormData();
    this.applyTheme('custom-live-preview', previewConf, false);
  }

  // --- DRAG & DROP ARKA PLAN DOSYA YÜKLEYİCİ ---
  bindDragAndDrop() {
    const dropZone = document.getElementById('dragDropZone');
    const fileInput = document.getElementById('edFileInput');
    const previewBar = document.getElementById('dropPreviewBar');
    const previewImg = document.getElementById('edBgPreviewImg');
    const fileNameSpan = document.getElementById('edBgFileName');
    const btnRemove = document.getElementById('btnRemoveCustomBg');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.handleImageFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleImageFile(e.target.files[0]);
      }
    });

    if (btnRemove) {
      btnRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        this.customBgDataUrl = null;
        previewBar.style.display = 'none';
        fileInput.value = '';
        this.liveQuickUpdate();
      });
    }
  }

  handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG/JPG/WEBP)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      this.customBgDataUrl = event.target.result;
      const previewBar = document.getElementById('dropPreviewBar');
      const previewImg = document.getElementById('edBgPreviewImg');
      const fileNameSpan = document.getElementById('edBgFileName');

      if (previewBar && previewImg) {
        previewImg.src = this.customBgDataUrl;
        fileNameSpan.textContent = file.name;
        previewBar.style.display = 'flex';
      }

      this.liveQuickUpdate();
      showToast(`Uploaded: <strong>${file.name}</strong>`, 'success');
    };
    reader.readAsDataURL(file);
  }

  // --- "CLICK TO EDIT ELEMENT" (INSPECT MODE) ---
  bindInspectMode() {
    const btnInspect = document.getElementById('btnToggleInspectMode');
    if (!btnInspect) return;

    btnInspect.addEventListener('click', () => {
      this.isInspectMode = !this.isInspectMode;
      btnInspect.classList.toggle('active', this.isInspectMode);
      document.body.classList.toggle('inspect-mode-active', this.isInspectMode);

      const btnText = document.getElementById('inspectBtnText');
      if (btnText) {
        btnText.textContent = this.isInspectMode ? 'INSPECT MODE ACTIVE (CLICK ANY ELEMENT)' : 'ENABLE "CLICK TO EDIT ELEMENT"';
      }

      if (this.isInspectMode) {
        showToast('Inspect Mode On: Click cards or panels to focus color picker!', 'info');
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.isInspectMode) return;
      const drawer = document.getElementById('themeEditorDrawer');
      if (drawer && drawer.contains(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      // Tıklanan elementin türüne göre renk inputuna odaklan
      if (e.target.closest('.service-block') || e.target.closest('.telemetry-bar') || e.target.closest('.gui-user-card-panel')) {
        document.getElementById('edColorPanel').click();
        showToast('Focused: <strong>Panel Background Color</strong>', 'info');
      } else if (e.target.closest('.brand-header') || e.target.closest('h3') || e.target.closest('.highlight')) {
        document.getElementById('edColorAccent').click();
        showToast('Focused: <strong>Accent Action Color</strong>', 'info');
      } else {
        document.getElementById('edColorBg').click();
        showToast('Focused: <strong>Main Background Color</strong>', 'info');
      }
    }, true);
  }

  disableInspectMode() {
    this.isInspectMode = false;
    const btnInspect = document.getElementById('btnToggleInspectMode');
    if (btnInspect) btnInspect.classList.remove('active');
    document.body.classList.remove('inspect-mode-active');
    const btnText = document.getElementById('inspectBtnText');
    if (btnText) btnText.textContent = 'ENABLE "CLICK TO EDIT ELEMENT"';
  }

  getEditorFormData() {
    const name = document.getElementById('edThemeName').value.trim() || 'CUSTOM THEME';
    const accent = document.getElementById('edColorAccent').value;
    const bg = document.getElementById('edColorBg').value;
    const panel = document.getElementById('edColorPanel').value;
    const text = document.getElementById('edColorText').value;
    const font = document.getElementById('edFontFamily').value;
    const radius = document.getElementById('edBorderRadius').value;
    const glow = document.getElementById('edGlowIntensity').value;
    const blur = document.getElementById('edBackdropBlur').value;
    const scanlines = document.getElementById('edScanlines').checked;

    const bgUrlInput = document.getElementById('edBgImage').value.trim();
    const statusText = document.getElementById('edStatusText').value.trim();
    const hasCli = document.getElementById('edHasCli').checked;
    const showGrid = document.getElementById('edShowGrid').checked;
    const isPublic = document.getElementById('edIsPublic').checked;

    const finalBg = this.customBgDataUrl || bgUrlInput || null;

    return {
      themeKey: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: name.toUpperCase(),
      category: 'custom',
      hasCli,
      showGrid,
      scanlines,
      dotColor: accent,
      statusText: statusText || 'CUSTOM RUNTIME ACTIVE',
      bgImage: finalBg,
      isPublic,
      userId: 'onur',
      stylesheet: null,
      module: null,
      cssVariables: {
        '--bg-color': bg,
        '--panel-bg': panel,
        '--text-main': text,
        '--text-bright': '#ffffff',
        '--accent-action': accent,
        '--accent-glow': `${accent}${Math.floor((glow / 100) * 255).toString(16).padStart(2, '0')}`,
        '--box-border': accent,
        '--status-ok': accent,
        '--app-font': font,
        '--app-radius': `${radius}px`,
        '--app-blur': `${blur}px`
      }
    };
  }
}