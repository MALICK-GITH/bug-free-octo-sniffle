// Theme Manager - Complete Theme System with Customization Options
class ThemeManager {
  constructor() {
    this.themes = {
      default: {
        name: 'Default',
        description: 'Thème original FIFA PRO',
        icon: '🌙',
        colors: {
          primary: '#0a1628',
          secondary: '#1e3a5f',
          accent: '#3be7ff'
        }
      },
      dark: {
        name: 'Dark',
        description: 'Mode nuit profond',
        icon: '🌃',
        colors: {
          primary: '#000511',
          secondary: '#0a0f1f',
          accent: '#0ea5e9'
        }
      },
      light: {
        name: 'Light',
        description: 'Mode jour clair',
        icon: '☀️',
        colors: {
          primary: '#f8fafc',
          secondary: '#e2e8f0',
          accent: '#0284c7'
        }
      },
      cyberpunk: {
        name: 'Cyberpunk',
        description: 'Futurisme néon',
        icon: '🌆',
        colors: {
          primary: '#0a0a0a',
          secondary: '#1a0033',
          accent: '#ff00ff'
        }
      },
      gaming: {
        name: 'Gaming',
        description: 'Style gaming RGB',
        icon: '🎮',
        colors: {
          primary: '#1a1a2e',
          secondary: '#0f3460',
          accent: '#ff6b6b'
        }
      },
      nature: {
        name: 'Nature',
        description: 'Couleurs naturelles',
        icon: '🌿',
        colors: {
          primary: '#2d5016',
          secondary: '#4a7c59',
          accent: '#386641'
        }
      },
      ocean: {
        name: 'Ocean',
        description: 'Profondeurs marines',
        icon: '🌊',
        colors: {
          primary: '#03045e',
          secondary: '#0077b6',
          accent: '#00b4d8'
        }
      },
      sunset: {
        name: 'Sunset',
        description: 'Couleurs de coucher',
        icon: '🌅',
        colors: {
          primary: '#ff6b6b',
          secondary: '#feca57',
          accent: '#48dbfb'
        }
      },
      galaxy: {
        name: 'Galaxy',
        description: 'Espace cosmique',
        icon: '🌌',
        colors: {
          primary: '#000428',
          secondary: '#004e92',
          accent: '#009ffd'
        }
      }
    };

    this.currentTheme = 'default';
    this.customSettings = {
      fontSize: 'medium',
      borderRadius: 'medium',
      animations: true,
      glassEffect: true,
      highContrast: false,
      reducedMotion: false,
      customColors: {}
    };

    this.isMinimized = false;
    this.autoTheme = true; // Auto-detect system theme

    this.init();
  }

  init() {
    console.log('🎨 Initializing Theme Manager...');
    this.loadSettings();
    this.setupAutoTheme();
    this.createThemeManager();
    this.applyTheme(this.currentTheme);
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupAccessibility();
  }

  loadSettings() {
    // Load saved theme and settings
    const savedTheme = localStorage.getItem('fifa-pro-theme');
    const savedSettings = localStorage.getItem('fifa-pro-theme-settings');

    if (savedTheme) {
      this.currentTheme = savedTheme;
      this.autoTheme = false;
    }

    if (savedSettings) {
      try {
        this.customSettings = { ...this.customSettings, ...JSON.parse(savedSettings) };
      } catch (error) {
        console.warn('Failed to load theme settings:', error);
      }
    }
  }

  saveSettings() {
    localStorage.setItem('fifa-pro-theme', this.currentTheme);
    localStorage.setItem('fifa-pro-theme-settings', JSON.stringify(this.customSettings));
  }

