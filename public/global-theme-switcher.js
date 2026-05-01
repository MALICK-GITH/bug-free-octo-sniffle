/* global module */
// Global Theme Switcher - Works on ALL pages
class GlobalThemeSwitcher {
  constructor() {
    this.themes = {
      default: { name: 'Default', icon: '🌙' },
      dark: { name: 'Dark', icon: '🌃' },
      light: { name: 'Light', icon: '☀️' },
      cyberpunk: { name: 'Cyberpunk', icon: '🌆' },
      gaming: { name: 'Gaming', icon: '🎮' },
      nature: { name: 'Nature', icon: '🌿' },
      ocean: { name: 'Ocean', icon: '🌊' },
      sunset: { name: 'Sunset', icon: '🌅' },
      galaxy: { name: 'Galaxy', icon: '🌌' }
    };

    this.currentTheme = 'default';
    this.isVisible = true;

    this.init();
  }

  init() {
    console.log('🎨 Initializing Global Theme Switcher...');
    this.loadTheme();
    this.createThemeSwitcher();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  loadTheme() {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('fifa-pro-global-theme');
    if (savedTheme && this.themes[savedTheme]) {
      this.currentTheme = savedTheme;
    }

    // Apply theme immediately
    this.applyTheme(this.currentTheme);
  }

  saveTheme(theme) {
    localStorage.setItem('fifa-pro-global-theme', theme);
    this.currentTheme = theme;
    console.log(`✅ Theme saved: ${theme}`);
  }

  createThemeSwitcher() {
    // Create theme switcher HTML
    const switcher = document.createElement('div');
    switcher.className = 'global-theme-switcher';
    switcher.innerHTML = this.getSwitcherHTML();

    document.body.appendChild(switcher);

    // Store reference
    this.switcher = switcher;

    // Setup event listeners
    this.setupSwitcherEvents();
  }

  getSwitcherHTML() {
    return `
      <div class="theme-switcher-header">
        <h3>🎨 Thèmes</h3>
        <button class="theme-switcher-toggle" id="themeToggle">📱</button>
      </div>
      
      <div class="theme-switcher-content" id="themeContent">
        <div class="theme-switcher-grid">
          ${Object.entries(this.themes).map(([key, theme]) => `
            <button class="theme-switcher-btn ${this.currentTheme === key ? 'active' : ''}" 
                    data-theme="${key}" title="${theme.name}">
              ${theme.icon}<br>${theme.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  setupSwitcherEvents() {
    // Theme selection
    const themeButtons = this.switcher.querySelectorAll('.theme-switcher-btn');
    themeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const theme = button.dataset.theme;
        this.applyTheme(theme);
        this.updateThemeSelection(theme);
        this.saveTheme(theme);
        this.showNotification(`Thème ${this.themes[theme].name} appliqué !`, 'success');
      });
    });

    // Toggle button
    const toggleBtn = this.switcher.querySelector('#themeToggle');
    toggleBtn.addEventListener('click', () => {
      this.toggleVisibility();
    });

    // Drag to reposition
    this.setupDragAndDrop();
  }

  setupEventListeners() {
    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Auto-hide after selection
    setTimeout(() => {
      this.hide();
    }, 5000); // Auto-hide after 5 seconds
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            this.toggleVisibility();
            break;
          case 'd':
            e.preventDefault();
            this.cycleTheme('next');
            break;
          case 'l':
            e.preventDefault();
            this.cycleTheme('prev');
            break;
        }
      }
    });
  }

  setupDragAndDrop() {
    const header = this.switcher.querySelector('.theme-switcher-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.switcher.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      this.switcher.style.left = `${initialX + dx}px`;
      this.switcher.style.top = `${initialY + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'grab';
    });
  }

  applyTheme(themeName) {
    if (!this.themes[themeName]) return;

    // Apply theme to document element
    document.documentElement.setAttribute('data-theme', themeName);

    // Add theme class to body for additional styling
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeName}`);

    console.log(`🎨 Theme applied: ${this.themes[themeName].name}`);
  }

  updateThemeSelection(themeName) {
    const themeButtons = this.switcher.querySelectorAll('.theme-switcher-btn');
    themeButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.theme === themeName);
    });
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
    this.switcher.style.display = 'block';
    this.switcher.style.opacity = '1';
    this.switcher.style.visibility = 'visible';
    this.isVisible = true;
  }

  hide() {
    this.switcher.style.opacity = '0';
    this.switcher.style.visibility = 'hidden';
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
    this.saveTheme(nextTheme);
    this.showNotification(`Thème ${this.themes[nextTheme].name} appliqué !`, 'success');
  }

  showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.theme-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `theme-notification theme-notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--gradient-primary, linear-gradient(135deg, #3be7ff, #42f56c));
      color: var(--text-primary, #e8f4ff);
      padding: 1rem 1.5rem;
      border-radius: var(--radius-lg, 20px);
      font-weight: 600;
      z-index: 10001;
      animation: slideInDown 0.3s ease;
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.2));
      max-width: 300px;
      text-align: center;
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  // Public API methods
  getCurrentTheme() {
    return {
      theme: this.currentTheme,
      info: this.themes[this.currentTheme],
      isVisible: this.isVisible
    };
  }

  setTheme(themeName) {
    if (this.themes[themeName]) {
      this.applyTheme(themeName);
      this.updateThemeSelection(themeName);
      this.saveTheme(themeName);
      this.showNotification(`Thème ${this.themes[themeName].name} appliqué !`, 'success');
    }
  }

  resetToDefault() {
    this.setTheme('default');
  }

  destroy() {
    if (this.switcher) {
      this.switcher.remove();
    }
  }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .theme-switcher {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: var(--spacing-md);
    backdrop-filter: var(--glass-blur);
    box-shadow: var(--shadow-lg);
    min-width: 300px;
    max-width: 400px;
    transition: all var(--transition-normal);
  }

  .theme-switcher-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--border-primary);
  }

  .theme-switcher-header h3 {
    color: var(--text-primary);
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .theme-switcher-toggle {
    background: var(--accent-primary);
    color: var(--text-primary);
    border: none;
    border-radius: var(--radius-full);
    width: 35px;
    height: 35px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: all var(--transition-fast);
  }

  .theme-switcher-toggle:hover {
    transform: scale(1.1);
  }

  .theme-switcher-content {
    max-height: 400px;
    overflow-y: auto;
  }

  .theme-switcher-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm);
  }

  .theme-switcher-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
  }

  .theme-switcher-btn:hover {
    transform: translateY(-2px);
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-md);
  }

  .theme-switcher-btn.active {
    background: var(--gradient-primary);
    color: var(--text-primary);
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-primary);
  }

  @media (max-width: 768px) {
    .theme-switcher {
      top: 10px;
      right: 10px;
      left: 10px;
      max-width: calc(100vw - 20px);
    }

    .theme-switcher-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .theme-switcher-grid {
      grid-template-columns: 1fr;
    }
  }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.globalThemeSwitcher = new GlobalThemeSwitcher();
    });
  } else {
    window.globalThemeSwitcher = new GlobalThemeSwitcher();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = GlobalThemeSwitcher;
}
