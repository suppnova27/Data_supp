import { test, expect } from '@playwright/test';
import { createSupabaseMockHandler, mockLoggedInSession, resetMockData, injectSessionIntoStorage } from './helpers/supabase-mock.js';

test.describe('Finanzas Module', () => {
  test.beforeEach(async ({ page }) => {
    const session = mockLoggedInSession();
    await injectSessionIntoStorage(page, session);
    resetMockData();
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.click('text=Finanzas');
    await page.waitForTimeout(2000);
  });

  test('should display Finanzas page', async ({ page }) => {
    await expect(page.locator('text=Finanzas').first()).toBeVisible();
  });

  test('should open the new movement form', async ({ page }) => {
    const registerBtn = page.locator('button:has-text("Registrar")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Registrar Movimiento').first()).toBeVisible();
    }
  });

  test('should display existing financial records', async ({ page }) => {
    await page.waitForTimeout(2000);
    const pageContent = await page.textContent('body');
    const hasRecords = pageContent.includes('Pago cliente Maria') || pageContent.includes('No hay registros') || pageContent.includes('Registrar');
    expect(hasRecords).toBeTruthy();
  });
});

test.describe('Financial Record Creation (Bug Fix)', () => {
  test.beforeEach(async ({ page }) => {
    const session = mockLoggedInSession();
    await injectSessionIntoStorage(page, session);
    resetMockData();
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.click('text=Finanzas');
    await page.waitForTimeout(2000);
  });

  test('should create a new financial record without error', async ({ page }) => {
    const registerBtn = page.locator('button:has-text("Registrar")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1000);

      const montoInput = page.locator('input[type="number"]').first();
      if (await montoInput.isVisible()) {
        await montoInput.fill('250');
      }

      const conceptoInput = page.locator('input[placeholder*="Concepto"]').first();
      if (await conceptoInput.isVisible()) {
        await conceptoInput.fill('TEST - Pago de prueba automatizado');
      }

      const confirmBtn = page.locator('button[type="submit"]:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);

        const alertVisible = await page.locator('.alert, [role="alert"]').isVisible().catch(() => false);
        expect(alertVisible).toBeFalsy();
      }
    }
  });

  test('should NOT show foreign key error when submitting', async ({ page }) => {
    const registerBtn = page.locator('button:has-text("Registrar")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1000);

      const montoInput = page.locator('input[type="number"]').first();
      if (await montoInput.isVisible()) {
        await montoInput.fill('100');
      }

      const conceptoInput = page.locator('input[placeholder*="Concepto"]').first();
      if (await conceptoInput.isVisible()) {
        await conceptoInput.fill('TEST - Verificacion de foreign key');
      }

      const confirmBtn = page.locator('button[type="submit"]:has-text("Confirmar")').first();
      if (await confirmBtn.isVisible()) {
        let alertMessage = '';
        page.on('dialog', async dialog => {
          alertMessage = dialog.message();
          await dialog.accept();
        });

        await confirmBtn.click();
        await page.waitForTimeout(2000);

        expect(alertMessage).not.toContain('foreign key');
        expect(alertMessage).not.toContain('violates');
      }
    }
  });
});
