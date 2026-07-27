import { test, expect } from '@playwright/test';
import { createSupabaseMockHandler, mockLoggedInSession, setMockSession, injectSessionIntoStorage } from './helpers/supabase-mock.js';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    setMockSession(null);
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
  });

  test('should display login page with ORE branding', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toContainText('ORE');
    await expect(page.locator('text=Management System')).toBeVisible();
  });

  test('should display Google login button', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Continuar con Google')).toBeVisible();
  });

  test('should display restricted access message', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Acceso Restringido')).toBeVisible();
  });
});

test.describe('Authenticated State', () => {
  test.beforeEach(async ({ page }) => {
    const session = mockLoggedInSession();
    await injectSessionIntoStorage(page, session);
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
  });

  test('should show dashboard after login', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Dashboard');
    expect(bodyText).toContain('Cerrar Sesión');
  });

  test('should display sidebar navigation items', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Dashboard');
    expect(bodyText).toContain('Clientes Activos');
    expect(bodyText).toContain('Finanzas');
  });
});
