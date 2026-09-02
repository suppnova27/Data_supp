// Mock data that simulates the Supabase database
const hoy = new Date();
const fechaISO = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
const diaFijo = (dia, anio = hoy.getFullYear(), mes = hoy.getMonth()) => {
  return fechaISO(new Date(anio, mes, dia));
};

// Datos base en una fábrica: cada reset genera objetos NUEVOS para que los
// tests no se contaminen entre sí (mismo proceso/worker comparte el módulo).
function defaultMockData() {
  return {
    perfiles: [
      { id: 'test-user-001', email: 'novasolum.info@gmail.com', rol: 'SA', nombre_completo: 'Test User' }
    ],
    clientes: [
      { id: 'cli-001', nombres: 'Maria Garcia', telefono: '79123456', email: 'maria@test.com', origen: 'Facebook', tipo_registro: 'Lead', trabajo_realizado: 'Limpieza de Oficina', etiqueta: 'Corporativo' },
      { id: 'cli-002', nombres: 'Carlos Lopez', telefono: '79654321', email: 'carlos@test.com', origen: '', tipo_registro: 'Cliente', trabajo_realizado: 'Limpieza Residencial', etiqueta: 'General' },
      { id: 'cli-003', nombres: 'Ana Martinez', telefono: '79111222', email: 'ana@test.com', origen: 'TikTok', tipo_registro: 'Lead', trabajo_realizado: 'Limpieza Residencial', etiqueta: 'General' },
    ],
    servicios: [
      { id: 'srv-001', nombre: 'Limpieza de Oficina', etiqueta_id: 'etq-001', activa: true },
      { id: 'srv-002', nombre: 'Limpieza Residencial', etiqueta_id: 'etq-001', activa: true },
      { id: 'srv-003', nombre: 'Mantenimiento Industrial', etiqueta_id: 'etq-002', activa: true },
      { id: 'srv-004', nombre: 'Limpieza de Alfombras', etiqueta_id: 'etq-001', activa: true },
    ],
    etiquetas: [
      { id: 'etq-001', nombre: 'Limpieza', color: '#3b82f6', activa: true },
      { id: 'etq-002', nombre: 'Mantenimiento', color: '#10b981', activa: true },
    ],
    finanzas: [
      { id: 'fin-001', fecha_registro: '2026-07-20', tipo: 'Ingreso', categoria: 'Servicios', concepto: 'Pago cliente Maria', monto: 1500, cliente_id: 'cli-001', servicio: 'Limpieza de Oficina', banco: 'Efectivo', numero_cuenta: '', titular: '', id_operacion: '', cuenta_id: '', personal_id: null, proyecto_id: 'pro-001', etiqueta_id: 'etq-001' },
      { id: 'fin-002', fecha_registro: '2026-07-22', tipo: 'Gasto', categoria: 'Insumos', concepto: 'Compra de productos de limpieza', monto: 350, cliente_id: null, servicio: '', banco: 'BCA', numero_cuenta: '1234567', titular: 'ORE', id_operacion: 'TX-001', cuenta_id: 'cta-001', personal_id: null, proyecto_id: null, etiqueta_id: null },
    ],
    finanza_servicios: [],
    directorio_cuentas: [
      { id: 'cta-001', alias: 'Cuenta Principal', banco: 'BCA', numero_cuenta: '1234567', titular: 'ORE', tipo: 'Propia' },
      { id: 'cta-002', alias: 'Cuenta Personal', banco: 'BIB', numero_cuenta: '9876543', titular: 'Juan Perez', tipo: 'Personal' },
    ],
    inventario: [
      { id: 'inv-001', nombre: 'Detergente Industrial', cantidad: 50, unidad_medida: 'litros' },
      { id: 'inv-002', nombre: 'Cloro', cantidad: 30, unidad_medida: 'litros' },
    ],
    proyectos: [
      { id: 'pro-001', nombre: 'Oficina Maria Garcia', cliente_id: 'cli-001', descripcion: 'Limpieza semanal de oficina', activa: true },
      { id: 'pro-002', nombre: 'Limpieza Anual Carlos', cliente_id: 'cli-002', descripcion: 'Limpieza profunda anual', activa: true },
    ],
    calendario: [
      { id: 'cal-001', fecha: fechaISO(hoy), hora: '09:00:00', tipo: 'Visita', titulo: 'Visita cotización Maria', cliente_id: 'cli-001', servicio_id: 'srv-001', etiqueta_id: 'etq-001', estado: 'Pendiente', notas: 'Confirmar medidas del local', usuario_id: 'test-user-001' },
      { id: 'cal-002', fecha: diaFijo(15), hora: '14:30:00', tipo: 'Proyecto', titulo: 'Limpieza oficina Carlos', cliente_id: 'cli-002', servicio_id: 'srv-002', etiqueta_id: 'etq-002', estado: 'En curso', notas: '', usuario_id: 'test-user-001' },
      { id: 'cal-003', fecha: diaFijo(1), hora: '10:00:00', tipo: 'Cita', titulo: 'Llamada seguimiento Ana', cliente_id: 'cli-003', servicio_id: null, etiqueta_id: 'etq-001', estado: 'Completado', notas: 'Cliente interesado en contrato mensual', usuario_id: 'test-user-001' },
    ],
  };
}

