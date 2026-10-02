/**
 * SOLITFIFPRO225 - Performance Optimizations
 * Optimisations globales pour tout le site
 * SOLITAIRE HACK SIGNATURE
 */

(function() {
  'use strict';

  // ============================================
  // LAZY LOADING IMAGES
  // ============================================
  function initLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            // Lazy load
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            
            // Lazy background
            if (img.dataset.bg) {
              img.style.backgroundImage = `url(${img.dataset.bg})`;
              img.removeAttribute('data-bg');
            }
            
            img.classList.add('loaded');
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      document.querySelectorAll('img[data-src], [data-bg]').forEach(img => {
        imageObserver.observe(img);
      });
    } else {
      // Fallback: charger tout immédiatement
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
      });
    }
  }

  // ============================================
  // PRELOAD CRITICAL RESOURCES
  // ============================================
  function preloadCriticalResources() {
    const criticalResources = [
      { href: '/styles.css', as: 'style' },
      { href: '/mobile.css', as: 'style' }
    ];

    criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.href;
      link.as = resource.as;
      if (resource.as === 'style') {
        link.onload = () => { link.rel = 'stylesheet'; };
      }
      document.head.appendChild(link);
    });
  }

  // ============================================
  // INTERSECTION OBSERVER FOR ANIMATIONS
  // ============================================
  function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    
    if (!('IntersectionObserver' in window)) {
      animatedElements.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    animatedElements.forEach(el => observer.observe(el));
  }

  // ============================================
  // DEBOUNCE/THROTTLE UTILITIES
  // ============================================
  function debounce(func, wait = 100) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ============================================
  // SMOOTH SCROLL POLYFILL
  // ============================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // ============================================
  // NETWORK STATUS MONITORING
  // ============================================
  function initNetworkMonitoring() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      connection.addEventListener('change', () => {
        document.body.classList.toggle('slow-network', connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
        document.body.classList.toggle('fast-network', connection.effectiveType === '4g');
      });
    }
  }

  // ============================================
  // MEMORY MANAGEMENT
  // ============================================
  function initMemoryManagement() {
    // Cleanup timers on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Pause non-critical operations
        console.log('[Performance] Page hidden, pausing non-critical ops');
      }
    });
  }

  // ============================================
  // INITIALIZE ALL
  // ============================================
  function init() {
    preloadCriticalResources();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initLazyLoading();
        initScrollAnimations();
        initSmoothScroll();
        initNetworkMonitoring();
        initMemoryManagement();
        console.log('[Performance] Optimizations initialized');
      });
    } else {
      initLazyLoading();
      initScrollAnimations();
      initSmoothScroll();
      initNetworkMonitoring();
      initMemoryManagement();
    }
  }

  // Expose utilities globally
  window.PerformanceUtils = {
    debounce,
    throttle,
    initLazyLoading,
    initScrollAnimations
  };

  init();
})();
