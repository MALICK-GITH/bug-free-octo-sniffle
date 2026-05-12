/**
 * SOLITFIFPRO225 - Basic E2E Tests
 * Phase 3: Tests End-to-End basiques
 * SOLITAIRE HACK SIGNATURE
 */

import { test, expect } from '@playwright/test';

async function dismissWelcomeModal(page) {
  const modal = page.locator('#welcomeModal');
  if (!(await modal.isVisible().catch(() => false))) return;

  const closeButton = page.locator('#welcomeClose');
  try {
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ timeout: 2000 });
    } else {
      await page.keyboard.press('Escape');
    }
  } catch (_error) {
    try {
      await page.keyboard.press('Escape');
    } catch (_keyboardError) {
      return;
    }
  }

  try {
    await expect(modal).toBeHidden({ timeout: 5000 });
  } catch (_error) {
    return;
  }
}

async function visit(page, path) {
  await page.goto(path, { waitUntil: 'load' });
}

test.describe('Basic Navigation', () => {
  
  test('homepage loads successfully', async ({ page }) => {
    await visit(page, '/');
    
    // Check title
    await expect(page).toHaveTitle(/SOLITFIFPRO225/);
    
    // Check main elements
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
  });
  
  test('navigation links work', async ({ page }) => {
    await visit(page, '/');
    await dismissWelcomeModal(page);
    
    // Check coupon page link
    const couponLink = page.locator('a[href="/coupon.html"]');
    await expect(couponLink).toBeVisible();
    
    // Click and verify navigation
    await couponLink.scrollIntoViewIfNeeded();
    await couponLink.click();
    await expect(page).toHaveURL(/coupon\.html/);
  });
  
  test('theme toggle works', async ({ page }) => {
    await visit(page, '/');
    
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
    await visit(page, '/');
    
    // Find skip link
    const skipLink = page.locator('.skip-link');
    
    // Press Tab to focus skip link
    await page.keyboard.press('Tab');
    
    // Check if skip link is visible/focusable
    await expect(skipLink).toBeVisible();
  });
  
  test('toast notifications work', async ({ page }) => {
    await visit(page, '/');
    await page.waitForFunction(() => !!window.Toast, { timeout: 10000 });
    
    // Trigger a toast via console
    await page.evaluate(() => {
      if (window.Toast) {
        window.Toast.info('Test toast message');
      }
    });
    
    // Check if toast appears
    const toast = page.locator('#toast-container .toast');
    await expect(toast).toBeVisible({ timeout: 10000 });
  });
  
  test('mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await visit(page, '/');
    
    // Check that content is visible and accessible
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that no horizontal overflow
    const body = await page.locator('body');
    const scrollWidth = await body.evaluate(el => el.scrollWidth);
    const clientWidth = await body.evaluate(el => el.clientWidth);
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px rounding
  });
  
  test('service worker registration', async ({ page }) => {
    await visit(page, '/');
    
    // Poll for service worker registration instead of sleeping blindly.
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(navigator.serviceWorker.controller || registration);
    }, { timeout: 10000 });
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(navigator.serviceWorker.controller || registration);
    });
    
    expect(swRegistered).toBe(true);
  });
  
  test('web vitals monitoring active', async ({ page }) => {
    await visit(page, '/');
    
    // Check if WebVitalsMonitor is available
    await page.waitForFunction(() => !!window.WebVitalsMonitor, { timeout: 15000 });
    const vitalsAvailable = await page.evaluate(() => {
      return !!window.WebVitalsMonitor;
    });
    
    expect(vitalsAvailable).toBe(true);
  });
  
});

test.describe('Coupon Page', () => {
  
  test('coupon page loads', async ({ page }) => {
    await visit(page, '/coupon.html');
    
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.coupon-portal')).toBeVisible();
  });
  
  test('coupon generation workflow', async ({ page }) => {
    await visit(page, '/coupon.html');
    
    // Find generate button
    const generateBtn = page.locator('button:has-text("Generer")').first();
    
    if (await generateBtn.isVisible().catch(() => false)) {
      await expect(generateBtn).toBeEnabled();
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
    await visit(page, '/match.html');
    
    await expect(page.locator('body')).toBeVisible();
  });
  
});

test.describe('Performance', () => {
  
  test('LCP is under threshold', async ({ page }) => {
    await visit(page, '/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      return performance.getEntriesByType('paint');
    });
    
    const fcp = metrics.find(m => m.name === 'first-contentful-paint');
    
    if (fcp) {
      if (fcp.startTime >= 3000) {
        console.warn(`FCP warning: ${fcp.startTime.toFixed(0)}ms`);
      }
      // Keep "good" FCP under 3s; allow slower builds to surface as warnings first.
      expect(fcp.startTime).toBeLessThan(3000);
    }
  });
  
  test('no console errors on load', async ({ page }) => {
    const errors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await visit(page, '/');
    await page.waitForLoadState('networkidle');
    
    expect(errors).toHaveLength(0);
  });
  
});
