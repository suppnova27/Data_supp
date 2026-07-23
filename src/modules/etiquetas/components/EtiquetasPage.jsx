import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function EtiquetasPage() {
    const [etiquetas, setEtiquetas] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [modalEtiqueta, setModalEtiqueta] = useState({ abierto: false, etiqueta: null });
    const [modalServicio, setModalServicio] = useState({ abierto: false, servicio: null });
    const [formDataEtiqueta, setFormDataEtiqueta] = useState({ nombre: '', color: '#0055af', activa: true });
    const [formDataServicio, setFormDataServicio] = useState({ nombre: '', etiqueta_id: '', activa: true });
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setCargando(true);
        const { data: dataEtiquetas } = await supabase
            .from('etiquetas')
            .select('*')
            .order('nombre', { ascending: true });
        
        const { data: dataServicios } = await supabase
            .from('servicios')
            .select('*, etiquetas(nombre, color)')
            .order('nombre', { ascending: true });
        
        if (dataEtiquetas) setEtiquetas(dataEtiquetas);
        if (dataServicios) setServicios(dataServicios);
        setCargando(false);
    };

    const abrirModalEtiqueta = (etiqueta = null) => {
        if (etiqueta) {
            setFormDataEtiqueta({ nombre: etiqueta.nombre, color: etiqueta.color, activa: etiqueta.activa });
            setModalEtiqueta({ abierto: true, etiqueta });
        } else {
            setFormDataEtiqueta({ nombre: '', color: '#0055af', activa: true });
            setModalEtiqueta({ abierto: true, etiqueta: null });
        }
    };

    const abrirModalServicio = (servicio = null) => {
        if (servicio) {
            setFormDataServicio({ nombre: servicio.nombre, etiqueta_id: servicio.etiqueta_id || '', activa: servicio.activa });
            setModalServicio({ abierto: true, servicio });
        } else {
            setFormDataServicio({ nombre: '', etiqueta_id: '', activa: true });
            setModalServicio({ abierto: true, servicio: null });
        }
    };

    const guardarEtiqueta = async (e) => {
        e.preventDefault();
        setGuardando(true);
        
        if (modalEtiqueta.etiqueta) {
            const { error } = await supabase
                .from('etiquetas')
                .update(formDataEtiqueta)
                .eq('id', modalEtiqueta.etiqueta.id);
            
            if (error) {
                alert('Error al actualizar etiqueta: ' + error.message);
            }
        } else {
            const { error } = await supabase
                .from('etiquetas')
                .insert([formDataEtiqueta]);
            
            if (error) {
                if (error.code === '23505') {
                    alert('Ya existe una etiqueta con ese nombre');
                } else {
                    alert('Error al crear etiqueta: ' + error.message);
                }
            }
        }
        
        setGuardando(false);
        setModalEtiqueta({ abierto: false, etiqueta: null });
        cargarDatos();
    };

    const guardarServicio = async (e) => {
        e.preventDefault();
        setGuardando(true);
        
        const datosParaGuardar = {
            nombre: formDataServicio.nombre,
            etiqueta_id: formDataServicio.etiqueta_id || null,
            activa: formDataServicio.activa
        };
        
        if (modalServicio.servicio) {
            const { error } = await supabase
                .from('servicios')
                .update(datosParaGuardar)
                .eq('id', modalServicio.servicio.id);
            
            if (error) {
                alert('Error al actualizar servicio: ' + error.message);
            }
        } else {
            const { error } = await supabase
                .from('servicios')
                .insert([datosParaGuardar]);
            
            if (error) {
                alert('Error al crear servicio: ' + error.message);
            }
        }
        
        setGuardando(false);
        setModalServicio({ abierto: false, servicio: null });
        cargarDatos();
    };

    const eliminarEtiqueta = async (id) => {
        if (!window.confirm("¿Eliminar esta etiqueta? Los servicios asociados no se eliminarán.")) return;
        
        const { error } = await supabase
            .from('etiquetas')
            .delete()
            .eq('id', id);
        
        if (error) {
            alert('Error al eliminar etiqueta: ' + error.message);
        } else {
            cargarDatos();
        }
    };

    const eliminarServicio = async (id) => {
        if (!window.confirm("¿Eliminar este servicio permanentemente?")) return;
        
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) {
            alert('Error al eliminar servicio: ' + error.message);
        } else {
            cargarDatos();
        }
    };

    const toggleEtiquetaActiva = async (etiqueta) => {
        await supabase
            .from('etiquetas')
            .update({ activa: !etiqueta.activa })
            .eq('id', etiqueta.id);
        cargarDatos();
    };

    const toggleServicioActivo = async (servicio) => {
        await supabase
            .from('servicios')
            .update({ activa: !servicio.activa })
            .eq('id', servicio.id);
        cargarDatos();
    };

    if (cargando) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="text-slate-400 font-bold animate-pulse">Cargando configuración...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-[98%] mx-auto flex flex-col gap-6 animate-in fade-in pb-20">
            {/* Cabecera */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 gap-6 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-[#0055af] tracking-tight">Etiquetas y Servicios</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Gestiona las categorías y servicios disponibles en Finanzas.</p>
                </div>
            </div>

            {/* Sección de Etiquetas */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Etiquetas (Categorías)</h3>
                    <button
                        onClick={() => abrirModalEtiqueta()}
                        className="px-4 py-2 bg-[#0055af] text-white font-bold text-xs uppercase tracking-wider rounded-full hover:-translate-y-0.5 transition-all shadow-sm"
                    >
                        + Nueva Etiqueta
                    </button>
                </div>
                
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {etiquetas.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-slate-400">
                            No hay etiquetas creadas aún
                        </div>
                    ) : (
                        etiquetas.map(e => (
                            <div key={e.id} className={`p-4 rounded-2xl border-2 transition-all ${e.activa ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div 
                                            className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                            style={{ backgroundColor: e.color }}
                                        />
                                        <span className="font-bold text-sm text-slate-700">{e.nombre}</span>
                                    </div>
                                    <button
                                        onClick={() => toggleEtiquetaActiva(e)}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${e.activa ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${e.activa ? 'left-5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => abrirModalEtiqueta(e)}
                                        className="flex-1 px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:text-[#0055af] hover:bg-blue-50 rounded-lg transition-colors uppercase"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => eliminarEtiqueta(e.id)}
                                        className="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors uppercase"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Sección de Servicios */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Servicios Disponibles</h3>
                    <button
                        onClick={() => abrirModalServicio()}
                        className="px-4 py-2 bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-full hover:-translate-y-0.5 transition-all shadow-sm"
                    >
                        + Nuevo Servicio
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-white border-b border-slate-100 uppercase text-[10px] font-black text-slate-400">
                            <tr>
                                <th className="px-6 py-4">Servicio</th>
                                <th className="px-6 py-4">Etiqueta</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {servicios.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-slate-400 font-medium">
                                        No hay servicios registrados
                                    </td>
                                </tr>
                            ) : (
                                servicios.map(s => (
                                    <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${!s.activa ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-4 font-bold text-sm text-slate-700">{s.nombre}</td>
                                        <td className="px-6 py-4">
                                            {s.etiquetas ? (
                                                <span 
                                                    className="px-3 py-1 rounded-full text-[9px] font-black uppercase text-white"
                                                    style={{ backgroundColor: s.etiquetas.color }}
                                                >
                                                    {s.etiquetas.nombre}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">Sin etiqueta</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleServicioActivo(s)}
                                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${s.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                            >
                                                {s.activa ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center flex justify-center items-center gap-2">
                                            <button 
                                                onClick={() => abrirModalServicio(s)} 
                                                className="text-slate-300 hover:text-[#0055af] bg-transparent hover:bg-blue-50 p-2 rounded-full transition-all"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                onClick={() => eliminarServicio(s.id)} 
                                                className="text-slate-300 hover:text-red-500 bg-transparent hover:bg-red-50 p-2 rounded-full transition-all"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Etiqueta */}
            {modalEtiqueta.abierto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b bg-white flex justify-between items-center">
                            <h2 className="text-xl font-black text-[#0055af]">
                                {modalEtiqueta.etiqueta ? '✏️ Editar Etiqueta' : '🏷️ Nueva Etiqueta'}
                            </h2>
                            <button 
                                onClick={() => setModalEtiqueta({ abierto: false, etiqueta: null })} 
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 font-bold transition-colors"
                            >
                                &times;
                            </button>
                        </div>
                        
                        <form onSubmit={guardarEtiqueta} className="p-6 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formDataEtiqueta.nombre}
                                    onChange={e => setFormDataEtiqueta({ ...formDataEtiqueta, nombre: e.target.value })}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]"
                                    placeholder="Ej: Limpieza, Desinfección..."
                                />
                            </div>
                            
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Color</label>
                                <div className="flex gap-3 items-center">
                                    <input 
                                        type="color" 
                                        value={formDataEtiqueta.color}
                                        onChange={e => setFormDataEtiqueta({ ...formDataEtiqueta, color: e.target.value })}
                                        className="w-12 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                                    />
                                    <input 
                                        type="text" 
                                        value={formDataEtiqueta.color}
                                        onChange={e => setFormDataEtiqueta({ ...formDataEtiqueta, color: e.target.value })}
                                        className="flex-1 border-2 border-slate-100 rounded-xl px-4 py-3 font-mono text-sm bg-white outline-none focus:border-[#0055af]"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-2">
                                <label className="text-sm font-bold text-slate-700">Activa</label>
                                <button
                                    type="button"
                                    onClick={() => setFormDataEtiqueta({ ...formDataEtiqueta, activa: !formDataEtiqueta.activa })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${formDataEtiqueta.activa ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formDataEtiqueta.activa ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </div>
                            
                            <div className="flex justify-end gap-3 mt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setModalEtiqueta({ abierto: false, etiqueta: null })}
                                    className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-full transition-colors text-xs uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={guardando}
                                    className="px-8 py-3 bg-[#0055af] text-white font-black rounded-full hover:-translate-y-1 shadow-lg shadow-[#0055af]/30 transition-all text-xs uppercase tracking-widest border-2 border-[#0055af] hover:border-[#ffdd1c] disabled:opacity-50"
                                >
                                    {guardando ? 'Guardando...' : (modalEtiqueta.etiqueta ? 'Actualizar' : 'Crear')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Servicio */}
            {modalServicio.abierto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b bg-white flex justify-between items-center">
                            <h2 className="text-xl font-black text-[#0055af]">
                                {modalServicio.servicio ? '✏️ Editar Servicio' : '✨ Nuevo Servicio'}
                            </h2>
                            <button 
                                onClick={() => setModalServicio({ abierto: false, servicio: null })} 
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 font-bold transition-colors"
                            >
                                &times;
                            </button>
                        </div>
                        
                        <form onSubmit={guardarServicio} className="p-6 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre del Servicio</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formDataServicio.nombre}
                                    onChange={e => setFormDataServicio({ ...formDataServicio, nombre: e.target.value })}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]"
                                    placeholder="Ej: 🧹 Limpieza Rutinaria"
                                />
                            </div>
                            
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Etiqueta Asociada</label>
                                <select 
                                    value={formDataServicio.etiqueta_id}
                                    onChange={e => setFormDataServicio({ ...formDataServicio, etiqueta_id: e.target.value })}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]"
                                >
                                    <option value="">-- Sin etiqueta --</option>
                                    {etiquetas.filter(e => e.activa).map(e => (
                                        <option key={e.id} value={e.id}>{e.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-2">
                                <label className="text-sm font-bold text-slate-700">Activo</label>
                                <button
                                    type="button"
                                    onClick={() => setFormDataServicio({ ...formDataServicio, activa: !formDataServicio.activa })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${formDataServicio.activa ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formDataServicio.activa ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </div>
                            
                            <div className="flex justify-end gap-3 mt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setModalServicio({ abierto: false, servicio: null })}
                                    className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-full transition-colors text-xs uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={guardando}
                                    className="px-8 py-3 bg-[#0055af] text-white font-black rounded-full hover:-translate-y-1 shadow-lg shadow-[#0055af]/30 transition-all text-xs uppercase tracking-widest border-2 border-[#0055af] hover:border-[#ffdd1c] disabled:opacity-50"
                                >
                                    {guardando ? 'Guardando...' : (modalServicio.servicio ? 'Actualizar' : 'Crear')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}