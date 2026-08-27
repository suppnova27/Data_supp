import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { createSupabaseMockHandler, mockLoggedInSession, resetMockData, injectSessionIntoStorage, MOCK_DATA } from './helpers/supabase-mock.js';

function leerWorkbook(ruta) {
  const buffer = fs.readFileSync(ruta);
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

// Filtra errores de consola irrelevantes del entorno de desarrollo
function erroresReales(lista) {
  return lista.filter(e => !/DevTools|stream|width\(-1\)/i.test(e));
}

test.describe('FLUJO COMPLETO: registrar -> exportar -> importar (round-trip)', () => {
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

  test('1) registro completo (cliente+personal+servicio+detalle+proyecto) -> export -> import SIN perdida y sin errores', async ({ page }) => {
    const erroresConsola = [];
    page.on('console', m => { if (m.type() === 'error') erroresConsola.push(m.text()); });
    page.on('pageerror', e => erroresConsola.push('PAGEERROR: ' + e.message));

    // --- REGISTRAR MOVIMIENTO COMPLETO ---
    await page.click('button:has-text("Registrar")');
    await page.waitForTimeout(1500);

    await page.locator('select:has(option[value="cta-001"])').first().selectOption('cta-001');       // cuenta (required)
    await page.locator('select:has(option[value="cli-001"])').first().selectOption('cli-001');       // cliente Maria
    await page.locator('select:has(option[value="cta-002"])').first().selectOption('cta-002');       // personal Juan Perez
    await page.locator('select:has(option[value="Limpieza de Oficina"])').first().selectOption('Limpieza de Oficina'); // servicio
    const detalle = page.locator('input[placeholder*="cuerpos"]').first();
    if (await detalle.isVisible()) await detalle.fill('Con productos');                              // detalle generico
    await page.locator('select:has(option[value="pro-001"])').first().selectOption('pro-001');       // proyecto
    await page.locator('input[type="number"]').first().fill('300');
    await page.fill('input[placeholder*="Concepto"]', 'TEST ROUNDTRIP COMPLETO');
    await page.click('button[type="submit"]:has-text("Confirmar")');
    await page.waitForTimeout(2500);

    // UX: el modal debe cerrarse tras guardar
    const modalCerrado = !(await page.locator('text=Confirmar Registro').isVisible().catch(() => false));
    expect(modalCerrado).toBeTruthy();

    // --- EXPORTAR ---
    const dlPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar Excel")');
    const dl = await dlPromise;
    const archivoExportado = await dl.path();
    const filas = leerWorkbook(archivoExportado);

    const fila = filas.find(r => String(r['Detalle / Concepto']).includes('TEST ROUNDTRIP COMPLETO'));
    expect(fila).toBeTruthy();
    expect(fila['Cliente']).toContain('Maria Garcia');
    expect(fila['Personal']).toBe('Juan Perez');
    expect(fila['Servicio Realizado']).toBe('Limpieza de Oficina');
    expect(fila['Detalle Servicio']).toBe('Con productos');
    expect(fila['Proyecto']).toBe('Oficina Maria Garcia');
    expect(fila['Descripción Proyecto']).toBe('Limpieza semanal de oficina');
    expect(fila['Monto (Bs)']).toBe(300);

    // --- IMPORTAR EL MISMO ARCHIVO DE VUELTA ---
    const dialogP = page.waitForEvent('dialog');
    await page.setInputFiles('input[type="file"]', archivoExportado);
    const dialog = await dialogP;
    const msg = dialog.message();
    await dialog.accept();
    expect(msg).toContain('Se importaron');

    // Verificar en el mock: el movimiento importado resolvió TODOS los vínculos
    const coincidencias = MOCK_DATA.finanzas.filter(f => f.concepto === 'TEST ROUNDTRIP COMPLETO');
    expect(coincidencias.length).toBeGreaterThanOrEqual(2); // original + importado
    const importado = coincidencias[coincidencias.length - 1];
    expect(importado.cliente_id).toBe('cli-001');
    expect(importado.personal_id).toBe('cta-002');
    expect(importado.proyecto_id).toBe('pro-001');
    expect(importado.servicio).toContain('Con productos');
    expect(Number(importado.monto)).toBe(300);

    // Sin errores de consola reales
    expect(erroresReales(erroresConsola)).toEqual([]);
  });

  test('2) importar archivo actualiza la DESCRIPCION del proyecto', async ({ page }) => {
    const archivo = path.join(os.tmpdir(), `import-desc-${Date.now()}.xlsx`);
    const filas = [{
      'Fecha de Registro': '01/08/2026',
      'Tipo': 'Ingreso',
      'Detalle / Concepto': 'IMPORT DESCRIPCION PROYECTO',
      'Monto (Bs)': 50,
      'Proyecto': 'Oficina Maria Garcia',
      'Descripción Proyecto': 'Nueva descripcion de prueba',
    }];
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'M');
    XLSX.writeFile(wb, archivo);

    const dialogP = page.waitForEvent('dialog');
    await page.setInputFiles('input[type="file"]', archivo);
    const dialog = await dialogP;
    await dialog.accept();

    const proy = MOCK_DATA.proyectos.find(p => p.id === 'pro-001');
    expect(proy.descripcion).toBe('Nueva descripcion de prueba');
    fs.unlinkSync(archivo);
  });

  test('3) UX validacion: no se envia el formulario si falta la cuenta bancaria', async ({ page }) => {
    let postHecho = false;
    page.on('request', r => {
      if (r.url().includes('/rest/v1/finanzas') && r.method() === 'POST') postHecho = true;
    });

    await page.click('button:has-text("Registrar")');
    await page.waitForTimeout(1500);
    await page.locator('input[type="number"]').first().fill('10');
    await page.fill('input[placeholder*="Concepto"]', 'TEST VALIDACION');
    await page.click('button[type="submit"]:has-text("Confirmar")');
    await page.waitForTimeout(1500);

    expect(postHecho).toBeFalsy(); // validación nativa bloqueó el envío
    expect(await page.locator('text=Confirmar Registro').isVisible().catch(() => false)).toBeTruthy(); // modal sigue abierto
  });

  test('4) filtro por Año incluye movimientos de otros meses en el export', async ({ page }) => {
    // Cambiar filtro a "Por Año" (fin-001/fin-002 son de julio 2026)
    await page.locator('select').filter({ hasText: 'Por Mes' }).selectOption('Año');
    await page.waitForTimeout(500);

    const dlPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar Excel")');
    const dl = await dlPromise;
    const filas = leerWorkbook(await dl.path());

    const conceptos = filas.map(f => String(f['Detalle / Concepto']));
    expect(conceptos).toContain('Pago cliente Maria');   // fin-001 (julio)
    expect(conceptos).toContain('Compra de productos de limpieza'); // fin-002 (julio)
  });
});