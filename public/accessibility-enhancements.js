/**
 * SOLITFIFPRO225 - Accessibility Enhancements (A11Y)
 * Améliorations d'accessibilité globales
 * SOLITAIRE HACK SIGNATURE
 */

(function() {
  'use strict';

  // ============================================
  // SKIP LINK FUNCTIONALITY
  // ============================================
  function initSkipLinks() {
    // Ensure skip links work properly
    document.querySelectorAll('.skip-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.tabIndex = -1;
          target.focus();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // ============================================
  // FOCUS MANAGEMENT
  // ============================================
  function initFocusManagement() {
    // Add visible focus indicators
    document.body.classList.add('focus-visible-enabled');
    
    // Trap focus in modals
    const modals = document.querySelectorAll('[role="dialog"], .modal');
    modals.forEach(modal => {
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          modal.classList.add('hidden');
          modal.setAttribute('aria-hidden', 'true');
        }
        
        if (e.key === 'Tab') {
          const focusableElements = modal.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
          );
          const firstFocusable = focusableElements[0];
          const lastFocusable = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
              lastFocusable.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastFocusable) {
              firstFocusable.focus();
              e.preventDefault();
            }
          }
        }
      });
    });
  }

  // ============================================
  // ARIA LIVE REGIONS
  // ============================================
  function initLiveRegions() {
    // Create live region if not exists
    if (!document.getElementById('a11y-live-region')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'a11y-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    // Helper to announce messages
    window.announceToScreenReader = function(message) {
      const liveRegion = document.getElementById('a11y-live-region');
      if (liveRegion) {
        liveRegion.textContent = message;
        setTimeout(() => {
          liveRegion.textContent = '';
        }, 1000);
      }
    };
  }

  // ============================================
  // KEYBOARD NAVIGATION SHORTCUTS
  // ============================================
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt + 1: Go to main content
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        const main = document.querySelector('main') || document.querySelector('#main-content');
        if (main) {
          main.focus();
          main.scrollIntoView({ behavior: 'smooth' });
        }
      }
      
      // Alt + 2: Go to navigation
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        const nav = document.querySelector('nav') || document.querySelector('.page-link-cloud');
        if (nav) {
          nav.focus();
          nav.scrollIntoView({ behavior: 'smooth' });
        }
      }
      
      // Alt + 0: Go to accessibility help
      if (e.altKey && e.key === '0') {
        e.preventDefault();
        showAccessibilityHelp();
      }
    });
  }

  // ============================================
  // ACCESSIBILITY HELP PANEL
  // ============================================
  function showAccessibilityHelp() {
    const helpPanel = document.createElement('div');
    helpPanel.className = 'a11y-help-panel';
    helpPanel.setAttribute('role', 'dialog');
    helpPanel.setAttribute('aria-label', 'Aide accessibilité');
    helpPanel.innerHTML = `
      <div class="a11y-help-content">
        <h2>Raccourcis clavier</h2>
        <ul>
          <li><kbd>Alt + 1</kbd> : Aller au contenu principal</li>
          <li><kbd>Alt + 2</kbd> : Aller à la navigation</li>
          <li><kbd>Alt + 0</kbd> : Afficher cette aide</li>
          <li><kbd>Tab</kbd> : Navigation entre les éléments</li>
          <li><kbd>Shift + Tab</kbd> : Navigation inverse</li>
          <li><kbd>Échap</kbd> : Fermer les fenêtres modales</li>
        </ul>
        <button class="close-help" onclick="this.parentElement.parentElement.remove()">Fermer</button>
      </div>
    `;
    document.body.appendChild(helpPanel);
    helpPanel.querySelector('.close-help').focus();
  }

  // ============================================
  // FORM VALIDATION ACCESSIBILITY
  // ============================================
  function initFormAccessibility() {
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', (e) => {
        const invalidFields = form.querySelectorAll(':invalid');
        if (invalidFields.length > 0) {
          e.preventDefault();
          invalidFields[0].focus();
          window.announceToScreenReader?.('Formulaire incomplet. Veuillez corriger les erreurs.');
        }
      });

      // Real-time validation feedback
      form.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('blur', () => {
          if (field.checkValidity()) {
            field.removeAttribute('aria-invalid');
          } else {
            field.setAttribute('aria-invalid', 'true');
          }
        });
      });
    });
  }

  // ============================================
  // REDUCE MOTION SUPPORT
  // ============================================
  function initReduceMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    function handleMotionPreference() {
      document.body.classList.toggle('reduce-motion', prefersReducedMotion.matches);
    }
    
    prefersReducedMotion.addEventListener('change', handleMotionPreference);
    handleMotionPreference();
  }

  // ============================================
  // INITIALIZE ALL
  // ============================================
  function init() {
    initSkipLinks();
    initFocusManagement();
    initLiveRegions();
    initKeyboardShortcuts();
    initFormAccessibility();
    initReduceMotion();
    
    console.log('[Accessibility] Enhancements initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
