import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ClientesPage() {
    const [clientes, setClientes] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Estado para la barra de búsqueda
    const [busqueda, setBusqueda] = useState('');

    // Estados Modales
    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [formData, setFormData] = useState({
        nombres: '', apellido_paterno: '', telefono: '',
        trabajo_realizado: '', estado: 'Nuevo Lead'
    });
    const [editandoId, setEditandoId] = useState(null);
    const [cerrandoId, setCerrandoId] = useState(null);
    const [motivoCierre, setMotivoCierre] = useState('Venta concretada');

    const fetchClientes = async () => {
        setCargando(true);
        const { data } = await supabase
            .from('clientes')
            .select('*')
            .eq('cerrado', false)
            .order('fecha_creacion', { ascending: false });

        if (data) setClientes(data);
        setCargando(false);
    };

    useEffect(() => { fetchClientes(); }, []);

    const abrirModal = (cliente = null) => {
        if (cliente) {
            setFormData({ ...cliente });
            setEditandoId(cliente.id);
        } else {
            setFormData({ nombres: '', apellido_paterno: '', telefono: '', trabajo_realizado: '', estado: 'Nuevo Lead' });
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

        if (!error) {
            setModalAbierto(false);
            fetchClientes();
        } else {
            alert("Error al guardar el cliente.");
            console.error(error);
        }
    };

    const cambiarEstado = async (id, nuevoEstado) => {
        await supabase.from('clientes').update({ estado: nuevoEstado }).eq('id', id);
        fetchClientes();
    };

    const eliminarCliente = async (id) => {
        if (window.confirm("¿Estás seguro de que deseas eliminar este cliente permanentemente?")) {
            const { error } = await supabase.from('clientes').delete().eq('id', id);
            if (!error) fetchClientes();
        }
    };

    const confirmarCierre = async () => {
        if (!cerrandoId) return;
        const estadoFinal = motivoCierre === 'Venta concretada' ? 'Venta concretada' : 'Perdido';
        const { error } = await supabase
            .from('clientes')
            .update({ cerrado: true, motivo_cierre: motivoCierre, estado: estadoFinal })
            .eq('id', cerrandoId);

        if (!error) {
            setCerrandoId(null);
            fetchClientes();
        }
    };

    // Lógica de filtrado en tiempo real
    const clientesFiltrados = clientes.filter(c =>
        c.nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
        (c.apellido_paterno && c.apellido_paterno.toLowerCase().includes(busqueda.toLowerCase())) ||
        c.telefono.includes(busqueda)
    );

    if (cargando) return <div className="p-10 text-center text-slate-500 animate-pulse font-bold tracking-widest uppercase">Cargando leads...</div>;

    return (
        <div className="p-4 md:p-8 max-w-[98%] mx-auto flex flex-col gap-6 animate-in fade-in duration-500 pb-20">

            {/* Cabecera y Buscador */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Pipeline de Leads Activos</h1>
                    <p className="text-sm text-slate-500 mt-1">Gestiona tus prospectos entrantes desde Botpress y redes sociales.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            🔍
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o teléfono..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 md:py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium"
                        />
                    </div>

                    <button onClick={() => abrirModal()} className="w-full md:w-auto px-6 py-3 md:py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex justify-center items-center gap-2 shrink-0">
                        <span>+</span> Nuevo Lead Manual
                    </button>
                </div>
            </div>

            {/* CONTENEDOR TIPO TARJETAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {clientesFiltrados.length === 0 ? (
                    <div className="col-span-full p-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border-2 border-slate-200 border-dashed">
                        <span className="text-4xl mb-3">👻</span>
                        <p className="font-bold text-lg text-slate-500">
                            {busqueda ? 'No se encontraron clientes con esa búsqueda.' : 'No hay clientes activos en este momento.'}
                        </p>
                        <p className="text-sm">{busqueda ? 'Intenta buscar con otro nombre.' : '¡Espera a que tu bot recolecte nuevos leads!'}</p>
                    </div>
                ) : (
                    clientesFiltrados.map(c => (
                        <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:z-50 transition-all duration-300 flex flex-col justify-between relative group">

                            <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-2xl transition-colors
                ${c.estado === 'Nuevo Lead' ? 'bg-amber-400' :
                                    c.estado === 'Cotización enviada' ? 'bg-blue-500' :
                                        c.estado === 'En negociación' ? 'bg-purple-500' : 'bg-slate-300'}
              `}></div>

                            <div className="flex justify-between items-start mb-5 mt-1">
                                <div className="pr-4">
                                    <h3 className="text-lg font-black text-slate-800 leading-tight">
                                        {c.nombres} {c.apellido_paterno || ''}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-wider flex items-center gap-1">
                                        <span>🗓️</span> {new Date(c.fecha_creacion).toLocaleDateString('es-BO')}
                                    </p>
                                </div>

                                {/* SOLUCIÓN AQUÍ: hover:z-[60] fuerza a este elemento a estar por encima de los botones inferiores */}
                                {c.resumen_bot && (
                                    <div className="group/ai relative cursor-help shrink-0 hover:z-[60]">
                                        <div className="bg-blue-50 border border-blue-200 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm hover:bg-blue-600 hover:text-white transition-all">
                                            🤖
                                        </div>
                                        {/* Añadido z-[100] extremo para garantizar la superposición */}
                                        <div className="absolute hidden group-hover/ai:block bg-slate-900 text-white p-5 rounded-2xl text-xs w-[260px] z-[100] shadow-2xl right-0 sm:left-1/2 sm:-translate-x-1/2 top-12 pointer-events-none">
                                            <p className="font-black text-blue-400 mb-2 border-b border-slate-700 pb-2 uppercase text-[10px] tracking-widest flex items-center gap-2">
                                                <span>🤖</span> Contexto del Chatbot
                                            </p>
                                            <p className="leading-relaxed font-medium text-slate-200">{c.resumen_bot}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 mb-6 flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">{c.telefono}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 truncate">
                                        {c.trabajo_realizado ? c.trabajo_realizado : <span className="italic text-slate-400 font-normal">Servicio por definir</span>}
                                    </span>
                                </div>
                            </div>

                            {/* SOLUCIÓN AQUÍ: Se eliminó el z-10 de este contenedor inferior */}
                            <div className="flex flex-col gap-3">
                                <select
                                    value={c.estado}
                                    onChange={(e) => cambiarEstado(c.id, e.target.value)}
                                    className={`w-full border rounded-xl px-4 py-2.5 text-xs font-black outline-none cursor-pointer transition-all shadow-sm
                    ${c.estado === 'Nuevo Lead' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                                            c.estado === 'Cotización enviada' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                                                c.estado === 'En negociación' ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' :
                                                    'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'}
                  `}
                                >
                                    <option value="Nuevo Lead">🟡 Nuevo Lead</option>
                                    <option value="En negociación">🟣 En negociación</option>
                                    <option value="Cotización enviada">🔵 Cotización enviada</option>
                                    <option value="No responde">⚪ No responde</option>
                                </select>

                                <div className="flex justify-between items-center gap-2 mt-1">
                                    <button onClick={() => abrirModal(c)} className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors flex justify-center items-center gap-1.5">
                                        ✏️ Editar
                                    </button>
                                    <button onClick={() => setCerrandoId(c.id)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 border border-slate-800 text-white rounded-xl font-bold text-xs transition-colors flex justify-center items-center gap-1.5">
                                        📦 Archivar
                                    </button>
                                    <button onClick={() => eliminarCliente(c.id)} className="w-12 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl font-bold text-xs transition-colors flex justify-center items-center">
                                        🗑️
                                    </button>
                                </div>
                            </div>

                        </div>
                    ))
                )}
            </div>

            {/* MODAL DE FORMULARIO (CREAR/EDITAR) */}
            {modalAbierto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8 flex flex-col gap-5">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-black text-slate-800">{editandoId ? 'Ficha del Cliente' : 'Nuevo Lead Manual'}</h2>
                            <button type="button" onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center font-black transition-colors">&times;</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Nombre(s) *</label>
                                <input type="text" required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-800 transition-all" value={formData.nombres || ''} onChange={e => setFormData({ ...formData, nombres: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Apellido (Opcional)</label>
                                <input type="text" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-800 transition-all" value={formData.apellido_paterno || ''} onChange={e => setFormData({ ...formData, apellido_paterno: e.target.value })} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Teléfono / Celular *</label>
                                <input type="text" required className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-800 transition-all" value={formData.telefono || ''} onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Servicio de Interés (Opcional)</label>
                                <select className="w-full border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold text-slate-700 bg-slate-50 transition-all" value={formData.trabajo_realizado || ''} onChange={e => setFormData({ ...formData, trabajo_realizado: e.target.value })}>
                                    <option value="">-- Por definir / Evaluar --</option>
                                    <option value="Limpieza de interiores">Limpieza de interiores</option>
                                    <option value="Encerado de pisos">Encerado de pisos</option>
                                    <option value="Limpieza de vidrios">Limpieza de vidrios</option>
                                    <option value="Servicio Completo">Servicio Completo</option>
                                </select>
                            </div>

                            {editandoId && formData.resumen_bot && (
                                <div className="md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5 rounded-2xl mt-2">
                                    <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2 flex items-center gap-2"><span>🤖</span> Contexto Extraído por IA</label>
                                    <p className="text-sm text-blue-900 leading-relaxed font-medium">{formData.resumen_bot}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-5">
                            <button type="button" onClick={() => setModalAbierto(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                            <button type="submit" disabled={guardando} className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-600/30 disabled:opacity-50 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
                                {guardando ? 'Guardando...' : 'Guardar Ficha'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL DE CIERRE DE CLIENTE (ARCHIVAR) */}
            {cerrandoId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 md:p-8 flex flex-col gap-4">
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-2xl mb-2">📦</div>
                        <h2 className="text-2xl font-black text-slate-800 leading-tight">Archivar Lead</h2>
                        <p className="text-sm text-slate-500 font-medium">¿Cuál fue el resultado de esta negociación? Se moverá al historial de Clientes Cerrados.</p>

                        <select
                            value={motivoCierre}
                            onChange={e => setMotivoCierre(e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 mt-2 outline-none focus:border-amber-500 font-bold text-slate-700 bg-slate-50 transition-colors"
                        >
                            <option value="Venta concretada">✅ Venta concretada (Éxito)</option>
                            <option value="Perdido por precio">❌ Perdido (Precio alto)</option>
                            <option value="Perdido por competencia">❌ Perdido (Se fue con otro)</option>
                            <option value="No responde / Desistió">👻 Desistió / No responde</option>
                        </select>

                        <div className="flex justify-end gap-3 mt-4 pt-5 border-t border-slate-100">
                            <button onClick={() => setCerrandoId(null)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                            <button onClick={confirmarCierre} className="px-5 py-2.5 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 hover:-translate-y-0.5 shadow-lg shadow-amber-500/30 transition-all">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}