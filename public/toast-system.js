/**
 * SOLITFIFPRO225 - Global Toast Notification System
 * Phase 3: Système de toast unifié pour tout le site
 * SOLITAIRE HACK SIGNATURE
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    duration: 4000,
    maxToasts: 5,
    position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left, center
    animation: 'slide', // slide, fade, scale
    sounds: false
  };

  // Container pour les toasts
  let container = null;

  /**
   * Crée le conteneur de toasts s'il n'existe pas
   */
  function getContainer() {
    if (container) return container;
    
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Notifications');
    
    // Styles CSS-in-JS pour le conteneur
    Object.assign(container.style, {
      position: 'fixed',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'none'
    });
    
    // Positionnement
    setContainerPosition(CONFIG.position);
    
    document.body.appendChild(container);
    return container;
  }

  /**
   * Définit la position du conteneur
   */
  function setContainerPosition(position) {
    const positions = {
      'bottom-right': { bottom: '24px', right: '24px', alignItems: 'flex-end' },
      'bottom-left': { bottom: '24px', left: '24px', alignItems: 'flex-start' },
      'top-right': { top: '24px', right: '24px', alignItems: 'flex-end' },
      'top-left': { top: '24px', left: '24px', alignItems: 'flex-start' },
      'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', alignItems: 'center' }
    };
    
    const pos = positions[position] || positions['bottom-right'];
    Object.assign(container?.style || {}, pos);
  }

  /**
   * Crée un élément toast
   */
  function createToastElement(options) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type}`;
    toast.setAttribute('role', 'alert');
    
    // Styles
    Object.assign(toast.style, {
      background: 'rgba(22, 22, 30, 0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      minWidth: '300px',
      maxWidth: '400px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
      pointerEvents: 'auto',
      cursor: 'pointer',
      transform: 'translateX(100px)',
      opacity: '0',
      transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)'
    });
    
    // Couleur selon le type
    const typeColors = {
      success: '#42f56c',
      error: '#ff5f79',
      warning: '#ffd166',
      info: '#24d7ff'
    };
    
    const borderColor = typeColors[options.type] || typeColors.info;
    toast.style.borderLeft = `4px solid ${borderColor}`;
    
    // Icon
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    toast.innerHTML = `
      <span style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${borderColor}20;
        color: ${borderColor};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      ">${icons[options.type] || icons.info}</span>
      <div style="flex: 1; min-width: 0;">
        ${options.title ? `<div style="font-weight: 600; margin-bottom: 4px; color: #f2f2f7;">${options.title}</div>` : ''}
        <div style="font-size: 14px; color: #8e8e93; line-height: 1.4;">${options.message}</div>
      </div>
      <button style="
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: #8e8e93;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        padding: 0;
        flex-shrink: 0;
      " aria-label="Fermer">×</button>
    `;
    
    // Close button handler
    toast.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      hideToast(toast);
    });
    
    // Click on toast
    toast.addEventListener('click', () => {
      if (options.onClick) options.onClick();
      hideToast(toast);
    });
    
    return toast;
  }

  /**
   * Affiche un toast
   */
  function show(options) {
    const container = getContainer();
    
    // Limite le nombre de toasts
    while (container.children.length >= CONFIG.maxToasts) {
      container.removeChild(container.firstChild);
    }
    
    const toast = createToastElement(options);
    container.appendChild(toast);
    
    // Animation d'entrée
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });
    
    // Auto-hide
    const duration = options.duration || CONFIG.duration;
    const hideTimeout = setTimeout(() => {
      hideToast(toast);
    }, duration);
    
    // Pause on hover
    toast.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
    });
    
    toast.addEventListener('mouseleave', () => {
      setTimeout(() => hideToast(toast), 1000);
    });
    
    return toast;
  }

  /**
   * Cache un toast avec animation
   */
  function hideToast(toast) {
    if (!toast.parentNode) return;
    
    toast.style.transform = 'translateX(100px)';
    toast.style.opacity = '0';
    
    setTimeout(() => {
      toast.remove();
    }, 400);
  }

  /**
   * API publique
   */
  const Toast = {
    success(message, title, options = {}) {
      return show({ type: 'success', message, title, ...options });
    },
    
    error(message, title, options = {}) {
      return show({ type: 'error', message, title, ...options });
    },
    
    warning(message, title, options = {}) {
      return show({ type: 'warning', message, title, ...options });
    },
    
    info(message, title, options = {}) {
      return show({ type: 'info', message, title, ...options });
    },
    
    config(newConfig) {
      Object.assign(CONFIG, newConfig);
      if (newConfig.position) {
        setContainerPosition(newConfig.position);
      }
    },
    
    clear() {
      const container = document.getElementById('toast-container');
      if (container) {
        container.innerHTML = '';
      }
    }
  };

  // Expose globalement
  window.Toast = Toast;
  
  console.log('[Toast System] Initialized');
})();
