/**
 * SOLITFIFPRO225 - Image Optimizer
 * Optimisation automatique des images sur tout le site
 * SOLITAIRE HACK SIGNATURE
 */

(function () {
  'use strict';

  const ImageOptimizer = {
    // Configuration
    config: {
      lazyLoadThreshold: '50px',
      fadeInDuration: 300,
      placeholderColor: 'rgba(32, 32, 40, 0.52)',
      supportedFormats: ['webp', 'jpeg', 'png', 'svg'],
      quality: {
        high: 0.9,
        medium: 0.7,
        low: 0.5
      }
    },

    // ============================================
    // INITIALIZE
    // ============================================
    init() {
      this.setupLazyLoading();
      this.setupResponsiveImages();
      this.setupErrorHandling();
      this.setupNetworkAwareLoading();
      console.log('[Image Optimizer] Initialized');
    },

    // ============================================
    // LAZY LOADING WITH INTERSECTION OBSERVER
    // ============================================
    setupLazyLoading() {
      if (!('IntersectionObserver' in window)) {
        // Fallback: load all images immediately
        this.loadAllImages();
        return;
      }

      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            imageObserver.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: this.config.lazyLoadThreshold,
        threshold: 0.01
      });

      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach(img => {
        this.addPlaceholder(img);
        imageObserver.observe(img);
      });
    },

    // ============================================
    // LOAD INDIVIDUAL IMAGE
    // ============================================
    loadImage(img) {
      const src = img.dataset.src;
      if (!src) return;

      // Create new image to preload
      const preloadImg = new Image();

      preloadImg.onload = () => {
        img.src = src;
        img.classList.add('loaded');
        img.removeAttribute('data-src');

        // Remove placeholder
        const placeholder = img.parentElement.querySelector('.img-placeholder');
        if (placeholder) {
          placeholder.style.opacity = '0';
          setTimeout(() => placeholder.remove(), this.config.fadeInDuration);
        }
      };

      preloadImg.onerror = () => {
        this.handleImageError(img);
      };

      preloadImg.src = src;
    },

    // ============================================
    // ADD PLACEHOLDER
    // ============================================
    addPlaceholder(img) {
      // Skip if already has placeholder or is in a container
      if (img.parentElement.querySelector('.img-placeholder')) return;

      const _width = img.width || img.getBoundingClientRect().width || 300;
      const _height = img.height || img.getBoundingClientRect().height || 200;
      // Reserved for future aspect ratio calculations

      const placeholder = document.createElement('div');
      placeholder.className = 'img-placeholder';
      placeholder.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: ${this.config.placeholderColor};
        border-radius: inherit;
      `;

      // Make container relative if not already
      if (getComputedStyle(img.parentElement).position === 'static') {
        img.parentElement.style.position = 'relative';
      }

      img.parentElement.insertBefore(placeholder, img);
      img.style.opacity = '0';
      img.style.transition = `opacity ${this.config.fadeInDuration}ms ease`;
    },

    // ============================================
    // RESPONSIVE IMAGES
    // ============================================
    setupResponsiveImages() {
      document.querySelectorAll('img[data-responsive]').forEach(img => {
        this.updateResponsiveImage(img);
      });

      // Update on resize (debounced)
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          document.querySelectorAll('img[data-responsive]').forEach(img => {
            this.updateResponsiveImage(img);
          });
        }, 250);
      });
    },

    // ============================================
    // UPDATE RESPONSIVE IMAGE SOURCE
    // ============================================
    updateResponsiveImage(img) {
      const width = window.innerWidth;
      let size = 'small';

      if (width >= 1920) size = 'xlarge';
      else if (width >= 1280) size = 'large';
      else if (width >= 768) size = 'medium';

      const baseSrc = img.dataset.src || img.src;
      const ext = baseSrc.split('.').pop();
      const basePath = baseSrc.replace(`.${ext}`, '');

      const newSrc = `${basePath}-${size}.${ext}`;

      if (img.src !== newSrc) {
        img.dataset.src = newSrc;
        if (img.classList.contains('loaded')) {
          this.loadImage(img);
        }
      }
    },

    // ============================================
    // NETWORK-AWARE LOADING
    // ============================================
    setupNetworkAwareLoading() {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (connection) {
        connection.addEventListener('change', () => {
          this.adjustQualityBasedOnNetwork(connection);
        });

        // Initial adjustment
        this.adjustQualityBasedOnNetwork(connection);
      }
    },

    // ============================================
    // ADJUST QUALITY BASED ON NETWORK
    // ============================================
    adjustQualityBasedOnNetwork(connection) {
      const type = connection.effectiveType;
      const saveData = connection.saveData;

      document.body.classList.remove('quality-high', 'quality-medium', 'quality-low');

      if (saveData || type === '2g' || type === 'slow-2g') {
        document.body.classList.add('quality-low');
        console.log('[Image Optimizer] Low quality mode (save data)');
      } else if (type === '3g') {
        document.body.classList.add('quality-medium');
        console.log('[Image Optimizer] Medium quality mode');
      } else {
        document.body.classList.add('quality-high');
        console.log('[Image Optimizer] High quality mode');
      }
    },

    // ============================================
    // ERROR HANDLING
    // ============================================
    setupErrorHandling() {
      document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', () => this.handleImageError(img));
      });
    },

    // ============================================
    // HANDLE IMAGE ERROR
    // ============================================
    handleImageError(img) {
      console.warn(`[Image Optimizer] Failed to load: ${img.src}`);

      // Add error class for styling
      img.classList.add('img-error');

      // Try fallback if available
      if (img.dataset.fallback) {
        img.src = img.dataset.fallback;
      } else {
        // Create SVG placeholder
        const width = img.width || 100;
        const height = img.height || 100;
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <rect width="100%" height="100%" fill="${this.config.placeholderColor}"/>
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#71717a" font-size="14">
              Image indisponible
            </text>
          </svg>
        `;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }
    },

    // ============================================
    // FALLBACK: LOAD ALL IMAGES
    // ============================================
    loadAllImages() {
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
        img.classList.add('loaded');
      });
    },

    // ============================================
    // UTILITY: CONVERT TO WEBP (if supported)
    // ============================================
    async convertToWebP(img) {
      if (!this.isWebPSupported()) return;

      const src = img.dataset.src || img.src;
      if (src.endsWith('.webp')) return;

      // In a real implementation, you'd have WebP versions on the server
      // This is a placeholder for the concept
      const webpSrc = src.replace(/\.(png|jpg|jpeg)$/, '.webp');
      img.dataset.src = webpSrc;
    },

    // ============================================
    // CHECK WEBP SUPPORT
    // ============================================
    isWebPSupported() {
      const canvas = document.createElement('canvas');
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ImageOptimizer.init());
  } else {
    ImageOptimizer.init();
  }

  // Expose globally
  window.ImageOptimizer = ImageOptimizer;
})();
