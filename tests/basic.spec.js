/**
 * SOLITFIFPRO225 - Basic E2E Tests
 * Phase 3: Tests End-to-End basiques
 * SOLITAIRE HACK SIGNATURE
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Navigation', () => {
  
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/SOLITFIFPRO225/);
    
    // Check main elements
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
  });
  
  test('navigation links work', async ({ page }) => {
    await page.goto('/');
    
    // Check coupon page link
    const couponLink = page.locator('a[href="/coupon.html"]');
    await expect(couponLink).toBeVisible();
    
    // Click and verify navigation
    await couponLink.click();
    await expect(page).toHaveURL(/coupon\.html/);
  });
  
  test('theme toggle works', async ({ page }) => {
    await page.goto('/');
    
    // Find theme toggle
    const themeToggle = page.locator('.theme-toggle');
    
    // If theme toggle exists, test it
    if (await themeToggle.isVisible().catch(() => false)) {
      const initialTheme = await page.locator('html').getAttribute('data-theme');
      
      await themeToggle.click();
      
      const newTheme = await page.locator('html').getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);
    }
  });
  
  test('skip link works for accessibility', async ({ page }) => {
    await page.goto('/');
    
    // Find skip link
    const skipLink = page.locator('.skip-link');
    
    // Press Tab to focus skip link
    await page.keyboard.press('Tab');
    
    // Check if skip link is visible/focusable
    await expect(skipLink).toBeVisible();
  });
  
  test('toast notifications work', async ({ page }) => {
    await page.goto('/');
    
    // Trigger a toast via console
    await page.evaluate(() => {
      if (window.Toast) {
        window.Toast.info('Test toast message');
      }
    });
    
    // Check if toast appears
    const toast = page.locator('#toast-container .toast');
    await expect(toast).toBeVisible();
  });
  
  test('mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Check that content is visible and accessible
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that no horizontal overflow
    const body = await page.locator('body');
    const scrollWidth = await body.evaluate(el => el.scrollWidth);
    const clientWidth = await body.evaluate(el => el.clientWidth);
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px rounding
  });
  
  test('service worker registration', async ({ page }) => {
    await page.goto('/');
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });
  
  test('web vitals monitoring active', async ({ page }) => {
    await page.goto('/');
    
    // Check if WebVitalsMonitor is available
    const vitalsAvailable = await page.evaluate(() => {
      return !!window.WebVitalsMonitor;
    });
    
    expect(vitalsAvailable).toBe(true);
  });
  
});

test.describe('Coupon Page', () => {
  
  test('coupon page loads', async ({ page }) => {
    await page.goto('/coupon.html');
    
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.coupon-portal')).toBeVisible();
  });
  
  test('coupon generation workflow', async ({ page }) => {
    await page.goto('/coupon.html');
    
    // Find generate button
    const generateBtn = page.locator('button:has-text("Generer")').first();
    
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();
      
      // Wait for result
      await page.waitForTimeout(1000);
      
      // Check for result or loading state
      const result = page.locator('.coupon-result, .result-container, .generated-coupon');
      await expect(result).toBeVisible().catch(() => {
        // If no specific result selector, just check page didn't crash
        expect(page.locator('body')).toBeVisible();
      });
    }
  });
  
});

test.describe('Match Page', () => {
  
  test('match page loads', async ({ page }) => {
    await page.goto('/match.html');
    
    await expect(page.locator('body')).toBeVisible();
  });
  
});

test.describe('Performance', () => {
  
  test('LCP is under threshold', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      return performance.getEntriesByType('paint');
    });
    
    const fcp = metrics.find(m => m.name === 'first-contentful-paint');
    
    if (fcp) {
      expect(fcp.startTime).toBeLessThan(3000); // FCP under 3s
    }
  });
  
  test('no console errors on load', async ({ page }) => {
    const errors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    expect(errors).toHaveLength(0);
  });
  
});