  setupAutoTheme() {
    if (this.autoTheme) {
      // Detect system theme preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.currentTheme = prefersDark ? 'dark' : 'light';

      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.autoTheme) {
          this.currentTheme = e.matches ? 'dark' : 'light';
          this.applyTheme(this.currentTheme);
        }
      });
    }

    // Detect time-based theme
    this.setupTimeBasedTheme();
  }

  setupTimeBasedTheme() {
    const updateTimeTheme = () => {
      if (!this.autoTheme) return;

      const hour = new Date().getHours();
      const isDayTime = hour >= 6 && hour < 18;
      
      if (isDayTime && this.currentTheme === 'dark') {
        this.currentTheme = 'light';
        this.applyTheme('light');
      } else if (!isDayTime && this.currentTheme === 'light') {
        this.currentTheme = 'dark';
        this.applyTheme('dark');
      }
    };

    // Update immediately
    updateTimeTheme();

    // Update every hour
    setInterval(updateTimeTheme, 3600000);
  }

  createThemeManager() {
    // Create theme manager UI
    const themeManager = document.createElement('div');
    themeManager.className = 'theme-manager';
    themeManager.innerHTML = this.getThemeManagerHTML();

    document.body.appendChild(themeManager);

    // Store reference
    this.themeManager = themeManager;

    // Setup event listeners for theme manager
    this.setupThemeManagerEvents();
  }

  getThemeManagerHTML() {
    return `
      <div class="theme-header">
        <h3 class="theme-title">🎨 Thèmes</h3>
        <button class="theme-toggle" id="themeToggle">⚙️</button>
      </div>
      
      <div class="theme-content" id="themeContent">
        <div class="theme-section">
          <h4 class="theme-section-title">Thèmes Prédéfinis</h4>
          <div class="theme-grid">
            ${Object.entries(this.themes).map(([key, theme]) => `
              <div class="theme-option ${this.currentTheme === key ? 'active' : ''}" 
                   data-theme="${key}" title="${theme.description}">
                <div class="theme-preview ${key}"></div>
                <div class="theme-name">${theme.icon} ${theme.name}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="theme-section">
          <h4 class="theme-section-title">Personnalisation</h4>
          
          <div class="customization-section">
            <div class="custom-option">
              <label class="custom-label">Taille du texte</label>
              <select class="custom-input" id="fontSizeSelect">
                <option value="small" ${this.customSettings.fontSize === 'small' ? 'selected' : ''}>Petit</option>
                <option value="medium" ${this.customSettings.fontSize === 'medium' ? 'selected' : ''}>Moyen</option>
                <option value="large" ${this.customSettings.fontSize === 'large' ? 'selected' : ''}>Grand</option>
                <option value="xlarge" ${this.customSettings.fontSize === 'xlarge' ? 'selected' : ''}>Très grand</option>
              </select>
            </div>

            <div class="custom-option">
              <label class="custom-label">Bordures arrondies</label>
              <select class="custom-input" id="borderRadiusSelect">
                <option value="none" ${this.customSettings.borderRadius === 'none' ? 'selected' : ''}>Aucune</option>
                <option value="small" ${this.customSettings.borderRadius === 'small' ? 'selected' : ''}>Petit</option>
                <option value="medium" ${this.customSettings.borderRadius === 'medium' ? 'selected' : ''}>Moyen</option>
                <option value="large" ${this.customSettings.borderRadius === 'large' ? 'selected' : ''}>Grand</option>
                <option value="xlarge" ${this.customSettings.borderRadius === 'xlarge' ? 'selected' : ''}>Très grand</option>
              </select>
            </div>

            <div class="custom-option">
              <label class="custom-label">Animations</label>
              <div class="custom-switch ${this.customSettings.animations ? 'active' : ''}" id="animationsSwitch"></div>
            </div>

            <div class="custom-option">
              <label class="custom-label">Effet verre</label>
              <div class="custom-switch ${this.customSettings.glassEffect ? 'active' : ''}" id="glassSwitch"></div>
            </div>

            <div class="custom-option">
              <label class="custom-label">Contraste élevé</label>
              <div class="custom-switch ${this.customSettings.highContrast ? 'active' : ''}" id="contrastSwitch"></div>
            </div>

            <div class="custom-option">
              <label class="custom-label">Mouvement réduit</label>
              <div class="custom-switch ${this.customSettings.reducedMotion ? 'active' : ''}" id="motionSwitch"></div>
            </div>

            <div class="custom-option">
              <label class="custom-label">Thème automatique</label>
              <div class="custom-switch ${this.autoTheme ? 'active' : ''}" id="autoThemeSwitch"></div>
            </div>
          </div>
        </div>

        <div class="theme-section">
          <h4 class="theme-section-title">Couleurs Personnalisées</h4>
          
          <div class="customization-section">
            <div class="custom-option">
              <label class="custom-label">Couleur principale</label>
              <input type="color" class="custom-input" id="primaryColorInput" 
                     value="${this.customSettings.customColors.primary || '#3be7ff'}">
            </div>

            <div class="custom-option">
              <label class="custom-label">Couleur secondaire</label>
              <input type="color" class="custom-input" id="secondaryColorInput" 
                     value="${this.customSettings.customColors.secondary || '#42f56c'}">
            </div>

            <div class="custom-option">
              <label class="custom-label">Couleur d'accent</label>
              <input type="color" class="custom-input" id="accentColorInput" 
                     value="${this.customSettings.customColors.accent || '#ffd166'}">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupThemeManagerEvents() {
    // Theme selection
    const themeOptions = this.themeManager.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const theme = option.dataset.theme;
        this.applyTheme(theme);
        this.updateThemeSelection(theme);
      });
    });

    // Toggle button
    const toggleBtn = this.themeManager.querySelector('#themeToggle');
    toggleBtn.addEventListener('click', () => {
      this.toggleMinimize();
    });

    // Customization options
    this.setupCustomizationEvents();
  }

  setupCustomizationEvents() {
    // Font size
    const fontSizeSelect = this.themeManager.querySelector('#fontSizeSelect');
    fontSizeSelect.addEventListener('change', (e) => {
      this.customSettings.fontSize = e.target.value;
      this.applyCustomSettings();
      this.saveSettings();
    });

    // Border radius
    const borderRadiusSelect = this.themeManager.querySelector('#borderRadiusSelect');
    borderRadiusSelect.addEventListener('change', (e) => {
      this.customSettings.borderRadius = e.target.value;
      this.applyCustomSettings();
      this.saveSettings();
    });

    // Switches
    this.setupSwitch('animationsSwitch', 'animations');
    this.setupSwitch('glassSwitch', 'glassEffect');
    this.setupSwitch('contrastSwitch', 'highContrast');
    this.setupSwitch('motionSwitch', 'reducedMotion');
    this.setupSwitch('autoThemeSwitch', 'autoTheme');

    // Custom colors
    const primaryColorInput = this.themeManager.querySelector('#primaryColorInput');
    const secondaryColorInput = this.themeManager.querySelector('#secondaryColorInput');
    const accentColorInput = this.themeManager.querySelector('#accentColorInput');

    primaryColorInput.addEventListener('change', (e) => {
      this.customSettings.customColors.primary = e.target.value;
      this.applyCustomColors();
      this.saveSettings();
    });

    secondaryColorInput.addEventListener('change', (e) => {
      this.customSettings.customColors.secondary = e.target.value;
      this.applyCustomColors();
      this.saveSettings();
    });

    accentColorInput.addEventListener('change', (e) => {
      this.customSettings.customColors.accent = e.target.value;
      this.applyCustomColors();
      this.saveSettings();
    });
  }

  setupSwitch(switchId, settingKey) {
    const switchElement = this.themeManager.querySelector(`#${switchId}`);
    switchElement.addEventListener('click', () => {
      this.customSettings[settingKey] = !this.customSettings[settingKey];
      switchElement.classList.toggle('active');
      this.applyCustomSettings();
      this.saveSettings();
    });
  }

  applyTheme(themeName) {
    if (!this.themes[themeName]) {
      console.warn(`Theme "${themeName}" not found`);
      return;
    }

    this.currentTheme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);

    // Apply theme-specific styles
    this.applyThemeColors(themeName);
    this.applyCustomSettings();

    // Save preference
    this.saveSettings();

    // Dispatch event
    this.dispatchThemeChange(themeName);
  }

  applyThemeColors(themeName) {
    const theme = this.themes[themeName];
    if (!theme) return;

    // Apply theme colors to CSS variables
    const root = document.documentElement;
    
    if (theme.colors) {
      root.style.setProperty('--theme-primary', theme.colors.primary);
      root.style.setProperty('--theme-secondary', theme.colors.secondary);
      root.style.setProperty('--theme-accent', theme.colors.accent);
    }
  }

  applyCustomSettings() {
    const root = document.documentElement;

    // Font size
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px',
      xlarge: '20px'
    };
    root.style.setProperty('--font-size-base', fontSizes[this.customSettings.fontSize]);

    // Border radius
    const borderRadii = {
      none: '0px',
      small: '4px',
      medium: '8px',
      large: '12px',
      xlarge: '16px'
    };
    root.style.setProperty('--radius-base', borderRadii[this.customSettings.borderRadius]);

    // Animations
    if (this.customSettings.animations) {
      root.style.removeProperty('--animation-duration');
    } else {
      root.style.setProperty('--animation-duration', '0.01s');
    }

    // Glass effect
    if (this.customSettings.glassEffect) {
      root.style.setProperty('--glass-opacity', '0.1');
    } else {
      root.style.setProperty('--glass-opacity', '0');
    }

    // High contrast
    if (this.customSettings.highContrast) {
      root.style.setAttribute('data-high-contrast', 'true');
    } else {
      root.style.removeAttribute('data-high-contrast');
    }

    // Reduced motion
    if (this.customSettings.reducedMotion) {
      root.style.setAttribute('data-reduced-motion', 'true');
    } else {
      root.style.removeAttribute('data-reduced-motion');
    }
  }

  applyCustomColors() {
    const root = document.documentElement;
    const colors = this.customSettings.customColors;

    if (colors.primary) {
      root.style.setProperty('--custom-primary', colors.primary);
    }
    if (colors.secondary) {
      root.style.setProperty('--custom-secondary', colors.secondary);
    }
    if (colors.accent) {
      root.style.setProperty('--custom-accent', colors.accent);
    }
  }

  updateThemeSelection(themeName) {
    const themeOptions = this.themeManager.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.theme === themeName);
    });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    const content = this.themeManager.querySelector('#themeContent');
    const toggle = this.themeManager.querySelector('#themeToggle');

    if (this.isMinimized) {
      content.classList.add('hidden');
      this.themeManager.classList.add('minimized');
      toggle.textContent = '🎨';
    } else {
      content.classList.remove('hidden');
      this.themeManager.classList.remove('minimized');
      toggle.textContent = '⚙️';
    }
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            this.toggleThemeManager();
            break;
          case 'd':
            e.preventDefault();
            this.cycleTheme('next');
            break;
          case 'a':
            e.preventDefault();
            this.cycleTheme('prev');
            break;
        }
      }
    });

    // Drag to reposition
    this.setupDragAndDrop();
  }

  setupKeyboardShortcuts() {
    // Add keyboard shortcuts info
    this.addKeyboardShortcutsHelp();
  }

  addKeyboardShortcutsHelp() {
    const shortcuts = [
      { key: 'Ctrl+T', description: 'Ouvrir/Fermer le gestionnaire de thèmes' },
      { key: 'Ctrl+D', description: 'Thème suivant' },
      { key: 'Ctrl+A', description: 'Thème précédent' },
      { key: 'Ctrl+L', description: 'Mode clair/sombre' }
    ];

    // Store shortcuts for help modal
    this.keyboardShortcuts = shortcuts;
  }

  setupDragAndDrop() {
    const header = this.themeManager.querySelector('.theme-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.themeManager.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      this.themeManager.style.left = `${initialX + dx}px`;
      this.themeManager.style.top = `${initialY + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  }

  setupAccessibility() {
    // Add ARIA labels
    const themeOptions = this.themeManager.querySelectorAll('.theme-option');
    themeOptions.forEach((option, index) => {
      option.setAttribute('role', 'button');
      option.setAttribute('tabindex', '0');
      option.setAttribute('aria-label', `Thème ${this.themes[option.dataset.theme].name}`);
    });

    // Add keyboard navigation
    this.setupKeyboardNavigation();
  }

  setupKeyboardNavigation() {
    const themeOptions = this.themeManager.querySelectorAll('.theme-option');
    
    themeOptions.forEach((option, index) => {
      option.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            option.click();
            break;
          case 'ArrowRight':
            e.preventDefault();
            const nextIndex = (index + 1) % themeOptions.length;
            themeOptions[nextIndex].focus();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            const prevIndex = (index - 1 + themeOptions.length) % themeOptions.length;
            themeOptions[prevIndex].focus();
            break;
        }
      });
    });
  }

  toggleThemeManager() {
    this.themeManager.style.display = 
      this.themeManager.style.display === 'none' ? 'block' : 'none';
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
  }

  toggleLightDark() {
    const currentTheme = this.currentTheme;
    if (currentTheme === 'light') {
      this.applyTheme('dark');
      this.updateThemeSelection('dark');
    } else if (currentTheme === 'dark') {
      this.applyTheme('light');
      this.updateThemeSelection('light');
    }
  }

  dispatchThemeChange(themeName) {
    const event = new CustomEvent('themechange', {
      detail: { theme: themeName, settings: this.customSettings }
    });
    document.dispatchEvent(event);
  }

  // Public API methods
  getCurrentTheme() {
    return this.currentTheme;
  }

  getThemeInfo() {
    return {
      current: this.currentTheme,
      themes: this.themes,
      settings: this.customSettings,
      autoTheme: this.autoTheme
    };
  }

  setTheme(themeName) {
    this.applyTheme(themeName);
    this.updateThemeSelection(themeName);
  }

  resetToDefaults() {
    this.currentTheme = 'default';
    this.customSettings = {
      fontSize: 'medium',
      borderRadius: 'medium',
      animations: true,
      glassEffect: true,
      highContrast: false,
      reducedMotion: false,
      customColors: {}
    };
    this.autoTheme = true;
    
    this.applyTheme('default');
    this.updateThemeSelection('default');
    this.saveSettings();
    
    // Update UI
    this.updateCustomizationUI();
  }

  updateCustomizationUI() {
    // Update all form controls to match current settings
    const fontSizeSelect = this.themeManager.querySelector('#fontSizeSelect');
    if (fontSizeSelect) fontSizeSelect.value = this.customSettings.fontSize;

    const borderRadiusSelect = this.themeManager.querySelector('#borderRadiusSelect');
    if (borderRadiusSelect) borderRadiusSelect.value = this.customSettings.borderRadius;

    // Update switches
    this.updateSwitchUI('animationsSwitch', this.customSettings.animations);
    this.updateSwitchUI('glassSwitch', this.customSettings.glassEffect);
    this.updateSwitchUI('contrastSwitch', this.customSettings.highContrast);
    this.updateSwitchUI('motionSwitch', this.customSettings.reducedMotion);
    this.updateSwitchUI('autoThemeSwitch', this.autoTheme);

    // Update color inputs
    const primaryColorInput = this.themeManager.querySelector('#primaryColorInput');
    const secondaryColorInput = this.themeManager.querySelector('#secondaryColorInput');
    const accentColorInput = this.themeManager.querySelector('#accentColorInput');

    if (primaryColorInput) primaryColorInput.value = this.customSettings.customColors.primary || '#3be7ff';
    if (secondaryColorInput) secondaryColorInput.value = this.customSettings.customColors.secondary || '#42f56c';
    if (accentColorInput) accentColorInput.value = this.customSettings.customColors.accent || '#ffd166';
  }

  updateSwitchUI(switchId, isActive) {
    const switchElement = this.themeManager.querySelector(`#${switchId}`);
    if (switchElement) {
      switchElement.classList.toggle('active', isActive);
    }
  }

  exportTheme() {
    const themeData = {
      theme: this.currentTheme,
      settings: this.customSettings,
      customColors: this.customSettings.customColors,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fifa-pro-theme-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importTheme(themeData) {
    try {
      if (themeData.theme) {
        this.applyTheme(themeData.theme);
        this.updateThemeSelection(themeData.theme);
      }

      if (themeData.settings) {
        this.customSettings = { ...this.customSettings, ...themeData.settings };
        this.applyCustomSettings();
      }

      if (themeData.customColors) {
        this.customSettings.customColors = themeData.customColors;
        this.applyCustomColors();
      }

      this.saveSettings();
      this.updateCustomizationUI();

      this.showNotification('Thème importé avec succès!', 'success');
    } catch (error) {
      console.error('Failed to import theme:', error);
      this.showNotification('Échec de l\'importation du thème', 'error');
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `theme-notification theme-notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--gradient-primary);
      color: var(--text-primary);
      padding: 1rem 1.5rem;
      border-radius: var(--radius-lg);
      font-weight: 600;
      z-index: 10000;
      animation: slideInRight 0.3s ease;
      box-shadow: var(--shadow-lg);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  destroy() {
    if (this.themeManager) {
      this.themeManager.remove();
    }
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.themeManager = new ThemeManager();
    });
  } else {
    window.themeManager = new ThemeManager();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
