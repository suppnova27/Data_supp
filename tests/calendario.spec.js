import { test, expect } from '@playwright/test';
import { createSupabaseMockHandler, mockLoggedInSession, resetMockData, injectSessionIntoStorage } from './helpers/supabase-mock.js';

test.describe('Calendario Module', () => {
  test.beforeEach(async ({ page }) => {
    const session = mockLoggedInSession();
    await injectSessionIntoStorage(page, session);
    resetMockData();
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.click('text=Calendario');
    await page.waitForTimeout(2000);
  });

  test('should display the calendar page', async ({ page }) => {
    await expect(page.locator('button:has-text("Nuevo Evento")').first()).toBeVisible();
    await expect(page.locator('text=Lun').first()).toBeVisible();
    await expect(page.locator('text=Dom').first()).toBeVisible();
  });

  test('should show seeded events in the month grid', async ({ page }) => {
    await expect(page.locator('text=Visita cotización Maria').first()).toBeVisible();
    await expect(page.locator('text=Limpieza oficina Carlos').first()).toBeVisible();
  });

  test('should open the new event modal', async ({ page }) => {
    await page.click('button:has-text("Nuevo Evento")');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Registrar Evento').first()).toBeVisible();
  });

  test('should create a new event linked to a client', async ({ page }) => {
    await page.click('button:has-text("Nuevo Evento")');
    await page.waitForTimeout(1000);

    await page.locator('input[placeholder*="Título del evento"]').fill('TEST Evento de Playwright');

    const selects = page.locator('select');
    await selects.nth(1).selectOption('cli-001');
    await selects.nth(3).selectOption('etq-001');
    await selects.nth(4).selectOption('srv-001');

    await page.locator('button[type="submit"]:has-text("Confirmar Evento")').click();
    await page.waitForTimeout(2000);

    await expect(page.locator('text=TEST Evento de Playwright').first()).toBeVisible();
  });

  test('should edit an existing event', async ({ page }) => {
    await page.locator('button:has-text("Visita cotización Maria")').first().click();
    await page.waitForTimeout(500);

    await page.locator('button:has-text("Editar")').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Editar Evento').first()).toBeVisible();

    await page.locator('input[placeholder*="Título del evento"]').fill('TEST Evento Editado');
    await page.locator('button[type="submit"]:has-text("Actualizar Evento")').click();
    await page.waitForTimeout(2000);

    await expect(page.locator('text=TEST Evento Editado').first()).toBeVisible();
  });

  test('should delete an event', async ({ page }) => {
    await page.locator('button:has-text("Visita cotización Maria")').first().click();
    await page.waitForTimeout(500);

    page.on('dialog', dialog => dialog.accept());

    await page.locator('button:has-text("🗑️")').first().click();
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Visita cotización Maria')).toHaveCount(0);
  });
});
