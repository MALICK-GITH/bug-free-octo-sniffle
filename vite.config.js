/**
 * SOLITFIFPRO225 - Vite Configuration
 * Phase 2: Bundler pour optimisation
 * SOLITAIRE HACK SIGNATURE
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'public',
  base: '/',
  
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    
    // Rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        coupon: resolve(__dirname, 'public/coupon.html'),
        sublime: resolve(__dirname, 'public/coupon-sublime.html'),
        match: resolve(__dirname, 'public/match.html'),
        about: resolve(__dirname, 'public/about.html'),
        developpeur: resolve(__dirname, 'public/developpeur.html'),
        mode: resolve(__dirname, 'public/mode-emploi.html')
      }
    },
    
    // Optimization
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    
    // CSS
    cssMinify: true,
    
    // Assets
    assetsInlineLimit: 4096,
    
    // Chunking
    chunkSizeWarningLimit: 500,
    
    // Source maps for production debugging
    sourcemap: true
  },
  
  // Development server
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  // CSS preprocessing
  css: {
    devSourcemap: true
  },
  
  // Plugins
  plugins: [
    // Custom plugin for HTML processing
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Add lazy loading to images
        return html.replace(
          /<img([^>]*)>/gi,
          (match, attrs) => {
            if (!attrs.includes('loading=')) {
              return `<img${attrs} loading="lazy">`;
            }
            return match;
          }
        );
      }
    }
  ],
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['socket.io-client']
  }
});
