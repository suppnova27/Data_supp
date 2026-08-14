import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

// Importación de Páginas de Autenticación
import LoginPage from './modules/auth/LoginPage';
import RolesPage from './modules/auth/RolesPage';
import CuentaSuspendidaPage from './modules/auth/CuentaSuspendidaPage';

// Importación del Layout y Módulos del CRM
import MainLayout from './components/layout/MainLayout';
import DashboardPage from './modules/dashboard/components/DashboardPage';
import ClientesPage from './modules/clientes/components/ClientesPage';
import ClientesCerradosPage from './modules/clientes/components/ClientesCerradosPage';
import FinanzasPage from './modules/finanzas/components/FinanzasPage';
import CalendarioPage from './modules/calendario/components/CalendarioPage';
import EtiquetasPage from './modules/etiquetas/components/EtiquetasPage';
import ProyectosPage from './modules/proyectos/components/ProyectosPage';
import CuentasPage from './modules/configuracion/components/CuentasPage';
import InventarioPage from './modules/inventario/components/InventarioPage';

function App() {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('Inicio');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // 1. Escuchar sesión actual al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      if (session) cargarPerfil(session.user.id, session.user.email);
      else setCargando(false);
    });

    // 2. Escuchar cambios (cuando el usuario inicia o cierra sesión)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
      if (session) cargarPerfil(session.user.id, session.user.email);
      else { setPerfil(null); setCargando(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // SOLUCIÓN: Pasamos el email directo de Google como plan B
  const cargarPerfil = async (userId, userEmail) => {
    // maybeSingle() evita que Supabase lance el error 406 si el perfil no existe
    const { data } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle();

    if (data) {
      setPerfil(data);
    } else {
      // Si eres un usuario antiguo y el Trigger no te detectó, te creamos un perfil virtual
      setPerfil({
        id: userId,
        email: userEmail,
        rol: 'Pendiente',
        nombre_completo: 'Usuario'
      });
    }
    setCargando(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (cargando) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="font-black text-slate-400 animate-pulse uppercase tracking-widest text-xl">
          Sincronizando...
        </div>
      </div>
    );
  }

  if (!sesion) return <LoginPage />;

  // BLOQUEO DE COBRANZA: Se muestra DESPUÉS del login a todos los usuarios
  // excepto la cuenta maestra (la tuya). Es imposible llegar al CRM.
  if (perfil && perfil.email !== 'novasolum.info@gmail.com') {
    return <CuentaSuspendidaPage onLogout={handleLogout} />;
  }

  // LA LLAVE MAESTRA: Se salta el bloqueo si el correo es el tuyo
  if (perfil && perfil.rol === 'Pendiente' && perfil.email !== 'novasolum.info@gmail.com') {
    return (
      <div className="h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-slate-200">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Cuenta en Revisión</h2>
          <p className="text-slate-500 text-sm mb-6">
            Has iniciado sesión correctamente, pero tu cuenta aún no tiene permisos asignados. Por favor, contacta al Super Administrador para que habilite tu acceso.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <MainLayout setVistaActiva={setVistaActiva} vistaActiva={vistaActiva} perfil={perfil} onLogout={handleLogout}>
      {vistaActiva === 'Inicio' && <DashboardPage />}
      {vistaActiva === 'Clientes' && <ClientesPage />}
      {vistaActiva === 'ClientesCerrados' && <ClientesCerradosPage />}
      {vistaActiva === 'Finanzas' && <FinanzasPage />}
      {vistaActiva === 'Calendario' && <CalendarioPage />}
      {vistaActiva === 'Etiquetas' && <EtiquetasPage />}
      {vistaActiva === 'Proyectos' && <ProyectosPage />}
      {vistaActiva === 'Configuracion' && <CuentasPage />}
      {vistaActiva === 'Inventario' && <InventarioPage />}
      {vistaActiva === 'Roles' && <RolesPage />}
    </MainLayout>
  );
}

export default App;