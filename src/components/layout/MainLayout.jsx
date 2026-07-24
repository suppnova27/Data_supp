import { useState } from 'react';

const MODULOS_SISTEMA = [
    { id: 'Inicio', nombre: 'Dashboard', icono: '📊', rolesPermitidos: ['SA', 'Supervisor'] },
    { id: 'Clientes', nombre: 'Clientes Activos', icono: '👥', rolesPermitidos: ['SA', 'Supervisor'] },
    { id: 'ClientesCerrados', nombre: 'Clientes Cerrados', icono: '🗃️', rolesPermitidos: ['SA', 'Supervisor'] },
    { id: 'Finanzas', nombre: 'Finanzas', icono: '💰', rolesPermitidos: ['SA'] },
    { id: 'Etiquetas', nombre: 'Etiquetas', icono: '🏷️', rolesPermitidos: ['SA'] },
    { id: 'Proyectos', nombre: 'Analítica', icono: '📈', rolesPermitidos: ['SA'] },
    { id: 'Inventario', nombre: 'Inventario', icono: '📦', rolesPermitidos: ['SA'] },
    { id: 'Configuracion', nombre: 'Cuentas', icono: '⚙️', rolesPermitidos: ['SA'] },
    { id: 'Roles', nombre: 'Gestionar Roles', icono: '🔐', rolesPermitidos: ['SA'] }
];

export default function MainLayout({ children, vistaActiva, setVistaActiva, perfil, onLogout }) {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const esSuperAdmin = perfil?.rol === 'SA' || perfil?.email === 'novasolum.info@gmail.com';

    const cambiarVista = (vista) => {
        setVistaActiva(vista);
        setMenuAbierto(false);
    };

    const tieneAcceso = (vistaId) => {
        if (esSuperAdmin) return true;
        const modulo = MODULOS_SISTEMA.find(m => m.id === vistaId);
        return modulo ? modulo.rolesPermitidos.includes(perfil?.rol) : false;
    };

    // ✨ ANIMACIONES PREMIUM PARA EL MENÚ (Zoom y Color)
    const getBotonClase = (vista) => {
        const base = "group w-[90%] mx-auto text-left px-5 py-3 rounded-full flex items-center gap-3 transition-all duration-300 font-bold text-xs uppercase tracking-wider mb-1.5 transform origin-left";
        return vistaActiva === vista
            ? `${base} bg-[#0055af] text-white shadow-lg shadow-[#0055af]/30 scale-105 translate-x-1 border border-[#0055af]`
            : `${base} hover:bg-white/5 text-gray-400 hover:text-[#ffdd1c] hover:scale-105 hover:translate-x-1 border border-transparent`;
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden relative">
            <div className="md:hidden bg-gray-900 text-white flex justify-between items-center p-3 w-full absolute top-0 z-20 shadow-md border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#ffdd1c] rounded-full p-0.5 shadow-md flex items-center justify-center overflow-hidden">
                        <img src="/orelogo.png" alt="ORE Logo" className="w-full h-full object-cover rounded-full bg-white" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-black tracking-wider text-white uppercase leading-none">ORE CRM</h1>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                            {esSuperAdmin ? 'Super Administrador' : 'Supervisor'}
                        </span>
                    </div>
                </div>
                <button onClick={() => setMenuAbierto(!menuAbierto)} className="p-2 text-gray-300 hover:text-white focus:outline-none">
                    {menuAbierto ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>}
                </button>
            </div>

            {menuAbierto && <div className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setMenuAbierto(false)} />}

            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out transform ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
                <div className="p-6 hidden md:flex flex-col items-center border-b border-gray-800 bg-gray-950/40">
                    <div className="w-24 h-24 bg-[#ffdd1c] rounded-full p-1.5 shadow-xl shadow-[#ffdd1c]/10 flex items-center justify-center overflow-hidden mb-3 hover:scale-105 transition-transform duration-500">
                        <img src="/orelogo.png" alt="ORE Logo" className="w-full h-full object-cover rounded-full bg-white" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <span className="text-[9px] bg-[#ffdd1c]/10 text-[#ffdd1c] px-3 py-1 rounded-full font-black uppercase tracking-widest text-center border border-[#ffdd1c]/20">
                        {esSuperAdmin ? 'Super Administrador' : 'Supervisor'}
                    </span>
                </div>

                <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar mt-3">
                    {MODULOS_SISTEMA.map((modulo) => {
                        if (!tieneAcceso(modulo.id)) return null;
                        return (
                            <button key={modulo.id} onClick={() => cambiarVista(modulo.id)} className={getBotonClase(modulo.id)}>
                                {/* Animación extra en el ícono */}
                                <span className="text-xl group-hover:scale-125 transition-transform duration-300">{modulo.icono}</span>
                                {modulo.nombre}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800 bg-gray-950">
                    <div className="flex flex-col gap-1 mb-4 px-2">
                        <p className="text-[12px] font-bold text-gray-300 truncate">{perfil?.nombre_completo || 'Usuario'}</p>
                        <p className="text-[10px] text-gray-500 truncate">{perfil?.email || 'Cargando...'}</p>
                    </div>
                    <button onClick={onLogout} className="w-full bg-rose-500/10 text-rose-500 py-2.5 rounded-full text-xs font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all duration-300 shadow-sm border border-rose-500/20 hover:border-transparent">
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-gray-50 pt-[72px] md:pt-0 w-full relative custom-scrollbar">
                {tieneAcceso(vistaActiva) ? children : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                        <span className="text-6xl mb-4">⛔</span>
                        <h2 className="text-2xl font-black text-slate-700 mb-2">Acceso Denegado</h2>
                        <p className="max-w-md text-sm">Tu rol actual no tiene permisos suficientes para este módulo.</p>
                        <button onClick={() => cambiarVista('Clientes')} className="mt-6 px-6 py-3 bg-[#0055af] text-white font-black text-xs uppercase tracking-wider rounded-full shadow-lg shadow-[#0055af]/30 hover:-translate-y-0.5 transition-all duration-300">
                            Volver a Clientes
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
