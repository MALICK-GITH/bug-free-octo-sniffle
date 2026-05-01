// Settings Panel - Visible and Functional Settings
class SettingsPanel {
  constructor() {
    this.isVisible = true;
    this.currentTheme = 'default';
    this.settings = {
      fontSize: 'medium',
      borderRadius: 'medium',
      animations: true,
      glassEffect: true,
      highContrast: false,
      reducedMotion: false,
      autoSave: true,
      notifications: true,
      soundEffects: false,
      customColors: {
        primary: '#3be7ff',
        secondary: '#42f56c',
        accent: '#ffd166'
      }
    };

    this.themes = {
      default: { name: 'Default', icon: '🌙', colors: { primary: '#0a1628', secondary: '#1e3a5f', accent: '#3be7ff' } },
      dark: { name: 'Dark', icon: '🌃', colors: { primary: '#000511', secondary: '#0a0f1f', accent: '#0ea5e9' } },
      light: { name: 'Light', icon: '☀️', colors: { primary: '#f8fafc', secondary: '#e2e8f0', accent: '#0284c7' } },
      cyberpunk: { name: 'Cyberpunk', icon: '🌆', colors: { primary: '#0a0a0a', secondary: '#1a0033', accent: '#ff00ff' } },
      gaming: { name: 'Gaming', icon: '🎮', colors: { primary: '#1a1a2e', secondary: '#0f3460', accent: '#ff6b6b' } },
      nature: { name: 'Nature', icon: '🌿', colors: { primary: '#2d5016', secondary: '#4a7c59', accent: '#386641' } },
      ocean: { name: 'Ocean', icon: '🌊', colors: { primary: '#03045e', secondary: '#0077b6', accent: '#00b4d8' } },
      sunset: { name: 'Sunset', icon: '🌅', colors: { primary: '#ff6b6b', secondary: '#feca57', accent: '#48dbfb' } },
      galaxy: { name: 'Galaxy', icon: '🌌', colors: { primary: '#000428', secondary: '#004e92', accent: '#009ffd' } }
    };

    this.init();
  }

  init() {
    console.log('⚙️ Initializing Settings Panel...');
    this.loadSettings();
    this.createSettingsPanel();
    this.applySettings();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.addSettingsButton();
  }

