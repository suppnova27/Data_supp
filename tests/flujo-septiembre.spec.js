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

function erroresReales(lista) {
  return lista.filter(e => !/DevTools|stream|width\(-1\)/i.test(e));
}

// Carga datos de prueba de SEPTIEMBRE 2026 en el mock, después del reset.
function cargarDatosSeptiembre() {
  MOCK_DATA.finanzas.push(
    // A) servicio y etiqueta directos -> viajan directo
    {
      id: 'fin-sep-001', fecha_registro: '2026-09-05', tipo: 'Ingreso', categoria: 'Servicios',
      concepto: 'SERVICIO MENSUAL OFICINA', monto: 2000, cliente_id: 'cli-001',
      servicio: 'Limpieza de Oficina', etiqueta_id: 'etq-001',
      banco: 'BCA', numero_cuenta: '1234567', titular: 'ORE', id_operacion: '', cuenta_id: 'cta-001', personal_id: null, proyecto_id: 'pro-001',
    },
    // B) SIN servicio ni etiqueta -> se deriva del CLIENTE (bug reportado: etiqueta Corporativo)
    {
      id: 'fin-sep-002', fecha_registro: '2026-09-12', tipo: 'Ingreso', categoria: 'Servicios',
      concepto: 'SERVICIO MES DE AGOSTO', monto: 1200, cliente_id: 'cli-001',
      servicio: '', etiqueta_id: null,
      banco: 'Efectivo', numero_cuenta: '', titular: '', id_operacion: '', cuenta_id: '', personal_id: null, proyecto_id: null,
    },
    // C) servicio sin etiqueta -> deriva del CATALOGO (srv-002 -> etiqueta Limpieza)
    {
      id: 'fin-sep-003', fecha_registro: '2026-09-14', tipo: 'Gasto', categoria: 'Insumos',
      concepto: 'COMPRA INSUMOS VIERNES', monto: 400, cliente_id: 'cli-002',
      servicio: 'Limpieza Residencial', etiqueta_id: null,
      banco: 'BCA', numero_cuenta: '1234567', titular: 'ORE', id_operacion: 'T-900', cuenta_id: 'cta-001', personal_id: null, proyecto_id: null,
    },
    // D) SIN cliente (no derivable) -> queda vacio
    {
      id: 'fin-sep-004', fecha_registro: '2026-09-01', tipo: 'Ingreso', categoria: 'Servicios',
      concepto: 'SALDO INICIAL SEPTIEMBRE', monto: 3000, cliente_id: null,
      servicio: '', etiqueta_id: null,
      banco: 'BCA', numero_cuenta: '1234567', titular: 'ORE', id_operacion: '', cuenta_id: 'cta-001', personal_id: null, proyecto_id: null,
    },
    // E) GASTO de Nómina con servicio vacío pero cliente con trabajo -> deriva del cliente
    {
      id: 'fin-sep-005', fecha_registro: '2026-09-20', tipo: 'Gasto', categoria: 'Nómina y Salarios',
      concepto: 'SUELDO PERSONAL', monto: 800, cliente_id: 'cli-001',
      servicio: '', etiqueta_id: null,
      banco: 'BIB', numero_cuenta: '9876543', titular: 'Juan Perez', id_operacion: '', cuenta_id: '', personal_id: 'cta-002', proyecto_id: null,
    },
  );
}

