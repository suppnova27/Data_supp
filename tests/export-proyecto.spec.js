import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { createSupabaseMockHandler, mockLoggedInSession, resetMockData, injectSessionIntoStorage, MOCK_DATA } from './helpers/supabase-mock.js';

// Lee un archivo xlsx descargado y devuelve las filas como objetos
function leerWorkbook(ruta) {
  const buffer = fs.readFileSync(ruta);
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

test.describe('Export Excel: vinculacion de Proyecto y columnas nuevas', () => {
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

  test('registra movimiento con proyecto y lo ve en el Excel exportado', async ({ page }) => {
    // 1. Abrir formulario de movimiento
    const registerBtn = page.locator('button:has-text("Registrar")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1500);
    }

    // 2. Llenar monto y concepto
    const montoInput = page.locator('input[type="number"]').first();
    if (await montoInput.isVisible()) {
      await montoInput.fill('250');
    }
    await page.fill('input[placeholder*="Concepto"]', 'TEST PROYECTO E2E');

    // 3. Seleccionar CUENTA BANCARIA (campo required)
    const cuentaSelect = page.locator('select:has(option[value="cta-001"])').first();
    if (await cuentaSelect.isVisible()) {
      await cuentaSelect.selectOption('cta-001');
    }

    // 4. Seleccionar Cliente (Maria Garcia)
    const clienteSelect = page.locator('select:has(option[value="cli-001"])').first();
    if (await clienteSelect.isVisible()) {
      await clienteSelect.selectOption('cli-001');
    }

    // 5. Seleccionar Servicio
    const servicioSelect = page.locator('select:has(option[value="Limpieza de Oficina"])').first();
    if (await servicioSelect.isVisible()) {
      await servicioSelect.selectOption('Limpieza de Oficina');
    }

    // 6. Seleccionar PROYECTO (Oficina Maria Garcia -> pro-001)
    const proyectoSelect = page.locator('select:has(option[value="pro-001"])').first();
    if (await proyectoSelect.isVisible()) {
      await proyectoSelect.selectOption('pro-001');
    }

    // 7. Guardar
    await page.click('button[type="submit"]:has-text("Confirmar")');
    await page.waitForTimeout(2500);

    // 7. La tabla debe mostrar el movimiento y el chip del proyecto
    const body = await page.textContent('body');
    expect(body).toContain('TEST PROYECTO E2E');
    expect(body).toContain('Oficina Maria Garcia');

    // 8. Exportar Excel y verificar contenido
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar Excel")');
    const download = await downloadPromise;
    const filePath = await download.path();

    const rows = leerWorkbook(filePath);

    // Columnas esperadas presentes
    const headers = Object.keys(rows[0] || {});
    for (const col of ['Etiqueta(s)', 'Servicio Realizado', 'Detalle Servicio', 'Personal', 'Proyecto', 'Descripción Proyecto', 'Cliente']) {
      expect(headers).toContain(col);
    }

    // La fila del movimiento tiene el PROYECTO vinculado
    const fila = rows.find(r => String(r['Detalle / Concepto']).includes('TEST PROYECTO E2E'));
    expect(fila).toBeTruthy();
    expect(fila['Proyecto']).toBe('Oficina Maria Garcia');
    expect(fila['Descripción Proyecto']).toBe('Limpieza semanal de oficina');
    expect(fila['Cliente']).toContain('Maria Garcia');
    expect(fila['Servicio Realizado']).toBe('Limpieza de Oficina');
    expect(fila['Detalle Servicio']).toBe('-');
  });

  test('pago de personal con cliente vinculado muestra el cliente en el Excel', async ({ page }) => {
    // El cliente NO debe ocultarse solo porque sea un pago de personal/nómina
    const registerBtn = page.locator('button:has-text("Registrar")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.locator('input[type="number"]').first().fill('180');
    await page.fill('input[placeholder*="Concepto"]', 'TEST PERSONAL CLIENTE');

    // Cuenta bancaria (required)
    await page.locator('select:has(option[value="cta-001"])').first().selectOption('cta-001');
    // Cliente (Maria Garcia)
    await page.locator('select:has(option[value="cli-001"])').first().selectOption('cli-001');
    // Personal (Juan Perez -> cta-002). Al ser Gasto, se marca categoria Nómina y Salarios
    await page.locator('select:has(option[value="cta-002"])').first().selectOption('cta-002');
    // Proyecto
    await page.locator('select:has(option[value="pro-001"])').first().selectOption('pro-001');

    await page.click('button[type="submit"]:has-text("Confirmar")');
    await page.waitForTimeout(2500);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar Excel")');
    const download = await downloadPromise;
    const filePath = await download.path();

    const rows = leerWorkbook(filePath);
    const fila = rows.find(r => String(r['Detalle / Concepto']).includes('TEST PERSONAL CLIENTE'));
    expect(fila).toBeTruthy();
    expect(fila['Cliente']).toContain('Maria Garcia');
    expect(fila['Personal']).toBe('Juan Perez');
    expect(fila['Proyecto']).toBe('Oficina Maria Garcia');
  });

  test('crear movimiento SIN proyecto deja columna Proyecto vacia (comportamiento esperado)', async ({ page }) => {
    // Caso opuesto: sin vincular proyecto, la columna debe salir vacía
    const registerBtn = page.locator('button:has-text("Registrar")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1500);
    }

    const montoInput = page.locator('input[type="number"]').first();
    if (await montoInput.isVisible()) {
      await montoInput.fill('99');
    }
    await page.fill('input[placeholder*="Concepto"]', 'TEST SIN PROYECTO');

    // Seleccionar CUENTA BANCARIA (campo required)
    const cuentaSelect = page.locator('select:has(option[value="cta-001"])').first();
    if (await cuentaSelect.isVisible()) {
      await cuentaSelect.selectOption('cta-001');
    }

    await page.click('button[type="submit"]:has-text("Confirmar")');
    await page.waitForTimeout(2500);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar Excel")');
    const download = await downloadPromise;
    const filePath = await download.path();

    const rows = leerWorkbook(filePath);

    const fila = rows.find(r => String(r['Detalle / Concepto']).includes('TEST SIN PROYECTO'));
    expect(fila).toBeTruthy();
    expect(String(fila['Proyecto'] || '')).toBe('-');
  });
});

test.describe('Formulario: filtrar por etiqueta conserva el servicio', () => {
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

  test('seleccionar una etiqueta NO borra el servicio ya elegido', async ({ page }) => {
    const registerBtn = page.locator('button:has-text("Registrar")').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1500);
    }

    // 1. Seleccionar servicio "Limpieza de Oficina" (etq Limpieza)
    const servicioSelect = page.locator('select:has(option[value="Limpieza de Oficina"])').first();
    if (await servicioSelect.isVisible()) {
      await servicioSelect.selectOption('Limpieza de Oficina');
    }
    expect(await servicioSelect.inputValue()).toBe('Limpieza de Oficina');

    // 2. Filtrar por etiqueta "Mantenimiento" (etq-002) -> el servicio NO debe borrarse
    const etiquetaSelect = page.locator('select:has(option[value="etq-002"])').first();
    if (await etiquetaSelect.isVisible()) {
      await etiquetaSelect.selectOption('etq-002');
      await page.waitForTimeout(800);
    }

    expect(await servicioSelect.inputValue()).toBe('Limpieza de Oficina');

    // 3. Volver a "Todas las etiquetas" -> servicio sigue conservado
    await etiquetaSelect.selectOption('');
    await page.waitForTimeout(800);
    expect(await servicioSelect.inputValue()).toBe('Limpieza de Oficina');
  });
});

