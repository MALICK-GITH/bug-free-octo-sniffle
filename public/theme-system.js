/**
 * SOLITFIFPRO225 - Theme System JavaScript
 * Phase 3: Gestion du Dark/Light mode
 * SOLITAIRE HACK SIGNATURE
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'sfc25-theme';
  
  /**
   * Get saved theme or system preference
   */
  function getTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  /**
   * Apply theme to document
   */
  function applyTheme(theme, animate = true) {
    const html = document.documentElement;
    
    if (!animate) {
      html.setAttribute('data-theme-switching', '');
    }
    
    html.setAttribute('data-theme', theme);
    
    if (!animate) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          html.removeAttribute('data-theme-switching');
        });
      });
    }
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = theme === 'dark' ? '#0a1628' : '#ffffff';
    }
    
    console.log(`[Theme] Switched to ${theme} mode`);
  }

  /**
   * Save and apply theme
   */
  function setTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('themechange', { 
      detail: { theme } 
    }));
  }

  /**
   * Toggle between light and dark
   */
  function toggle() {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  }

  /**
   * Create theme toggle button
   */
  function createToggle(container) {
    const currentTheme = getTheme();
    const isDark = currentTheme === 'dark';
    
    const button = document.createElement('button');
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', `Passer en mode ${isDark ? 'clair' : 'sombre'}`);
    button.setAttribute('aria-pressed', !isDark);
    button.setAttribute('title', `Mode ${isDark ? 'sombre' : 'clair'}`);
    
    button.innerHTML = `
      <span class="theme-toggle-slider">
        <span class="theme-toggle-icon sun-icon">☀</span>
        <span class="theme-toggle-icon moon-icon">☾</span>
      </span>
    `;
    
    button.addEventListener('click', () => {
      const newTheme = toggle();
      button.setAttribute('aria-pressed', newTheme === 'light');
      button.setAttribute('aria-label', `Passer en mode ${newTheme === 'dark' ? 'clair' : 'sombre'}`);
      button.setAttribute('title', `Mode ${newTheme}`);
    });
    
    if (container) {
      container.appendChild(button);
    }
    
    return button;
  }

  /**
   * Initialize theme system
   */
  function init() {
    // Apply initial theme without animation
    applyTheme(getTheme(), false);
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
    
    console.log('[Theme System] Initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API
  window.ThemeSystem = {
    get: getTheme,
    set: setTheme,
    toggle,
    createToggle,
    STORAGE_KEY
  };
})();
