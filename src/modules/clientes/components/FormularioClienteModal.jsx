import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function FormularioLeadModal({ isOpen, onClose, onLeadGuardado, leadAEditar }) {
    const valoresPorDefecto = {
        nombre: '',
        celular: '',
        direccion: '',
        trabajo_solicitado: '',
        resumen: '',
        imagen: '',
        origen: 'WhatsApp',
        estado: 'Nuevo Lead'
    };

    const [formData, setFormData] = useState(valoresPorDefecto);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (leadAEditar) {
            setFormData({
                nombre: leadAEditar.nombre || '',
                celular: leadAEditar.celular || '',
                direccion: leadAEditar.direccion || '',
                trabajo_solicitado: leadAEditar.trabajo_solicitado || '',
                resumen: leadAEditar.resumen || '',
                imagen: leadAEditar.imagen || '',
                origen: leadAEditar.origen || 'WhatsApp',
                estado: leadAEditar.estado || 'Nuevo Lead'
            });
        } else {
            setFormData(valoresPorDefecto);
        }
    }, [leadAEditar, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);

        let errorAlGuardar;

        if (leadAEditar && leadAEditar.id) {
            const { error } = await supabase.from('clientes').update(formData).eq('id', leadAEditar.id);
            errorAlGuardar = error;
        } else {
            const { error } = await supabase.from('clientes').insert([formData]);
            errorAlGuardar = error;
        }

        setGuardando(false);

        if (errorAlGuardar) {
            alert('Error al guardar el lead.');
            console.error(errorAlGuardar);
        } else {
            onLeadGuardado();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{leadAEditar ? 'Editar Lead' : 'Registrar Nuevo Lead'}</h2>
                        <p className="text-sm text-slate-500">Actualiza la información recolectada.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all focus:outline-none">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <form id="lead-form" onSubmit={handleSubmit} className="flex flex-col gap-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                                <input type="text" name="nombre" value={formData.nombre} required onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Celular *</label>
                                <input type="text" name="celular" value={formData.celular} required onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Completa</label>
                                <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Barrio, Calle, Número..." />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Trabajo Solicitado</label>
                                <input type="text" name="trabajo_solicitado" value={formData.trabajo_solicitado} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej. Limpieza profunda" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Origen</label>
                                <select name="origen" value={formData.origen} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="Botpress">Botpress</option>
                                    <option value="WhatsApp">WhatsApp Manual</option>
                                    <option value="Facebook">Facebook</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                                <select name="estado" value={formData.estado} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="Nuevo Lead">Nuevo Lead</option>
                                    <option value="En negociación">En negociación</option>
                                    <option value="Cotización enviada">Cotización enviada</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">URL de Imagen / Evidencia</label>
                            <input type="url" name="imagen" value={formData.imagen} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://..." />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Resumen IA (Botpress)</label>
                            <textarea name="resumen" value={formData.resumen} onChange={handleChange} rows="3" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                        </div>

                    </form>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 font-medium rounded-lg">Cancelar</button>
                    <button type="submit" form="lead-form" disabled={guardando} className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md disabled:opacity-50">
                        {guardando ? 'Guardando...' : 'Guardar Lead'}
                    </button>
                </div>
            </div>
        </div>
    );
}