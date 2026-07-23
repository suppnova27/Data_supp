import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

const COLUMNAS_KANBAN = ['Nuevo Lead', 'En negociación', 'Cotización enviada', 'No responde'];

async function cargarServiciosBD() {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .select('id, nombre, activa')
            .order('nombre', { ascending: true });
        
        if (error) {
            console.error('Error cargando servicios en Clientes:', error.message);
            return [];
        }
        return (data || []).filter(s => s.activa !== false).map(s => s.nombre);
    } catch (e) {
        console.error('Excepción cargando servicios en Clientes:', e);
        return [];
    }
}

async function cargarEtiquetasBD() {
    try {
        const { data, error } = await supabase
            .from('etiquetas')
            .select('id, nombre, activa')
            .order('nombre', { ascending: true });
        
        if (error) {
            console.error('Error cargando etiquetas en Clientes:', error.message);
            return [];
        }
        return (data || []).filter(e => e.activa !== false).map(e => e.nombre);
    } catch (e) {
        console.error('Excepción cargando etiquetas en Clientes:', e);
        return [];
    }
}

export default function ClientesPage() {
    const [clientes, setClientes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroServicio, setFiltroServicio] = useState('Todos');
    const [filtroEtiqueta, setFiltroEtiqueta] = useState('Todos');

    const [vistaTab, setVistaTab] = useState('kanban'); // 'kanban' o 'directorio'

    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [serviciosDisponibles, setServiciosDisponibles] = useState([]);
    const [etiquetasDisponibles, setEtiquetasDisponibles] = useState([]);
    const [formData, setFormData] = useState({
        nombres: '', apellido_paterno: '', telefono: '', trabajo_realizado: '', etiqueta: '', estado: 'Nuevo Lead'
    });
    const [editandoId, setEditandoId] = useState(null);

    const [cerrandoId, setCerrandoId] = useState(null);
    const [motivoCierre, setMotivoCierre] = useState('Venta concretada');

    const fetchClientes = async () => {
        setCargando(true);
        const { data } = await supabase.from('clientes').select('*').order('fecha_creacion', { ascending: false });
        if (data) setClientes(data);
        setCargando(false);
    };

    useEffect(() => { 
        fetchClientes();
        // Cargar servicios y etiquetas desde la BD
        cargarServiciosBD().then(setServiciosDisponibles);
        cargarEtiquetasBD().then(setEtiquetasDisponibles);
    }, []);

    const abrirModal = (cliente = null) => {
        if (cliente) {
            setFormData({ ...cliente });
            setEditandoId(cliente.id);
        } else {
            setFormData({ 
                nombres: '', 
                apellido_paterno: '', 
                telefono: '', 
                trabajo_realizado: serviciosDisponibles[0] || '', 
                etiqueta: etiquetasDisponibles[0] || '', 
                estado: 'Nuevo Lead' 
            });
            setEditandoId(null);
        }
        setModalAbierto(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        const accion = editandoId
            ? supabase.from('clientes').update(formData).eq('id', editandoId)
            : supabase.from('clientes').insert([formData]);

        const { error } = await accion;
        setGuardando(false);
        if (!error) { setModalAbierto(false); fetchClientes(); }
    };

    const cambiarEstadoKanban = async (id, nuevoEstado) => {
        await supabase.from('clientes').update({ estado: nuevoEstado }).eq('id', id);
        fetchClientes();
    };

    const handleReabrir = async (id) => {
        const { error } = await supabase.from('clientes').update({ cerrado: false, motivo_cierre: null, estado: 'Nuevo Lead' }).eq('id', id);
        if (!error) fetchClientes();
    };

    const handleEliminar = async (id, nombres) => {
        if (window.confirm(`¿Eliminar permanentemente al cliente "${nombres}"? Esto removerá todos sus datos históricos.`)) {
            const { error } = await supabase.from('clientes').delete().eq('id', id);
            if (!error) fetchClientes();
        }
    };

    const ejecutarArchivado = async () => {
        if (!cerrandoId) return;
        const estadoFinal = motivoCierre === 'Venta concretada' ? 'Venta concretada' : 'Perdido';
        const { error } = await supabase.from('clientes').update({ cerrado: true, motivo_cierre: motivoCierre, estado: estadoFinal }).eq('id', cerrandoId);
        if (!error) { setCerrandoId(null); fetchClientes(); }
    };

    const clientesFiltrados = useMemo(() => {
        return clientes.filter(c => {
            const cumpleBusqueda = c.nombres.toLowerCase().includes(busqueda.toLowerCase()) || c.telefono.includes(busqueda);
            const cumpleServicio = filtroServicio === 'Todos' || c.trabajo_realizado === filtroServicio;
            const cumpleEtiqueta = filtroEtiqueta === 'Todos' || c.etiqueta === filtroEtiqueta;
            return cumpleBusqueda && cumpleServicio && cumpleEtiqueta;
        });
    }, [clientes, busqueda, filtroServicio, filtroEtiqueta]);

    const activeClientesFiltrados = useMemo(() => {
        return clientesFiltrados.filter(c => !c.cerrado);
    }, [clientesFiltrados]);

    if (cargando) return <div className="p-10 text-center text-slate-500 animate-pulse font-black tracking-widest uppercase">Cargando Tablero...</div>;

    return (
        <div className="p-4 md:p-8 max-w-[99%] mx-auto flex flex-col gap-6 pb-20">

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 gap-6 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#ffdd1c] opacity-10 rounded-full blur-3xl"></div>
                <div>
                    <h1 className="text-3xl font-black text-[#0055af] tracking-tight">Pipeline Comercial</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Visualización de flujos de conversión apilados de forma dinámica.</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full xl:w-auto relative z-10">
                    <input type="text" placeholder="🔍 Buscar lead..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="border-2 border-slate-100 rounded-full px-5 py-2.5 text-sm outline-none focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 w-full sm:w-48 font-medium shadow-sm bg-slate-50/50 focus:bg-white transition-all" />

                    <select value={filtroServicio} onChange={e => setFiltroServicio(e.target.value)} className="border-2 border-slate-100 rounded-full px-4 py-2.5 text-sm bg-white outline-none font-bold text-slate-600 shadow-sm cursor-pointer focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 transition-all max-w-[200px] truncate">
                        <option value="Todos">Todos los Servicios</option>
                        {serviciosDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} className="border-2 border-slate-100 rounded-full px-4 py-2.5 text-sm bg-white outline-none font-bold text-slate-600 shadow-sm cursor-pointer focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 transition-all max-w-[200px] truncate">
                        <option value="Todos">Todas las Etiquetas</option>
                        {etiquetasDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>

                    <button onClick={() => abrirModal()} className="px-6 py-2.5 bg-[#0055af] text-white font-black rounded-full text-xs uppercase tracking-widest hover:bg-[#0055af] hover:-translate-y-1 shadow-lg shadow-[#0055af]/20 border-2 border-[#0055af] hover:border-[#ffdd1c] transition-all duration-300">
                        + Nuevo Lead
                    </button>
                </div>
            </div>

            {/* TABS DE SELECCIÓN DE VISTA */}
            <div className="flex gap-2 border-b border-slate-200 pb-3 mt-2">
                <button
                    type="button"
                    onClick={() => setVistaTab('kanban')}
                    className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                        vistaTab === 'kanban' 
                            ? 'bg-[#0055af] text-white border-2 border-[#0055af]' 
                            : 'bg-white hover:bg-slate-50 border-2 border-slate-100 text-slate-600'
                    }`}
                >
                    📋 Tablero Kanban (Pipeline)
                </button>
                <button
                    type="button"
                    onClick={() => setVistaTab('directorio')}
                    className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                        vistaTab === 'directorio' 
                            ? 'bg-[#0055af] text-white border-2 border-[#0055af]' 
                            : 'bg-white hover:bg-slate-50 border-2 border-slate-100 text-slate-600'
                    }`}
                >
                    👥 Directorio General de Clientes
                </button>
            </div>

            {vistaTab === 'kanban' && (
                <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-6 items-start custom-scrollbar animate-in fade-in duration-300">
                    {COLUMNAS_KANBAN.map(columna => {
                        const leadsDeColumna = activeClientesFiltrados.filter(c => c.estado === columna);
                        return (
                            <div key={columna} className="flex-1 min-w-[340px] w-full bg-slate-100/60 p-4 md:p-5 rounded-3xl border border-slate-200/60 flex flex-col gap-5 shadow-inner">

                                <div className="flex justify-between items-center px-2">
                                    <h3 className="font-black text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2.5">
                                        <span className={`w-3 h-3 rounded-full shadow-sm
                                            ${columna === 'Nuevo Lead' ? 'bg-[#ffdd1c] shadow-[#ffdd1c]/50' :
                                                columna === 'En negociación' ? 'bg-purple-500 shadow-purple-500/50' :
                                                    columna === 'Cotización enviada' ? 'bg-[#0055af] shadow-[#0055af]/50' : 'bg-slate-400'}`} />
                                        {columna}
                                    </h3>
                                    <span className="bg-white text-slate-800 font-black text-xs px-3 py-1 rounded-full shadow-sm border border-slate-200/50">{leadsDeColumna.length}</span>
                                </div>

                                <div className="flex flex-col gap-4 max-h-[calc(100vh-280px)] min-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {leadsDeColumna.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 text-xs italic bg-white/40 border-2 border-dashed border-slate-200 rounded-2xl animate-in fade-in duration-300">No hay prospectos en esta fase</div>
                                    ) : (
                                        leadsDeColumna.map(c => (
                                            <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 hover:border-[#0055af]/30 hover:shadow-xl hover:shadow-[#0055af]/10 hover:-translate-y-1 transition-all duration-300 flex flex-col gap-3.5 relative overflow-hidden group shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-300">

                                                <div className={`absolute top-0 left-0 right-0 h-2 transition-all duration-300
                                                    ${columna === 'Nuevo Lead' ? 'bg-[#ffdd1c]' :
                                                        columna === 'En negociación' ? 'bg-purple-500' :
                                                            columna === 'Cotización enviada' ? 'bg-[#0055af]' : 'bg-slate-400'}`} />

                                                {/* ENCABEZADO DE LA FICHA: NOMBRE Y ETIQUETA */}
                                                <div className="flex justify-between items-start gap-3 mt-1.5">
                                                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                        <h4 className="font-black text-slate-800 text-base md:text-lg tracking-tight leading-snug break-words group-hover:text-[#0055af] transition-colors">
                                                            {c.nombres} {c.apellido_paterno || ''}
                                                        </h4>
                                                        <a href={`tel:${c.telefono}`} className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-xl w-fit flex items-center gap-1.5 border border-slate-200/60 transition-colors">
                                                            <span>📱</span> {c.telefono || 'Sin teléfono'}
                                                        </a>
                                                    </div>
                                                    <span className="text-xs font-black bg-blue-50 text-[#0055af] px-3 py-1 rounded-xl border border-blue-200/60 shrink-0 whitespace-nowrap shadow-sm">
                                                        {c.etiqueta || '✨ Residencial'}
                                                    </span>
                                                </div>

                                                {/* SERVICIO REALIZADO / REQUERIDO (SIN RECORTAR) */}
                                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60 text-xs font-bold text-slate-700 flex items-start gap-2 shadow-inner leading-relaxed break-words">
                                                    <span className="text-base shrink-0">💼</span>
                                                    <span className="flex-1">{c.trabajo_realizado || 'Servicio por definir'}</span>
                                                </div>

                                                {/* NOTAS DE IA (Lector completo sin amputar texto) */}
                                                {c.resumen_bot && (
                                                    <div className="text-xs bg-indigo-50/60 border border-indigo-100 text-slate-700 p-3 rounded-2xl font-medium leading-relaxed shadow-sm">
                                                        <span className="font-black text-indigo-700 block mb-1 uppercase tracking-wider text-[10px]">🤖 Notas de IA:</span>
                                                        <p className="break-words">{c.resumen_bot}</p>
                                                    </div>
                                                )}

                                                {/* CONTROLES INFERIORES PROPORCIONALES Y LEGIBLES */}
                                                <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3.5 mt-1">

                                                    {/* SELECCIÓN DE ESTADO FÁCIL DE USAR */}
                                                    <div className="relative w-full">
                                                        <select
                                                            value={c.estado}
                                                            onChange={e => cambiarEstadoKanban(c.id, e.target.value)}
                                                            className="w-full bg-slate-50 border-2 border-slate-200 hover:border-[#0055af]/50 focus:border-[#0055af] text-[#0055af] font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl outline-none cursor-pointer transition-all shadow-sm pr-8"
                                                        >
                                                            {COLUMNAS_KANBAN.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#0055af] font-black text-xs">
                                                            ▼
                                                        </div>
                                                    </div>

                                                    {/* BOTONES DE ACCIÓN VISIBLES Y PROPORCIONALES */}
                                                    <div className="flex items-center gap-2 w-full">
                                                        <button
                                                            type="button"
                                                            onClick={() => abrirModal(c)}
                                                            className="flex-1 py-2.5 px-3 bg-[#0055af] hover:bg-[#003d80] text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#0055af]/20 active:scale-95 flex items-center justify-center gap-1.5"
                                                        >
                                                            <span>📄</span> Ver Ficha
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => setCerrandoId(c.id)}
                                                            className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-1.5"
                                                        >
                                                            <span>📦</span> Archivar
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleEliminar(c.id, c.nombres)}
                                                            className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all border border-rose-200/80 shadow-sm shrink-0"
                                                            title="Eliminar lead permanentemente"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>

                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {vistaTab === 'directorio' && (
                <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
                            <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-black text-slate-400">
                                <tr>
                                    <th className="px-6 py-4">Cliente / Lead</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Servicio de Interés</th>
                                    <th className="px-6 py-4">Etiqueta</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {clientesFiltrados.length === 0 ? (
                                    <tr><td colSpan="5" className="p-12 text-center text-slate-400 italic">No hay registros que coincidan con la búsqueda.</td></tr>
                                ) : (
                                    clientesFiltrados.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 text-base">{c.nombres} {c.apellido_paterno || ''}</div>
                                                <div className="text-[10px] text-slate-400 font-bold tracking-wider mt-1 flex items-center gap-2">
                                                    <span>📱 {c.telefono || 'Sin número'}</span>
                                                    <span>•</span>
                                                    <span>📅 Reg: {new Date(c.fecha_creacion).toLocaleDateString('es-BO')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {c.cerrado ? (
                                                    <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 flex items-center gap-1 w-max">
                                                        📦 Archivado: {c.motivo_cierre || 'Cerrado'}
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max">
                                                        ⚡ Activo: {c.estado}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold">{c.trabajo_realizado || <span className="italic text-slate-400">Por definir</span>}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-500">{c.etiqueta || '-'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirModal(c)}
                                                        className="px-3 py-2 bg-blue-50 text-[#0055af] rounded-lg text-xs font-black hover:bg-[#0055af] hover:text-white transition-all shadow-sm"
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                    {c.cerrado ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReabrir(c.id)}
                                                            className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-black hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            🔄 Activar
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setCerrandoId(c.id)}
                                                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-black hover:bg-slate-300 transition-all shadow-sm"
                                                        >
                                                            📦 Archivar
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEliminar(c.id, c.nombres)}
                                                        className="px-3 py-2 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg transition-all text-xs"
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {modalAbierto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl w-full max-w-md p-8 flex flex-col gap-4 shadow-2xl border-t-4 border-t-[#ffdd1c] animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-3 mb-1">
                            <h2 className="text-xl font-black text-[#0055af]">{editandoId ? 'Ficha de Lead' : 'Nuevo Lead Manual'}</h2>
                            <button type="button" onClick={() => setModalAbierto(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center font-bold transition-colors">&times;</button>
                        </div>
                        <input type="text" required placeholder="Nombre(s)" className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 focus:bg-white focus:border-[#0055af] outline-none transition-all" value={formData.nombres} onChange={e => setFormData({ ...formData, nombres: e.target.value })} />
                        <input type="text" placeholder="Apellido (Opcional)" className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 focus:bg-white focus:border-[#0055af] outline-none transition-all" value={formData.apellido_paterno} onChange={e => setFormData({ ...formData, apellido_paterno: e.target.value })} />
                        <input type="text" required placeholder="Teléfono / Celular" className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 focus:bg-white focus:border-[#0055af] outline-none transition-all" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} />

                        <div className="flex flex-col gap-3 mt-1">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider pl-1">Servicio de Interés</label>
                                <div className="relative">
                                    <select className="w-full appearance-none border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white font-bold text-xs text-slate-700 outline-none focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 transition-all cursor-pointer" value={formData.trabajo_realizado} onChange={e => setFormData({ ...formData, trabajo_realizado: e.target.value })}>
                                        {serviciosDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider pl-1">Etiqueta de Rubro</label>
                                <div className="relative">
                                    <select className="w-full appearance-none border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white font-bold text-xs text-slate-700 outline-none focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 transition-all cursor-pointer" value={formData.etiqueta} onChange={e => setFormData({ ...formData, etiqueta: e.target.value })}>
                                        {etiquetasDisponibles.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-5 border-t pt-4">
                            <button type="button" onClick={() => setModalAbierto(false)} className="px-5 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest rounded-full hover:bg-slate-100 transition-colors">Cancelar</button>
                            <button type="submit" className="px-6 py-2.5 bg-[#0055af] text-white font-black rounded-full text-xs uppercase tracking-widest shadow-lg shadow-[#0055af]/20 hover:-translate-y-0.5 hover:bg-[#ffdd1c] hover:text-[#0055af] border-2 border-[#0055af] hover:border-[#ffdd1c] transition-all duration-300">{guardando ? 'Guardando...' : 'Guardar Ficha'}</button>
                        </div>
                    </form>
                </div>
            )}

            {cerrandoId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4 border-t-4 border-t-[#ffdd1c] animate-in zoom-in-95 duration-150">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-[#0055af] flex items-center gap-2">📦 Archivar Lead</h2>
                            <button type="button" onClick={() => setCerrandoId(null)} className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center font-bold transition-colors">&times;</button>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider leading-relaxed">¿Cuál fue el resultado final de esta negociación?</p>

                        <div className="relative">
                            <select value={motivoCierre} onChange={e => setMotivoCierre(e.target.value)} className="w-full appearance-none border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 font-bold text-sm text-slate-700 bg-slate-50 hover:bg-white transition-all cursor-pointer">
                                <option value="Venta concretada">✅ Venta concretada (Éxito)</option>
                                <option value="Perdido por precio">❌ Perdido (Precio alto)</option>
                                <option value="Perdido por competencia">❌ Perdido (Se fue con otro)</option>
                                <option value="No responde / Desistió">👻 Desistió / No responde</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                        </div>

                        <div className="flex justify-end gap-2 mt-2 pt-4 border-t">
                            <button onClick={() => setCerrandoId(null)} className="px-4 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest rounded-full hover:bg-slate-100 transition-colors">Cancelar</button>
                            <button onClick={ejecutarArchivado} className="px-6 py-2.5 bg-[#0055af] text-white font-black rounded-full text-xs uppercase tracking-widest shadow-lg shadow-[#0055af]/20 hover:-translate-y-0.5 hover:bg-[#ffdd1c] hover:text-[#0055af] border-2 border-[#0055af] hover:border-[#ffdd1c] transition-all duration-300">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}