export const MOCK_DATA = defaultMockData();

// Mock auth state
let mockSession = null;

export function setMockSession(session) {
  mockSession = session;
}

export function getMockSession() {
  return mockSession;
}

// Parse Supabase REST API URL to extract table and filters
function parseSupabaseUrl(url) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  
  // /rest/v1/{table} or /auth/v1/{endpoint}
  let table = null;
  let endpoint = null;
  
  if (pathParts[0] === 'rest' && pathParts[1] === 'v1') {
    table = pathParts[2];
  } else if (pathParts[0] === 'auth' && pathParts[1] === 'v1') {
    endpoint = pathParts.slice(1).join('/');
  }
  
  // Parse filters from query params
  const filters = {};
  for (const [key, value] of urlObj.searchParams.entries()) {
    filters[key] = value;
  }

  return { table, endpoint, filters, fullUrl: url };
}

// Apply simple filters to mock data (handles PostgREST URL format: id=eq.value)
function applyFilters(data, filters, url) {
  let result = [...data];
  const urlObj = new URL(url);
  
  for (const [key, value] of urlObj.searchParams.entries()) {
    if (value && value.startsWith('eq.')) {
      const column = key;
      const val = value.substring(3);
      result = result.filter(row => String(row[column]) === String(val));
    }
    if (value && value.startsWith('neq.')) {
      const column = key;
      const val = value.substring(4);
      result = result.filter(row => String(row[column]) !== String(val));
    }
    if (value && value.startsWith('gte.')) {
      const column = key;
      const val = value.substring(4);
      result = result.filter(row => String(row[column]) >= String(val));
    }
    if (value && value.startsWith('lte.')) {
      const column = key;
      const val = value.substring(4);
      result = result.filter(row => String(row[column]) <= String(val));
    }
  }
  
  return result;
}

// Mock Supabase responses
const MOCK_RESPONSES = {
  // Auth endpoints
  'auth/v1/session': () => ({
    data: { session: mockSession },
    error: null,
  }),
  'auth/v1/user': () => ({
    data: { user: mockSession?.user || null },
    error: null,
  }),
};