test.describe('Import Excel: columna Etiqueta(s) y re-clasificacion', () => {
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

  test('importa un archivo con Etiqueta(s) nueva y re-clasifica el servicio', async ({ page }) => {
    // 1. Crear archivo Excel con la columna Etiqueta(s)
    const archivo = path.join(os.tmpdir(), `import-etiqueta-${Date.now()}.xlsx`);
    const filas = [{
      'Fecha de Registro': '01/08/2026',
      'Tipo': 'Ingreso',
      'Detalle / Concepto': 'IMPORT ETIQUETA TEST',
      'Monto (Bs)': 100,
      'Cliente': 'Maria Garcia',
      'Servicio Realizado': 'Limpieza de Oficina',
      'Etiqueta(s)': 'Nueva Etiqueta X',
      'Proyecto': '',
    }];
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, archivo);

    // 2. Importar desde la UI
    const dialogPromise = page.waitForEvent('dialog');
    await page.setInputFiles('input[type="file"]', archivo);
    const dialog = await dialogPromise;
    const mensaje = dialog.message();
    await dialog.accept();

    // 3. Verificar mensajes de éxito + re-clasificación
    expect(mensaje).toContain('Se importaron 1 registros');
    expect(mensaje).toContain('re-clasificado');

    // 4. Verificar en el "mock" que la etiqueta se creó y el servicio cambió
    const etiquetaNueva = MOCK_DATA.etiquetas.find(e => e.nombre === 'Nueva Etiqueta X');
    expect(etiquetaNueva).toBeTruthy();
    const servicio = MOCK_DATA.servicios.find(s => s.nombre === 'Limpieza de Oficina');
    expect(servicio).toBeTruthy();
    expect(servicio.etiqueta_id).toBe(etiquetaNueva.id);

    fs.unlinkSync(archivo);
  });
});