test.describe('FLUJO SEPTIEMBRE: datos de prueba -> export Excel con lógica verificada', () => {
  test.beforeEach(async ({ page }) => {
    const session = mockLoggedInSession();
    await injectSessionIntoStorage(page, session);
    resetMockData();
    cargarDatosSeptiembre(); // inyectar septiembre DESPUÉS del reset
    await page.route('**/*.supabase.co/**', createSupabaseMockHandler());
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.click('text=Finanzas');
    await page.waitForTimeout(2000);
  });

  test('exporta septiembre y verifica servicio/etiqueta derivados (directo, cliente, catalogo, vacio)', async ({ page }) => {
    const erroresConsola = [];
    page.on('console', m => { if (m.type() === 'error') erroresConsola.push(m.text()); });
    page.on('pageerror', e => erroresConsola.push('PAGEERROR: ' + e.message));

    // Establecer filtro a Mes Septiembre 2026 (valores de option)
    await page.locator('select:has(option[value="9"])').first().selectOption('9');        // mes = Septiembre
    await page.locator('select:has(option[value="2024"])').first().selectOption('2026');  // año
    await page.waitForTimeout(1000);

    // Exportar
    const dlPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar Excel")');
    const dl = await dlPromise;
    const filas = leerWorkbook(await dl.path());

    // El filtro es "Por Mes" por defecto; el export del mes usa fecha con formato D/M/YYYY
    const buscar = (txt) => filas.find(r => String(r['Detalle / Concepto']).includes(txt));
    // Septiembre 2026 => fecha "…/9/2026"
    const sep = filas.filter(r => /(^|\/)9\/2026$/.test(String(r['Fecha de Registro']).trim()));

    // Los 5 registros de septiembre deben estar en el export
    expect(sep.length).toBe(5);
    expect(sep.some(r => String(r['Detalle / Concepto']).includes('SERVICIO MENSUAL OFICINA'))).toBeTruthy();
    expect(sep.some(r => String(r['Detalle / Concepto']).includes('SERVICIO MES DE AGOSTO'))).toBeTruthy();
    expect(sep.some(r => String(r['Detalle / Concepto']).includes('COMPRA INSUMOS'))).toBeTruthy();
    expect(sep.some(r => String(r['Detalle / Concepto']).includes('SALDO INICIAL SEPTIEMBRE'))).toBeTruthy();
    expect(sep.some(r => String(r['Detalle / Concepto']).includes('SUELDO PERSONAL'))).toBeTruthy();

    // A) servicio y etiqueta directos viajan tal cual
    const a = buscar('SERVICIO MENSUAL OFICINA');
    expect(a['Servicio Realizado']).toBe('Limpieza de Oficina');
    expect(a['Etiqueta(s)']).toBe('Limpieza');
    expect(a['Cliente']).toContain('Maria Garcia');
    expect(a['Monto (Bs)']).toBe(2000);

    // B) movimiento SIN servicio/etiqueta -> SE DEDUCE DEL CLIENTE (bug reportado)
    const b = buscar('SERVICIO MES DE AGOSTO');
    expect(b['Servicio Realizado']).toBe('Limpieza de Oficina'); // de clientes.trabajo_realizado
    expect(b['Etiqueta(s)']).toBe('Corporativo'); // de clientes.etiqueta
    expect(b['Monto (Bs)']).toBe(1200);

    // C) sin etiqueta + servicio en catálogo -> deducida del CATALOGO
    const c = buscar('COMPRA INSUMOS');
    expect(c['Servicio Realizado']).toBe('Limpieza Residencial');
    expect(c['Etiqueta(s)']).toBe('Limpieza'); // srv-002 -> etiqueta Limpieza (catálogo)
    expect(c['Tipo']).toBe('Gasto');
    expect(c['Monto (Bs)']).toBe(400);

    // D) sin cliente -> vacio (no derivable)
    const d = buscar('SALDO INICIAL SEPTIEMBRE');
    expect(d['Servicio Realizado']).toBe('-');
    expect(d['Etiqueta(s)']).toBe('-');
    expect(d['Cliente']).toBe('-');
    expect(d['Monto (Bs)']).toBe(3000);

    // E) gasto nómina servicio vacío -> deriva del cliente
    const e = buscar('SUELDO PERSONAL');
    expect(e['Servicio Realizado']).toBe('Limpieza de Oficina'); // de clientes.trabajo_realizado
    expect(e['Etiqueta(s)']).toBe('Corporativo'); // de clientes.etiqueta
    expect(e['Tipo']).toBe('Gasto');
    expect(e['Personal']).toBe('Juan Perez');
    expect(e['Monto (Bs)']).toBe(800);

    // LÓGICA DE TOTALES: ingresos vs gastos del mes
    const totalIngresos = sep.filter(r => r['Tipo'] === 'Ingreso').reduce((s, r) => s + Number(r['Monto (Bs)']), 0);
    const totalGastos = sep.filter(r => r['Tipo'] === 'Gasto').reduce((s, r) => s + Number(r['Monto (Bs)']), 0);
    expect(totalIngresos).toBe(6200); // 2000 + 1200 + 3000
    expect(totalGastos).toBe(1200);   // 400 + 800
    expect(totalIngresos - totalGastos).toBe(5000); // balance del mes

    // Sin errores de consola reales
    expect(erroresReales(erroresConsola)).toEqual([]);
  });
});
