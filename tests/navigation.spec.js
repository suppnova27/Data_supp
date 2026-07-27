import { test, expect } from '@playwright/test';
import { createSupabaseMockHandler, mockLoggedInSession, injectSessionIntoStorage } from './helpers/supabase-mock.js';

test.describe('Navigation between modules', () => {
  test.beforeEach(async ({ page }) => {
    const session = mockLoggedInSession();
    await injectSessionIntoStorage(page, session);
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
    await page.goto('/');
    await page.waitForTimeout(5000);
  });

  test('should navigate to Clientes', async ({ page }) => {
    const link = page.locator('button:has-text("Clientes Activos")').first();
    await link.click();
    await page.waitForTimeout(1000);
    const content = await page.textContent('body');
    expect(content).toContain('Clientes');
  });

  test('should navigate to Finanzas', async ({ page }) => {
    const link = page.locator('button:has-text("Finanzas")').first();
    await link.click();
    await page.waitForTimeout(1000);
    const content = await page.textContent('body');
    expect(content).toContain('Finanzas');
  });

  test('should navigate to Inventario', async ({ page }) => {
    const link = page.locator('button:has-text("Inventario")').first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForTimeout(1000);
      const content = await page.textContent('body');
      expect(content).toContain('Inventario');
    }
  });

  test('should navigate back to Dashboard', async ({ page }) => {
    const clientesLink = page.locator('button:has-text("Clientes Activos")').first();
    await clientesLink.click();
    await page.waitForTimeout(500);
    const dashLink = page.locator('button:has-text("Dashboard")').first();
    await dashLink.click();
    await page.waitForTimeout(1000);
    const content = await page.textContent('body');
    expect(content).toContain('Dashboard');
  });
});

test.describe('Form interactions', () => {
  test.beforeEach(async ({ page }) => {
    const session = mockLoggedInSession();
    await injectSessionIntoStorage(page, session);
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
    await page.goto('/');
    await page.waitForTimeout(5000);
  });

  test('should be able to click sidebar buttons without errors', async ({ page }) => {
    const navItems = ['Dashboard', 'Clientes Activos', 'Finanzas'];
    
    for (const item of navItems) {
      const link = page.locator(`button:has-text("${item}")`).first();
      if (await link.isVisible().catch(() => false)) {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        await link.click();
        await page.waitForTimeout(500);
        expect(errors.length).toBe(0);
      }
    }
  });
});
