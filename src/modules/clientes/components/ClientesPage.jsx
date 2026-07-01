import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

const COLUMNAS_KANBAN = ['Nuevo Lead', 'En negociación', 'Cotización enviada', 'No responde'];

const SERVICIOS_REALES = [
    '🧹 Limpieza Rutinaria',
    '🏠 Limpieza Profunda Integral',
    '🏗️ Limpieza Post Obra',
    '🛋️ Desinfección de Muebles y Alfombras',
    '🏢 Servicios Corporativos e Institucionales'
];

const ETIQUETAS_RUBRO = [
    '✨ Residencial',
    '🏬 Comercial',
    '🔥 Alta Prioridad',
    '⭐ Cliente Recurrente',
    '📅 Fin de Semana'
];

export default function ClientesPage() {
    const [clientes, setClientes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroServicio, setFiltroServicio] = useState('Todos');
    const [filtroEtiqueta, setFiltroEtiqueta] = useState('Todos');

    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [formData, setFormData] = useState({
        nombres: '', apellido_paterno: '', telefono: '', trabajo_realizado: SERVICIOS_REALES[0], etiqueta: ETIQUETAS_RUBRO[0], estado: 'Nuevo Lead'
    });
    const [editandoId, setEditandoId] = useState(null);

    const [cerrandoId, setCerrandoId] = useState(null);
    const [motivoCierre, setMotivoCierre] = useState('Venta concretada');

    const fetchClientes = async () => {
        setCargando(true);
        const { data } = await supabase.from('clientes').select('*').eq('cerrado', false).order('fecha_creacion', { ascending: false });
        if (data) setClientes(data);
        setCargando(false);
    };

    useEffect(() => { fetchClientes(); }, []);

    const abrirModal = (cliente = null) => {
        if (cliente) {
            setFormData({ ...cliente });
            setEditandoId(cliente.id);
        } else {
            setFormData({ nombres: '', apellido_paterno: '', telefono: '', trabajo_realizado: SERVICIOS_REALES[0], etiqueta: ETIQUETAS_RUBRO[0], estado: 'Nuevo Lead' });
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
                        {SERVICIOS_REALES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} className="border-2 border-slate-100 rounded-full px-4 py-2.5 text-sm bg-white outline-none font-bold text-slate-600 shadow-sm cursor-pointer focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 transition-all max-w-[200px] truncate">
                        <option value="Todos">Todas las Etiquetas</option>
                        {ETIQUETAS_RUBRO.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>

                    <button onClick={() => abrirModal()} className="px-6 py-2.5 bg-[#0055af] text-white font-black rounded-full text-xs uppercase tracking-widest hover:bg-[#0055af] hover:-translate-y-1 shadow-lg shadow-[#0055af]/20 border-2 border-[#0055af] hover:border-[#ffdd1c] transition-all duration-300">
                        + Nuevo Lead
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-6 items-start custom-scrollbar">
                {COLUMNAS_KANBAN.map(columna => {
                    const leadsDeColumna = clientesFiltrados.filter(c => c.estado === columna);
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

                            <div className="flex flex-col gap-4 max-h-[66vh] overflow-y-auto pr-2 custom-scrollbar min-h-[180px]">
                                {leadsDeColumna.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 text-xs italic bg-white/40 border-2 border-dashed border-slate-200 rounded-2xl animate-in fade-in duration-300">No hay prospectos en esta fase</div>
                                ) : (
                                    leadsDeColumna.map(c => (
                                        <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:border-slate-200 hover:shadow-xl hover:shadow-[#0055af]/10 hover:-translate-y-1.5 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden group animate-in fade-in slide-in-from-bottom-4 duration-300">

                                            <div className={`absolute top-0 left-0 right-0 h-1.5 transition-all duration-300
                                                ${columna === 'Nuevo Lead' ? 'bg-[#ffdd1c]' :
                                                    columna === 'En negociación' ? 'bg-purple-500' :
                                                        columna === 'Cotización enviada' ? 'bg-[#0055af]' : 'bg-slate-400'}`} />

                                            <div className="flex justify-between items-start gap-2 mt-1">
                                                <div className="flex flex-col gap-1 max-w-[60%]">
                                                    <h4 className="font-black text-slate-800 text-lg tracking-tight leading-tight group-hover:text-[#0055af] transition-colors">{c.nombres}</h4>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full w-max flex items-center gap-1.5 mt-0.5">
                                                        <span>📱</span> {c.telefono}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] bg-[#0055af]/5 text-[#0055af] px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-[#0055af]/20 shrink-0 truncate max-w-[40%] text-center shadow-sm">
                                                    {c.etiqueta || '✨ Residencial'}
                                                </span>
                                            </div>

                                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-2.5 text-xs font-bold text-slate-700 shadow-inner">
                                                <span className="truncate">{c.trabajo_realizado || '💼 Por definir'}</span>
                                            </div>

                                            {c.resumen_bot && (
                                                <div className="text-[10px] bg-[#0055af]/5 border border-[#0055af]/20 text-slate-600 p-3 rounded-2xl font-semibold leading-relaxed shadow-sm">
                                                    <span className="font-black text-[#0055af] block mb-1 uppercase tracking-wider text-[8px]">🤖 Notas de IA:</span>
                                                    <p className="line-clamp-2">{c.resumen_bot}</p>
                                                </div>
                                            )}

                                            {/* CONTROLES INFERIORES REDISEÑADOS PREMIUM */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 mt-1">

                                                {/* DESPLEGABLE ESTADO REDISEÑADO */}
                                                <div className="relative flex-1 min-w-[130px]">
                                                    <select
                                                        value={c.estado}
                                                        onChange={e => cambiarEstadoKanban(c.id, e.target.value)}
                                                        className="w-full appearance-none bg-slate-50 border-2 border-slate-100 hover:border-[#0055af]/40 focus:border-[#0055af] text-[#0055af] font-black text-[9px] uppercase tracking-wider px-4 py-2.5 rounded-full outline-none cursor-pointer transition-all shadow-sm"
                                                    >
                                                        {COLUMNAS_KANBAN.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                    {/* Flecha personalizada para ocultar la fea del navegador */}
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#0055af] font-black text-xs">
                                                        ▼
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => abrirModal(c)} className="px-4 py-2.5 bg-[#0055af] text-white hover:bg-[#ffdd1c] hover:text-[#0055af] rounded-full font-black text-[9px] uppercase tracking-wider transition-all duration-300 shadow-md shadow-[#0055af]/20 active:scale-95">
                                                        Ficha
                                                    </button>
                                                    <button onClick={() => setCerrandoId(c.id)} className="px-4 py-2.5 bg-[#0055af] text-white hover:bg-[#ffdd1c] hover:text-[#0055af] rounded-full font-black text-[9px] uppercase tracking-wider transition-all duration-300 shadow-md shadow-[#0055af]/20 active:scale-95">
                                                        📦 Archivar
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
                                        {SERVICIOS_REALES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider pl-1">Etiqueta de Rubro</label>
                                <div className="relative">
                                    <select className="w-full appearance-none border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white font-bold text-xs text-slate-700 outline-none focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 transition-all cursor-pointer" value={formData.etiqueta} onChange={e => setFormData({ ...formData, etiqueta: e.target.value })}>
                                        {ETIQUETAS_RUBRO.map(e => <option key={e} value={e}>{e}</option>)}
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