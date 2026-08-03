import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TIPOS_EVENTO = ['Visita', 'Proyecto', 'Cita', 'Entrega', 'Otro'];
const ESTADOS_EVENTO = ['Pendiente', 'En curso', 'Completado', 'Cancelado'];

const ESTADO_CLASES = {
    'Pendiente': 'bg-amber-100 text-amber-700 border-amber-200',
    'En curso': 'bg-blue-100 text-blue-700 border-blue-200',
    'Completado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Cancelado': 'bg-rose-100 text-rose-600 border-rose-200'
};

const obtenerFechaISO = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const obtenerFechaHoy = () => obtenerFechaISO(new Date());

function construirCeldasMes(anio, mes) {
    const primerDia = new Date(anio, mes, 1);
    const offset = (primerDia.getDay() + 6) % 7; // Lunes = 0
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const celdas = [];
    for (let i = 0; i < offset; i++) celdas.push(null);
    for (let d = 1; d <= diasEnMes; d++) celdas.push(new Date(anio, mes, d));
    while (celdas.length % 7 !== 0) celdas.push(null);
    return celdas;
}

export default function CalendarioPage() {
    const hoy = new Date();
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth());
    const [eventos, setEventos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [etiquetas, setEtiquetas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [diaSeleccionado, setDiaSeleccionado] = useState(null); // Date o null

    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [formData, setFormData] = useState({
        fecha: obtenerFechaHoy(), hora: '', tipo: 'Visita', titulo: '',
        cliente_id: '', servicio_id: '', etiqueta_id: '', estado: 'Pendiente', notas: ''
    });

    // Quick-add de servicio / etiqueta
    const [quickAdd, setQuickAdd] = useState({ tipo: '', nombre: '' });

    const nombreMes = new Date(anio, mes, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    const cargarRelaciones = async () => {
        const [cRes, sRes, eRes] = await Promise.all([
            supabase.from('clientes').select('id, nombres, apellido_paterno').order('nombres', { ascending: true }),
            supabase.from('servicios').select('id, nombre, activa').order('nombre', { ascending: true }),
            supabase.from('etiquetas').select('id, nombre, color, activa').order('nombre', { ascending: true })
        ]);
        if (cRes.data) setClientes(cRes.data);
        if (sRes.data) setServicios((sRes.data || []).filter(s => s.activa !== false));
        if (eRes.data) setEtiquetas((eRes.data || []).filter(e => e.activa !== false));
    };

    const fetchEventos = async () => {
        setCargando(true);
        const inicio = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
        const ultimoDia = new Date(anio, mes + 1, 0).getDate();
        const fin = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        const { data } = await supabase
            .from('calendario')
            .select('*')
            .gte('fecha', inicio)
            .lte('fecha', fin)
            .order('fecha', { ascending: true });
        if (data) setEventos(data);
        setCargando(false);
    };

    useEffect(() => {
        fetchEventos();
        cargarRelaciones();
    }, [anio, mes]);

    const celdas = useMemo(() => construirCeldasMes(anio, mes), [anio, mes]);

    const eventosPorDia = (dia) => {
        const iso = obtenerFechaISO(dia);
        return eventos.filter(e => e.fecha === iso);
    };

    const eventosDiaSeleccionado = diaSeleccionado ? eventosPorDia(diaSeleccionado) : [];
    const nombreDiaSeleccionado = diaSeleccionado
        ? diaSeleccionado.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
        : '';

    const abrirModal = (dia = null, evento = null) => {
        if (evento) {
            setFormData({
                fecha: evento.fecha, hora: evento.hora || '', tipo: evento.tipo, titulo: evento.titulo,
                cliente_id: evento.cliente_id || '', servicio_id: evento.servicio_id || '',
                etiqueta_id: evento.etiqueta_id || '', estado: evento.estado || 'Pendiente', notas: evento.notas || ''
            });
            setEditandoId(evento.id);
        } else {
            setFormData({
                fecha: dia ? obtenerFechaISO(dia) : obtenerFechaHoy(), hora: '', tipo: 'Visita', titulo: '',
                cliente_id: '', servicio_id: '', etiqueta_id: '', estado: 'Pendiente', notas: ''
            });
            setEditandoId(null);
        }
        setQuickAdd({ tipo: '', nombre: '' });
        setModalAbierto(true);
    };

    const manejarQuickAdd = async (tipo) => {
        const nombre = quickAdd.nombre.trim();
        if (!nombre) return;
        if (tipo === 'etiqueta') {
            const { data, error } = await supabase.from('etiquetas').insert([{ nombre, color: '#0055af' }]).select().single();
            if (!error && data) {
                setEtiquetas(prev => [...prev, data]);
                setFormData(prev => ({ ...prev, etiqueta_id: data.id }));
            }
        } else if (tipo === 'servicio') {
            const { data, error } = await supabase.from('servicios').insert([{ nombre, etiqueta_id: formData.etiqueta_id || null }]).select().single();
            if (!error && data) {
                setServicios(prev => [...prev, data]);
                setFormData(prev => ({ ...prev, servicio_id: data.id }));
            }
        }
        setQuickAdd({ tipo: '', nombre: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        const datos = {
            fecha: formData.fecha,
            hora: formData.hora || null,
            tipo: formData.tipo,
            titulo: formData.titulo,
            cliente_id: formData.cliente_id || null,
            servicio_id: formData.servicio_id || null,
            etiqueta_id: formData.etiqueta_id || null,
            estado: formData.estado,
            notas: formData.notas || ''
        };
        let error = null;
        if (editandoId) {
            ({ error } = await supabase.from('calendario').update(datos).eq('id', editandoId));
        } else {
            const res = await supabase.from('calendario').insert([datos]).select().single();
            error = res.error;
        }
        setGuardando(false);
        if (error) {
            alert('Error al guardar: ' + (error.message || 'Error desconocido'));
        } else {
            setModalAbierto(false);
            fetchEventos();
        }
    };

    const handleEliminar = async (evento) => {
        if (window.confirm(`¿Eliminar "${evento.titulo}" del ${evento.fecha}?`)) {
            await supabase.from('calendario').delete().eq('id', evento.id);
            fetchEventos();
        }
    };

    const nombreCliente = (id) => {
        const c = clientes.find(cl => cl.id === id);
        return c ? (c.apellido_paterno ? `${c.nombres} ${c.apellido_paterno}` : c.nombres) : null;
    };

    const nombreServicio = (id) => servicios.find(s => s.id === id)?.nombre || null;
    const etiquetaDe = (id) => etiquetas.find(et => et.id === id);

    return (
        <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-black text-[#0055af] uppercase tracking-wider">📅 Calendario</h1>
                    <p className="text-xs text-slate-400 font-bold mt-1">Visitas y proyectos programados</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setMes(hoy.getMonth()); setAnio(hoy.getFullYear()); }} className="px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600 hover:bg-[#ffdd1c] hover:text-[#0055af] transition-all">
                        Hoy
                    </button>
                    <button onClick={() => abrirModal(null)} className="px-5 py-2.5 rounded-full bg-[#0055af] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-[#0055af]/30 hover:-translate-y-0.5 transition-all">
                        + Nuevo Evento
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMes(mes - 1)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-[#0055af] hover:text-white font-black transition-colors">‹</button>
                        <h2 className="text-lg font-black text-slate-800 capitalize">{nombreMes}</h2>
                        <button onClick={() => setMes(mes + 1)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-[#0055af] hover:text-white font-black transition-colors">›</button>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                        {cargando ? 'Cargando...' : `${eventos.length} evento(s) este mes`}
                    </span>
                </div>

                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {DIAS_SEMANA.map(d => (
                        <div key={d} className="py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7">
                    {celdas.map((dia, idx) => {
                        if (!dia) return <div key={`empty-${idx}`} className="min-h-[110px] md:min-h-[130px] border border-slate-50 bg-slate-50/40" />;
                        const esHoy = obtenerFechaISO(dia) === obtenerFechaHoy();
                        const eventosDia = eventosPorDia(dia);
                        const estaSeleccionado = diaSeleccionado && obtenerFechaISO(diaSeleccionado) === obtenerFechaISO(dia);
                        return (
                            <button
                                key={idx}
                                onClick={() => setDiaSeleccionado(dia)}
                                className={`min-h-[110px] md:min-h-[130px] p-2 border border-slate-50 text-left align-top transition-all hover:bg-[#0055af]/5 group relative ${
                                    estaSeleccionado ? 'bg-[#0055af]/10 ring-2 ring-inset ring-[#0055af]/40' : esHoy ? 'bg-[#ffdd1c]/10' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-xs font-black ${esHoy ? 'w-6 h-6 flex items-center justify-center rounded-full bg-[#ffdd1c] text-[#0055af]' : 'text-slate-500'}`}>{dia.getDate()}</span>
                                    <span className="text-[9px] text-[#0055af] opacity-0 group-hover:opacity-100 transition-opacity font-black uppercase">+ Agregar</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {eventosDia.slice(0, 3).map(ev => {
                                        const etq = etiquetaDe(ev.etiqueta_id);
                                        return (
                                            <span key={ev.id} className="text-[9px] leading-tight truncate px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold border-l-2" style={{ borderLeftColor: etq?.color || '#0055af' }}>
                                                {ev.hora ? `${ev.hora.slice(0, 5)} · ` : ''}{ev.titulo}
                                            </span>
                                        );
                                    })}
                                    {eventosDia.length > 3 && (
                                        <span className="text-[9px] font-black text-slate-400">+{eventosDia.length - 3} más</span>
                                    )}
                                </div>
                                <span
                                    className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] leading-none font-black"
                                    style={{ backgroundColor: '#0055af' }}
                                    onClick={(e) => { e.stopPropagation(); abrirModal(dia, null); }}
                                >+</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {diaSeleccionado && (
                <div className="mt-6 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider capitalize">{nombreDiaSeleccionado}</h3>
                        <button onClick={() => abrirModal(diaSeleccionado, null)} className="px-4 py-2 rounded-full bg-[#0055af]/10 text-[#0055af] text-[11px] font-black uppercase tracking-wider hover:bg-[#0055af] hover:text-white transition-all">
                            + Agregar en este día
                        </button>
                    </div>
                    <div className="p-4 md:p-6 flex flex-col gap-2.5">
                        {eventosDiaSeleccionado.length === 0 && (
                            <p className="text-sm text-slate-400 font-bold text-center py-4">No hay eventos registrados en este día.</p>
                        )}
                        {eventosDiaSeleccionado.map(ev => {
                            const etq = etiquetaDe(ev.etiqueta_id);
                            return (
                                <div key={ev.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/60 hover:border-[#0055af]/30 transition-colors">
                                    <div className="flex items-start gap-3">
                                        <span className="w-1.5 h-10 rounded-full self-stretch shrink-0" style={{ backgroundColor: etq?.color || '#0055af' }} />
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black text-[#0055af] uppercase tracking-widest">{ev.tipo}</span>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${ESTADO_CLASES[ev.estado] || ESTADO_CLASES['Pendiente']}`}>{ev.estado}</span>
                                                {ev.hora && <span className="text-[10px] font-bold text-slate-400">🕐 {ev.hora.slice(0, 5)}</span>}
                                            </div>
                                            <p className="text-sm font-black text-slate-800 mt-1">{ev.titulo}</p>
                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                {nombreCliente(ev.cliente_id) && <span className="text-[10px] font-bold text-slate-500">👤 {nombreCliente(ev.cliente_id)}</span>}
                                                {nombreServicio(ev.servicio_id) && <span className="text-[10px] font-bold text-slate-500">🛠️ {nombreServicio(ev.servicio_id)}</span>}
                                                {etq && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: etq.color + '22', color: etq.color }}>🏷️ {etq.nombre}</span>}
                                            </div>
                                            {ev.notas && <p className="text-[11px] text-slate-400 font-medium mt-1.5">{ev.notas}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => abrirModal(null, ev)} className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider hover:border-[#0055af] hover:text-[#0055af] transition-colors">✏️ Editar</button>
                                        <button onClick={() => handleEliminar(ev)} className="px-4 py-2 rounded-full bg-rose-50 text-rose-500 text-[10px] font-black uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-colors">🗑️</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {modalAbierto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-t-4 border-t-[#ffdd1c]">
                        <div className="p-6 border-b bg-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute -left-10 -top-10 w-32 h-32 bg-[#0055af] opacity-5 rounded-full blur-2xl"></div>
                            <h2 className="text-xl font-black text-[#0055af] flex items-center gap-2 relative z-10">
                                {editandoId ? '✏️ Editar Evento' : '📅 Registrar Evento'}
                            </h2>
                            <button onClick={() => setModalAbierto(false)} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 font-bold transition-colors">
                                &times;
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form id="form-calendario" onSubmit={handleSubmit} className="flex flex-col gap-5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Fecha</label>
                                        <input type="date" required value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Hora (Opcional)</label>
                                        <input type="time" value={formData.hora} onChange={e => setFormData({ ...formData, hora: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo</label>
                                        <select required value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-slate-700 outline-none focus:border-[#0055af]">
                                            {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <input type="text" required placeholder="Título del evento (Ej. Visita de cotización)" className="border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-[#0055af] text-sm font-bold" value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cliente Vinculado</label>
                                        <select value={formData.cliente_id} onChange={e => setFormData({ ...formData, cliente_id: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                            <option value="">-- Sin cliente --</option>
                                            {clientes.map(c => <option key={c.id} value={c.id}>{c.apellido_paterno ? `${c.nombres} ${c.apellido_paterno}` : c.nombres}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Estado</label>
                                        <select required value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-slate-700 outline-none focus:border-[#0055af]">
                                            {ESTADOS_EVENTO.map(est => <option key={est} value={est}>{est.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Etiqueta</label>
                                        <div className="flex gap-2">
                                            <select value={formData.etiqueta_id} onChange={e => setFormData({ ...formData, etiqueta_id: e.target.value })} className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                                <option value="">-- Sin etiqueta --</option>
                                                {etiquetas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
                                            </select>
                                            <button type="button" onClick={() => setQuickAdd(prev => prev.tipo === 'etiqueta' ? { tipo: '', nombre: '' } : { tipo: 'etiqueta', nombre: '' })} className="px-4 py-3 rounded-xl bg-[#0055af]/10 text-[#0055af] font-black text-lg hover:bg-[#0055af] hover:text-white transition-colors" title="Nueva etiqueta">+</button>
                                        </div>
                                        {quickAdd.tipo === 'etiqueta' && (
                                            <div className="flex gap-2 animate-in slide-in-from-top-2">
                                                <input type="text" placeholder="Nombre de la nueva etiqueta" value={quickAdd.nombre} onChange={e => setQuickAdd({ ...quickAdd, nombre: e.target.value })} className="flex-1 border-2 border-[#ffdd1c] bg-amber-50 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-400" />
                                                <button type="button" onClick={() => manejarQuickAdd('etiqueta')} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black uppercase hover:bg-emerald-600 transition-colors">Guardar</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Servicio</label>
                                        <div className="flex gap-2">
                                            <select value={formData.servicio_id} onChange={e => setFormData({ ...formData, servicio_id: e.target.value })} className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                                <option value="">-- Sin servicio --</option>
                                                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                            </select>
                                            <button type="button" onClick={() => setQuickAdd(prev => prev.tipo === 'servicio' ? { tipo: '', nombre: '' } : { tipo: 'servicio', nombre: '' })} className="px-4 py-3 rounded-xl bg-[#0055af]/10 text-[#0055af] font-black text-lg hover:bg-[#0055af] hover:text-white transition-colors" title="Nuevo servicio">+</button>
                                        </div>
                                        {quickAdd.tipo === 'servicio' && (
                                            <div className="flex gap-2 animate-in slide-in-from-top-2">
                                                <input type="text" placeholder="Nombre del nuevo servicio" value={quickAdd.nombre} onChange={e => setQuickAdd({ ...quickAdd, nombre: e.target.value })} className="flex-1 border-2 border-[#ffdd1c] bg-amber-50 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-400" />
                                                <button type="button" onClick={() => manejarQuickAdd('servicio')} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black uppercase hover:bg-emerald-600 transition-colors">Guardar</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Notas (Opcional)</label>
                                    <textarea rows={2} placeholder="Detalles de la visita, dirección, contacto, etc." value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#0055af] resize-none" />
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t bg-white flex justify-end gap-3">
                            <button type="button" onClick={() => setModalAbierto(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-full transition-colors text-xs uppercase tracking-widest">
                                Cancelar
                            </button>
                            <button type="submit" form="form-calendario" disabled={guardando} className="px-8 py-3 bg-[#0055af] text-white font-black rounded-full hover:-translate-y-1 shadow-lg shadow-[#0055af]/30 transition-all text-xs uppercase tracking-widest border-2 border-[#0055af] hover:border-[#ffdd1c]">
                                {guardando ? 'Procesando...' : (editandoId ? 'Actualizar Evento' : 'Confirmar Evento')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
