// Mobile viewport fix (non-invasive)
class MobileViewportFix {
  constructor() {
    this.isMobile = this.detectMobile();
    if (!this.isMobile) return;
    this.init();
  }

  detectMobile() {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    );
  }

  init() {
    this.ensureViewportMeta();
    this.updateViewportVars();
    this.bindEvents();
  }

  ensureViewportMeta() {
    const viewport =
      document.querySelector('meta[name="viewport"]') ||
      (() => {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
        return meta;
      })();

    // Keep zoom enabled and avoid forcing "height=device-height".
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0, user-scalable=yes'
    );
  }

  updateViewportVars() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const vh = height * 0.01;

    document.documentElement.style.setProperty('--viewport-width', `${width}px`);
    document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--app-height', `${height}px`);

    document.body.classList.toggle('landscape', width > height);
    document.body.classList.toggle('portrait', width <= height);
  }

  bindEvents() {
    let resizeTimeout;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.updateViewportVars(), 100);
    };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.updateViewportVars(), 140);
    });
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.mobileViewportFix = new MobileViewportFix();
    });
  } else {
    window.mobileViewportFix = new MobileViewportFix();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileViewportFix;
}