  loadSettings() {
    // Load saved settings
    const savedSettings = localStorage.getItem('fifa-pro-settings');
    const savedTheme = localStorage.getItem('fifa-pro-theme');

    if (savedSettings) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      } catch (error) {
        console.warn('Failed to load settings:', error);
      }
    }

    if (savedTheme) {
      this.currentTheme = savedTheme;
    }
  }

  saveSettings() {
    localStorage.setItem('fifa-pro-settings', JSON.stringify(this.settings));
    localStorage.setItem('fifa-pro-theme', this.currentTheme);
    console.log('✅ Settings saved successfully');
  }

  createSettingsPanel() {
    // Create settings panel HTML
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'settings-panel visible';
    settingsPanel.innerHTML = this.getSettingsPanelHTML();

    document.body.appendChild(settingsPanel);

    // Store reference
    this.settingsPanel = settingsPanel;

    // Setup event listeners
    this.setupSettingsEvents();
  }

  getSettingsPanelHTML() {
    return `
      <div class="settings-header">
        <h2 class="settings-title">⚙️ Paramètres</h2>
        <button class="settings-toggle" id="settingsToggle">📱</button>
      </div>
      
      <div class="settings-content" id="settingsContent">
        <!-- Theme Selection -->
        <div class="settings-section">
          <h3 class="settings-section-title">Thème</h3>
          <div class="theme-selection">
            ${Object.entries(this.themes).map(([key, theme]) => `
              <button class="theme-btn ${this.currentTheme === key ? 'active' : ''}" 
                      data-theme="${key}" title="${theme.name}">
                ${theme.icon} ${theme.name}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Customization Options -->
        <div class="settings-section">
          <h3 class="settings-section-title">Personnalisation</h3>
          
          <div class="custom-option">
            <label class="custom-label">Taille du texte</label>
            <select class="custom-input" id="fontSizeSelect">
              <option value="small" ${this.settings.fontSize === 'small' ? 'selected' : ''}>Petit</option>
              <option value="medium" ${this.settings.fontSize === 'medium' ? 'selected' : ''}>Moyen</option>
              <option value="large" ${this.settings.fontSize === 'large' ? 'selected' : ''}>Grand</option>
              <option value="xlarge" ${this.settings.fontSize === 'xlarge' ? 'selected' : ''}>Très grand</option>
            </select>
          </div>

          <div class="custom-option">
            <label class="custom-label">Bordures arrondies</label>
            <select class="custom-input" id="borderRadiusSelect">
              <option value="none" ${this.settings.borderRadius === 'none' ? 'selected' : ''}>Aucune</option>
              <option value="small" ${this.settings.borderRadius === 'small' ? 'selected' : ''}>Petit</option>
              <option value="medium" ${this.settings.borderRadius === 'medium' ? 'selected' : ''}>Moyen</option>
              <option value="large" ${this.settings.borderRadius === 'large' ? 'selected' : ''}>Grand</option>
              <option value="xlarge" ${this.settings.borderRadius === 'xlarge' ? 'selected' : ''}>Très grand</option>
            </select>
          </div>

          <div class="custom-option">
            <label class="custom-label">Animations</label>
            <div class="custom-switch ${this.settings.animations ? 'active' : ''}" id="animationsSwitch"></div>
          </div>

          <div class="custom-option">
            <label class="custom-label">Effet verre</label>
            <div class="custom-switch ${this.settings.glassEffect ? 'active' : ''}" id="glassSwitch"></div>
          </div>

          <div class="custom-option">
            <label class="custom-label">Contraste élevé</label>
            <div class="custom-switch ${this.settings.highContrast ? 'active' : ''}" id="contrastSwitch"></div>
          </div>

          <div class="custom-option">
            <label class="custom-label">Mouvement réduit</label>
            <div class="custom-switch ${this.settings.reducedMotion ? 'active' : ''}" id="motionSwitch"></div>
          </div>
        </div>

        <!-- Custom Colors -->
        <div class="settings-section">
          <h3 class="settings-section-title">Couleurs Personnalisées</h3>
          
          <div class="color-picker-group">
            <div class="color-picker-wrapper">
              <input type="color" class="color-input" id="primaryColorInput" 
                     value="${this.settings.customColors.primary}" title="Couleur principale">
              <span class="color-label">Principale</span>
            </div>
            
            <div class="color-picker-wrapper">
              <input type="color" class="color-input" id="secondaryColorInput" 
                     value="${this.settings.customColors.secondary}" title="Couleur secondaire">
              <span class="color-label">Secondaire</span>
            </div>
            
            <div class="color-picker-wrapper">
              <input type="color" class="color-input" id="accentColorInput" 
                     value="${this.settings.customColors.accent}" title="Couleur d'accent">
              <span class="color-label">Accent</span>
            </div>
          </div>
        </div>

        <!-- Advanced Options -->
        <div class="settings-section">
          <h3 class="settings-section-title">Options Avancées</h3>
          
          <div class="custom-option">
            <label class="custom-label">Sauvegarde automatique</label>
            <div class="custom-switch ${this.settings.autoSave ? 'active' : ''}" id="autoSaveSwitch"></div>
          </div>

          <div class="custom-option">
            <label class="custom-label">Notifications</label>
            <div class="custom-switch ${this.settings.notifications ? 'active' : ''}" id="notificationsSwitch"></div>
          </div>

          <div class="custom-option">
            <label class="custom-label">Effets sonores</label>
            <div class="custom-switch ${this.settings.soundEffects ? 'active' : ''}" id="soundSwitch"></div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="settings-actions">
          <button class="settings-btn primary" id="applySettingsBtn">Appliquer</button>
          <button class="settings-btn secondary" id="resetSettingsBtn">Réinitialiser</button>
          <button class="settings-btn secondary" id="exportSettingsBtn">Exporter</button>
        </div>
      </div>
    `;
  }

  setupSettingsEvents() {
    // Theme selection
    const themeButtons = this.settingsPanel.querySelectorAll('.theme-btn');
    themeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const theme = button.dataset.theme;
        this.applyTheme(theme);
        this.updateThemeSelection(theme);
      });
    });

    // Customization options
    this.setupCustomizationEvents();

    // Action buttons
    this.setupActionButtons();
  }

  setupCustomizationEvents() {
    // Font size
    const fontSizeSelect = this.settingsPanel.querySelector('#fontSizeSelect');
    fontSizeSelect.addEventListener('change', (e) => {
      this.settings.fontSize = e.target.value;
      this.previewSetting('fontSize', e.target.value);
    });

    // Border radius
    const borderRadiusSelect = this.settingsPanel.querySelector('#borderRadiusSelect');
    borderRadiusSelect.addEventListener('change', (e) => {
      this.settings.borderRadius = e.target.value;
      this.previewSetting('borderRadius', e.target.value);
    });

    // Switches
    this.setupSwitch('animationsSwitch', 'animations');
    this.setupSwitch('glassSwitch', 'glassEffect');
    this.setupSwitch('contrastSwitch', 'highContrast');
    this.setupSwitch('motionSwitch', 'reducedMotion');
    this.setupSwitch('autoSaveSwitch', 'autoSave');
    this.setupSwitch('notificationsSwitch', 'notifications');
    this.setupSwitch('soundSwitch', 'soundEffects');

    // Custom colors
    const primaryColorInput = this.settingsPanel.querySelector('#primaryColorInput');
    const secondaryColorInput = this.settingsPanel.querySelector('#secondaryColorInput');
    const accentColorInput = this.settingsPanel.querySelector('#accentColorInput');

    primaryColorInput.addEventListener('input', (e) => {
      this.settings.customColors.primary = e.target.value;
      this.previewSetting('customColors', this.settings.customColors);
    });

    secondaryColorInput.addEventListener('input', (e) => {
      this.settings.customColors.secondary = e.target.value;
      this.previewSetting('customColors', this.settings.customColors);
    });

    accentColorInput.addEventListener('input', (e) => {
      this.settings.customColors.accent = e.target.value;
      this.previewSetting('customColors', this.settings.customColors);
    });
  }

  setupSwitch(switchId, settingKey) {
    const switchElement = this.settingsPanel.querySelector(`#${switchId}`);
    switchElement.addEventListener('click', () => {
      this.settings[settingKey] = !this.settings[settingKey];
      switchElement.classList.toggle('active');
      this.previewSetting(settingKey, this.settings[settingKey]);
    });
  }

  setupActionButtons() {
    // Apply button
    const applyBtn = this.settingsPanel.querySelector('#applySettingsBtn');
    applyBtn.addEventListener('click', () => {
      this.applySettings();
      this.saveSettings();
      this.showNotification('Paramètres appliqués avec succès!', 'success');
    });

    // Reset button
    const resetBtn = this.settingsPanel.querySelector('#resetSettingsBtn');
    resetBtn.addEventListener('click', () => {
      if (confirm('Réinitialiser tous les paramètres ?')) {
        this.resetToDefaults();
      }
    });

    // Export button
    const exportBtn = this.settingsPanel.querySelector('#exportSettingsBtn');
    exportBtn.addEventListener('click', () => {
      this.exportSettings();
    });
  }

  setupEventListeners() {
    // Toggle button
    const toggleBtn = this.settingsPanel.querySelector('#settingsToggle');
    toggleBtn.addEventListener('click', () => {
      this.toggleVisibility();
    });

    // Drag to reposition
    this.setupDragAndDrop();

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Apply settings on change with auto-save
    if (this.settings.autoSave) {
      this.setupAutoSave();
    }
  }

  setupAutoSave() {
    // Auto-save when settings change
    const inputs = this.settingsPanel.querySelectorAll('select, input');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        if (this.settings.autoSave) {
          this.saveSettings();
        }
      });
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            this.toggleVisibility();
            break;
          case 't':
            e.preventDefault();
            this.cycleTheme('next');
            break;
          case 'r':
            e.preventDefault();
            this.resetToDefaults();
            break;
        }
      }
    });
  }

  setupDragAndDrop() {
    const header = this.settingsPanel.querySelector('.settings-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.settingsPanel.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      this.settingsPanel.style.left = `${initialX + dx}px`;
      this.settingsPanel.style.top = `${initialY + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  }

  addSettingsButton() {
    // Add a floating settings button if panel is hidden
    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'floating-settings-btn';
    floatingBtn.innerHTML = '⚙️';
    floatingBtn.title = 'Ouvrir les paramètres';
    
    floatingBtn.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: var(--gradient-primary, linear-gradient(135deg, #3be7ff, #42f56c));
      color: var(--text-primary, #e8f4ff);
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      z-index: 999;
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.2));
      transition: all var(--transition-fast, 0.15s ease);
      display: none;
    `;

    floatingBtn.addEventListener('click', () => {
      this.show();
    });

    floatingBtn.addEventListener('mouseenter', () => {
      floatingBtn.style.transform = 'scale(1.1)';
    });

    floatingBtn.addEventListener('mouseleave', () => {
      floatingBtn.style.transform = 'scale(1)';
    });

    document.body.appendChild(floatingBtn);
    this.floatingBtn = floatingBtn;
  }

  applyTheme(themeName) {
    if (!this.themes[themeName]) return;

    this.currentTheme = themeName;
    const theme = this.themes[themeName];
    
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    root.setAttribute('data-theme', themeName);
    
    if (theme.colors) {
      root.style.setProperty('--theme-primary', theme.colors.primary);
      root.style.setProperty('--theme-secondary', theme.colors.secondary);
      root.style.setProperty('--theme-accent', theme.colors.accent);
    }

    // Apply custom colors if set
    this.applyCustomColors();

    console.log(`🎨 Theme applied: ${theme.name}`);
  }

  applyCustomColors() {
    const root = document.documentElement;
    const colors = this.settings.customColors;

    root.style.setProperty('--custom-primary', colors.primary);
    root.style.setProperty('--custom-secondary', colors.secondary);
    root.style.setProperty('--custom-accent', colors.accent);
  }

  applySettings() {
    const root = document.documentElement;

    // Font size
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
      xlarge: '20px'
    };
    root.style.setProperty('--font-size-base', fontSizes[this.settings.fontSize]);

    // Border radius
    const borderRadii = {
      none: '0px',
      small: '4px',
      medium: '8px',
      large: '12px',
      xlarge: '16px'
    };
    root.style.setProperty('--radius-base', borderRadii[this.settings.borderRadius]);

    // Animation settings
    if (this.settings.animations) {
      root.style.removeProperty('--animation-duration');
    } else {
      root.style.setProperty('--animation-duration', '0.01s');
    }

    // Glass effect
    if (this.settings.glassEffect) {
      root.style.setProperty('--glass-opacity', '0.1');
    } else {
      root.style.setProperty('--glass-opacity', '0');
    }

    // High contrast
    if (this.settings.highContrast) {
      root.style.setAttribute('data-high-contrast', 'true');
    } else {
      root.style.removeAttribute('data-high-contrast');
    }

    // Reduced motion
    if (this.settings.reducedMotion) {
      root.style.setAttribute('data-reduced-motion', 'true');
    } else {
      root.style.removeAttribute('data-reduced-motion');
    }

    // Apply theme
    this.applyTheme(this.currentTheme);

    console.log('⚙️ Settings applied:', this.settings);
  }

  updateThemeSelection(themeName) {
    const themeButtons = this.settingsPanel.querySelectorAll('.theme-btn');
    themeButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.theme === themeName);
    });
  }

  previewSetting(settingKey, value) {
    // Preview setting without saving
    console.log(`👁️ Preview ${settingKey}:`, value);
    
    // Apply preview styles
    if (settingKey === 'fontSize') {
      document.documentElement.style.setProperty('--preview-font-size', value === 'small' ? '14px' : 
                                                                   value === 'medium' ? '16px' : 
                                                                   value === 'large' ? '18px' : '20px');
    }
  }

  toggleVisibility() {
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    this.settingsPanel.style.display = 'block';
    this.settingsPanel.classList.add('visible');
    this.settingsPanel.classList.remove('hidden');
    
    if (this.floatingBtn) {
      this.floatingBtn.style.display = 'none';
    }

    this.isVisible = true;
  }

  hide() {
    this.settingsPanel.style.display = 'none';
    this.settingsPanel.classList.remove('visible');
    this.settingsPanel.classList.add('hidden');
    
    if (this.floatingBtn) {
      this.floatingBtn.style.display = 'block';
    }

    this.isVisible = false;
  }

  cycleTheme(direction) {
    const themeKeys = Object.keys(this.themes);
    const currentIndex = themeKeys.indexOf(this.currentTheme);
    
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % themeKeys.length;
    } else {
      nextIndex = (currentIndex - 1 + themeKeys.length) % themeKeys.length;
    }

    const nextTheme = themeKeys[nextIndex];
    this.applyTheme(nextTheme);
    this.updateThemeSelection(nextTheme);
    
    if (this.settings.autoSave) {
      this.saveSettings();
    }
  }

  resetToDefaults() {
    this.currentTheme = 'default';
    this.settings = {
      fontSize: 'medium',
      borderRadius: 'medium',
      animations: true,
      glassEffect: true,
      highContrast: false,
      reducedMotion: false,
      autoSave: true,
      notifications: true,
      soundEffects: false,
      customColors: {
        primary: '#3be7ff',
        secondary: '#42f56c',
        accent: '#ffd166'
      }
    };

    this.applySettings();
    this.updateUI();
    this.saveSettings();
    this.showNotification('Paramètres réinitialisés', 'info');
  }

  updateUI() {
    // Update all form controls to match current settings
    const fontSizeSelect = this.settingsPanel.querySelector('#fontSizeSelect');
    if (fontSizeSelect) fontSizeSelect.value = this.settings.fontSize;

    const borderRadiusSelect = this.settingsPanel.querySelector('#borderRadiusSelect');
    if (borderRadiusSelect) borderRadiusSelect.value = this.settings.borderRadius;

    // Update switches
    this.updateSwitchUI('animationsSwitch', this.settings.animations);
    this.updateSwitchUI('glassSwitch', this.settings.glassEffect);
    this.updateSwitchUI('contrastSwitch', this.settings.highContrast);
    this.updateSwitchUI('motionSwitch', this.settings.reducedMotion);
    this.updateSwitchUI('autoSaveSwitch', this.settings.autoSave);
    this.updateSwitchUI('notificationsSwitch', this.settings.notifications);
    this.updateSwitchUI('soundSwitch', this.settings.soundEffects);

    // Update color inputs
    const primaryColorInput = this.settingsPanel.querySelector('#primaryColorInput');
    const secondaryColorInput = this.settingsPanel.querySelector('#secondaryColorInput');
    const accentColorInput = this.settingsPanel.querySelector('#accentColorInput');

    if (primaryColorInput) primaryColorInput.value = this.settings.customColors.primary;
    if (secondaryColorInput) secondaryColorInput.value = this.settings.customColors.secondary;
    if (accentColorInput) accentColorInput.value = this.settings.customColors.accent;

    // Update theme selection
    this.updateThemeSelection(this.currentTheme);
  }

  updateSwitchUI(switchId, isActive) {
    const switchElement = this.settingsPanel.querySelector(`#${switchId}`);
    if (switchElement) {
      switchElement.classList.toggle('active', isActive);
    }
  }

  exportSettings() {
    const settingsData = {
      theme: this.currentTheme,
      settings: this.settings,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fifa-pro-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showNotification('Paramètres exportés avec succès!', 'success');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `settings-notification settings-notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--gradient-primary, linear-gradient(135deg, #3be7ff, #42f56c));
      color: var(--text-primary, #e8f4ff);
      padding: 1rem 1.5rem;
      border-radius: var(--radius-lg, 20px);
      font-weight: 600;
      z-index: 10000;
      animation: slideInRight 0.3s ease;
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.2));
      max-width: 300px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Public API methods
  getSettings() {
    return {
      theme: this.currentTheme,
      settings: this.settings,
      isVisible: this.isVisible
    };
  }

  setTheme(themeName) {
    this.applyTheme(themeName);
    this.updateThemeSelection(themeName);
    if (this.settings.autoSave) {
      this.saveSettings();
    }
  }

  updateSetting(key, value) {
    this.settings[key] = value;
    this.applySettings();
    this.updateUI();
    if (this.settings.autoSave) {
      this.saveSettings();
    }
  }

  destroy() {
    if (this.settingsPanel) {
      this.settingsPanel.remove();
    }
    if (this.floatingBtn) {
      this.floatingBtn.remove();
    }
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.settingsPanel = new SettingsPanel();
    });
  } else {
    window.settingsPanel = new SettingsPanel();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsPanel;
}
