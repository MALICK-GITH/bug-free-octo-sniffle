/**
 * SOLITFIFPRO225 - Web Vitals Monitoring
 * Phase 2: Performance monitoring avec Core Web Vitals
 * SOLITAIRE HACK SIGNATURE
 */

(function() {
  'use strict';

  // Web Vitals thresholds (Google recommended)
  const THRESHOLDS = {
    LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint
    FID: { good: 100, poor: 300 },        // First Input Delay
    CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
    FCP: { good: 1800, poor: 3000 },     // First Contentful Paint
    TTFB: { good: 800, poor: 1800 }      // Time to First Byte
  };

  // Store metrics
  const metrics = {};

  /**
   * Utility: Get rating based on value and thresholds
   */
  function getRating(value, thresholds) {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Utility: Round to 2 decimals
   */
  function round(value) {
    return Math.round(value * 100) / 100;
  }

  /**
   * Send metrics to console and optionally to analytics endpoint
   */
  function sendToAnalytics(metric) {
    const { name, value, rating, delta, id } = metric;
    
    // Log to console with styling
    const styles = {
      good: 'color: #42f56c; font-weight: bold;',
      'needs-improvement': 'color: #ffd166; font-weight: bold;',
      poor: 'color: #ff5f79; font-weight: bold;'
    };
    
    console.log(
      `%c[Web Vitals] ${name}: ${value}${name === 'CLS' ? '' : 'ms'} (${rating})`,
      styles[rating] || 'color: inherit;'
    );

    // Store for later access
    metrics[name] = { value, rating, timestamp: Date.now() };

    // Send to custom endpoint if configured
    if (window.WEB_VITALS_ENDPOINT) {
      fetch(window.WEB_VITALS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          value: round(value),
          rating,
          delta: round(delta),
          id,
          url: window.location.href,
          userAgent: navigator.userAgent
        }),
        keepalive: true
      }).catch(err => console.warn('[Web Vitals] Failed to send:', err));
    }

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('web-vital', { detail: metric }));
  }

  /**
   * Measure LCP (Largest Contentful Paint)
   */
  function measureLCP() {
    if (!window.PerformanceObserver) return;
    
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      if (lastEntry) {
        const value = lastEntry.startTime;
        sendToAnalytics({
          name: 'LCP',
          value: round(value),
          rating: getRating(value, THRESHOLDS.LCP),
          delta: value,
          id: lastEntry.id
        });
      }
    });
    
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  /**
   * Measure FID (First Input Delay)
   */
  function measureFID() {
    if (!window.PerformanceObserver) return;
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'first-input') {
          const value = entry.processingStart - entry.startTime;
          sendToAnalytics({
            name: 'FID',
            value: round(value),
            rating: getRating(value, THRESHOLDS.FID),
            delta: value,
            id: entry.id || Math.random().toString(36).slice(2)
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['first-input'] });
  }

  /**
   * Measure CLS (Cumulative Layout Shift)
   */
  function measureCLS() {
    if (!window.PerformanceObserver) return;
    
    let clsValue = 0;
    let sessionEntries = [];
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only count layout shifts without recent user input
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          sessionEntries.push(entry);
        }
      }
    });
    
    observer.observe({ entryTypes: ['layout-shift'] });
    
    // Report CLS on page unload
    window.addEventListener('beforeunload', () => {
      sendToAnalytics({
        name: 'CLS',
        value: round(clsValue),
        rating: getRating(clsValue, THRESHOLDS.CLS),
        delta: round(clsValue),
        id: 'cls-final'
      });
    });
    
    // Also report on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendToAnalytics({
          name: 'CLS',
          value: round(clsValue),
          rating: getRating(clsValue, THRESHOLDS.CLS),
          delta: round(clsValue),
          id: 'cls-visibility'
        });
      }
    });
  }

  /**
   * Measure FCP (First Contentful Paint)
   */
  function measureFCP() {
    if (!window.PerformanceObserver) return;
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          const value = entry.startTime;
          sendToAnalytics({
            name: 'FCP',
            value: round(value),
            rating: getRating(value, THRESHOLDS.FCP),
            delta: value,
            id: entry.id || 'fcp'
          });
          observer.disconnect();
        }
      }
    });
    
    observer.observe({ entryTypes: ['paint'] });
  }

  /**
   * Measure TTFB (Time to First Byte)
   */
  function measureTTFB() {
    if (!window.performance || !performance.timing) return;
    
    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = performance.timing;
        const value = timing.responseStart - timing.navigationStart;
        
        sendToAnalytics({
          name: 'TTFB',
          value: round(value),
          rating: getRating(value, THRESHOLDS.TTFB),
          delta: value,
          id: 'ttfb'
        });
      }, 0);
    });
  }

  /**
   * Get all collected metrics
   */
  function getMetrics() {
    return { ...metrics };
  }

  /**
   * Display metrics in UI (for debugging)
   */
  function displayMetricsUI() {
    const container = document.createElement('div');
    container.id = 'web-vitals-debug';
    container.innerHTML = `
      <div style="
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(10, 22, 40, 0.95);
        border: 1px solid rgba(66, 245, 108, 0.3);
        border-radius: 12px;
        padding: 12px;
        font-family: monospace;
        font-size: 12px;
        color: #f2f2f7;
        z-index: 9999;
        min-width: 200px;
        backdrop-filter: blur(10px);
      ">
        <div style="font-weight: bold; margin-bottom: 8px; color: #42f56c;">Core Web Vitals</div>
        <div id="vitals-list">Loading...</div>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Update display
    setInterval(() => {
      const list = document.getElementById('vitals-list');
      if (!list) return;
      
      const colors = {
        good: '#42f56c',
        'needs-improvement': '#ffd166',
        poor: '#ff5f79'
      };
      
      list.innerHTML = Object.entries(metrics)
        .map(([name, data]) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>${name}:</span>
            <span style="color: ${colors[data.rating]}; font-weight: bold;">
              ${data.value}${name === 'CLS' ? '' : 'ms'}
            </span>
          </div>
        `).join('') || '<span style="color: #8e8e93;">Waiting for metrics...</span>';
    }, 1000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Skip if reduced data mode
    if (navigator.connection && navigator.connection.saveData) {
      console.log('[Web Vitals] Skipping: Save Data mode enabled');
      return;
    }
    
    measureLCP();
    measureFID();
    measureCLS();
    measureFCP();
    measureTTFB();
    
    console.log('[Web Vitals] Monitoring initialized');
    
    // Expose API
    window.WebVitalsMonitor = {
      getMetrics,
      displayUI: displayMetricsUI,
      THRESHOLDS
    };
  }
})();