// Main mock handler
export function createSupabaseMockHandler() {
  return async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    
    // Only intercept Supabase API calls
    if (!url.includes('supabase.co')) {
      await route.continue();
      return;
    }
    
    const { table, endpoint, filters } = parseSupabaseUrl(url);
    
    // Handle ALL auth endpoints - return session for any auth request
    if (url.includes('/auth/v1/')) {
      // For any auth request (token, session, user, etc.), return mock session
      if (method === 'GET' || method === 'POST') {
        // Check if it's a signout
        if (url.includes('logout') || url.includes('signout')) {
          setMockSession(null);
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: {}, error: null }),
          });
        }
        
        // For session/token/user requests, return mock session
        if (mockSession) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              access_token: mockSession.access_token,
              token_type: 'bearer',
              expires_in: mockSession.expires_in,
              expires_at: mockSession.expires_at,
              refresh_token: mockSession.refresh_token,
              user: mockSession.user,
            }),
          });
        } else {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { session: null, user: null } }),
          });
        }
      }
    }
    
    // Handle table queries
    if (table && MOCK_DATA[table]) {
      let data = applyFilters(MOCK_DATA[table], filters, url);

      // Resolver embeds básicos (clientes/proyectos/etiquetas) para reflejar el comportamiento real
      if (table === 'finanzas') {
        data = data.map(row => ({
          ...row,
          clientes: row.cliente_id ? (MOCK_DATA.clientes.find(c => c.id === row.cliente_id) || null) : null,
          proyectos: row.proyecto_id ? (MOCK_DATA.proyectos.find(p => p.id === row.proyecto_id) || null) : null,
          etiqueta_info: row.etiqueta_id ? (MOCK_DATA.etiquetas.find(e => e.id === row.etiqueta_id) || null) : null,
        }));
      } else if (table === 'proyectos') {
        data = data.map(row => ({
          ...row,
          clientes: row.cliente_id ? (MOCK_DATA.clientes.find(c => c.id === row.cliente_id) || null) : null,
        }));
      }
      
      // Handle insert
      if (method === 'POST') {
        try {
          const body = JSON.parse(route.request().postData() || '[]');
          const records = Array.isArray(body) ? body : [body];
          const newRecords = records.map((r, i) => ({
            id: `mock-${Date.now()}-${i}`,
            ...r,
            created_at: new Date().toISOString(),
          }));
          // Add to mock data (in-memory)
          MOCK_DATA[table].push(...newRecords);
          
          // Check if .select() is in the URL
          if (url.includes('select=')) {
            return route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify(newRecords.length === 1 ? newRecords[0] : newRecords),
            });
          }
          return route.fulfill({
            status: 204,
            contentType: 'application/json',
            body: JSON.stringify({ data: null, error: null }),
          });
        } catch (e) {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Invalid request body' }),
          });
        }
      }
      
      // Handle update
      if (method === 'PATCH') {
        try {
          const body = JSON.parse(route.request().postData() || '{}');
          const idFilter = url.match(/id=eq\.([^&]+)/)?.[1];
          if (idFilter) {
            const idx = MOCK_DATA[table].findIndex(r => r.id === idFilter);
            if (idx !== -1) {
              MOCK_DATA[table][idx] = { ...MOCK_DATA[table][idx], ...body };
            }
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
          });
        } catch (e) {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Invalid request' }),
          });
        }
      }
      
      // Handle delete
      if (method === 'DELETE') {
        const idFilter = url.match(/id=eq\.([^&]+)/)?.[1];
        if (idFilter) {
          MOCK_DATA[table] = MOCK_DATA[table].filter(r => r.id !== idFilter);
        }
        return route.fulfill({
          status: 204,
          contentType: 'application/json',
          body: '',
        });
      }
      
      // Handle select (GET) - return raw array (Supabase PostgREST expects raw response)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-profile': 'public',
          'x-total-count': String(data.length),
        },
      });
    }
    
    // Default: continue with real request (shouldn't happen in tests)
    await route.continue();
  };
}

// Helper to mock auth session for logged-in state
export function mockLoggedInSession() {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: 'mock-token-' + Date.now(),
    refresh_token: 'mock-refresh-' + Date.now(),
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user: {
      id: 'test-user-001',
      email: 'novasolum.info@gmail.com',
      app_metadata: {},
      user_metadata: { full_name: 'Test User' },
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
  setMockSession(session);
  return session;
}

// Helper to inject session into localStorage before page load
export async function injectSessionIntoStorage(page, session) {
  // We use page.evaluate after navigation but intercept auth calls instead
  // The key insight: Supabase GoTrue checks localStorage FIRST, then calls API
  // We need both: valid localStorage AND mock API responses
  
  const projectRef = 'oohalynqrikeqccnvroa';
  const storageKey = `sb-${projectRef}-auth-token`;
  
  // Supabase GoTrue v2 stores session directly as JSON string
  await page.addInitScript(({ key, sess }) => {
    // Set the session in the format Supabase GoTrue expects
    localStorage.setItem(key, JSON.stringify(sess));
  }, { key: storageKey, sess: session });
}

// Helper to reset all mock data to defaults (REEMPLAZA todas las tablas,
// incluidas servicios/etiquetas/clientes que otros tests pueden mutar)
export function resetMockData() {
  const fresh = defaultMockData();
  for (const key of Object.keys(fresh)) {
    MOCK_DATA[key] = fresh[key];
  }
}
