import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function InventarioPage() {
    const [productos, setProductos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);

    // ✨ Agregamos stock_minimo a los valores por defecto
    const valoresPorDefecto = { nombre: '', cantidad: '', stock_minimo: 5, unidad_medida: 'Unidades', costo_unitario: '', proveedor_id: '' };
    const [formData, setFormData] = useState(valoresPorDefecto);
    const [editandoId, setEditandoId] = useState(null);

    const fetchDatos = async () => {
        setCargando(true);
        const { data: invData, error } = await supabase.from('inventario').select('*').order('nombre');
        if (!error && invData) setProductos(invData);
        setCargando(false);
    };

    useEffect(() => { fetchDatos(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        const datosAInsertar = {
            nombre: formData.nombre,
            cantidad: parseFloat(formData.cantidad),
            stock_minimo: parseFloat(formData.stock_minimo) || 0, // Guardamos el límite
            unidad_medida: formData.unidad_medida,
            costo_unitario: parseFloat(formData.costo_unitario),
            proveedor_id: formData.proveedor_id || null
        };

        const { error } = editandoId
            ? await supabase.from('inventario').update(datosAInsertar).eq('id', editandoId)
            : await supabase.from('inventario').insert([datosAInsertar]);

        setGuardando(false);
        if (!error) { setModalAbierto(false); setFormData(valoresPorDefecto); fetchDatos(); }
    };

    return (
        <div className="p-4 md:p-8 max-w-[95%] mx-auto flex flex-col gap-6 animate-in fade-in pb-20">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-[#0055af]">Control de Almacén</h1>
                    <p className="text-sm text-slate-500 font-medium">Gestiona tu stock e insumos. Recibe alertas de stock bajo.</p>
                </div>
                <button
                    onClick={() => { setFormData(valoresPorDefecto); setEditandoId(null); setModalAbierto(true); }}
                    className="w-full md:w-auto px-6 py-3 bg-[#0055af] text-white font-black uppercase tracking-widest text-xs rounded-full hover:-translate-y-1 hover:shadow-lg hover:shadow-[#0055af]/30 transition-all border-2 border-[#0055af] hover:border-[#ffdd1c]"
                >
                    + Añadir Producto
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-black text-slate-400">
                        <tr>
                            <th className="px-6 py-4">Producto</th>
                            <th className="px-6 py-4 text-center">Stock Actual</th>
                            <th className="px-6 py-4 text-center hidden sm:table-cell">Límite Mín.</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.map(p => {
                            // Lógica de alerta en la tabla
                            const alertaStock = p.cantidad <= (p.stock_minimo || 0);

                            return (
                                <tr key={p.id} className={`border-b transition-colors ${alertaStock ? 'bg-rose-50/50 hover:bg-rose-100' : 'hover:bg-slate-50'}`}>
                                    <td className="px-6 py-4">
                                        <div className={`font-black ${alertaStock ? 'text-rose-700' : 'text-slate-800'}`}>{p.nombre}</div>
                                        {alertaStock && <span className="text-[9px] font-bold text-rose-600 uppercase tracking-widest">⚠️ Stock Bajo</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold">
                                        <span className={`px-3 py-1.5 rounded-lg border ${alertaStock ? 'bg-rose-100 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                            {p.cantidad} <span className="text-[10px] uppercase opacity-70">{p.unidad_medida}</span>
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center hidden sm:table-cell font-bold text-slate-400">
                                        {p.stock_minimo || 0}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => { setFormData(p); setEditandoId(p.id); setModalAbierto(true); }} className="text-[#0055af] font-bold text-xs bg-[#0055af]/10 px-4 py-2 rounded-full hover:bg-[#0055af] hover:text-white transition-colors shadow-sm">Editar</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {modalAbierto && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden border-t-4 border-t-[#ffdd1c] animate-in zoom-in-95 duration-200">

                        <div className="p-6 border-b bg-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute -right-10 -top-10 w-24 h-24 bg-[#0055af] opacity-5 rounded-full blur-xl"></div>
                            <h2 className="text-xl font-black text-[#0055af] relative z-10">{editandoId ? '✏️ Editar Producto' : '📦 Nuevo Producto'}</h2>
                            <button type="button" onClick={() => setModalAbierto(false)} className="relative z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center font-bold transition-colors">
                                &times;
                            </button>
                        </div>

                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre del Insumo</label>
                                <input type="text" required className="border-2 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#0055af] focus:ring-4 focus:ring-[#0055af]/10 transition-all bg-slate-50 focus:bg-white" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
                            </div>

                            {/* GRILLA DE 3 COLUMNAS PARA INVENTARIO Y ALERTA */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Actual</label>
                                    <input type="number" required className="border-2 rounded-xl px-3 py-3 font-black text-sm outline-none focus:border-[#0055af] text-[#0055af] bg-slate-50 focus:bg-white transition-all text-center" value={formData.cantidad} onChange={e => setFormData({ ...formData, cantidad: e.target.value })} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest pl-1 text-center">Límite Mín.</label>
                                    <input type="number" required className="border-2 border-amber-200 rounded-xl px-3 py-3 font-black text-sm outline-none focus:border-amber-400 text-amber-600 bg-amber-50 focus:bg-white transition-all text-center" value={formData.stock_minimo} onChange={e => setFormData({ ...formData, stock_minimo: e.target.value })} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Unidad</label>
                                    <select className="border-2 rounded-xl px-2 py-3 font-bold text-xs text-slate-700 outline-none focus:border-[#0055af] bg-slate-50 focus:bg-white transition-all" value={formData.unidad_medida} onChange={e => setFormData({ ...formData, unidad_medida: e.target.value })}>
                                        <option value="Unidades">Unid.</option>
                                        <option value="Litros">Litros</option>
                                        <option value="Kg">Kg</option>
                                        <option value="Metros">Metros</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Costo Unitario (Bs)</label>
                                <input type="number" step="0.01" required className="border-2 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#0055af] bg-slate-50 focus:bg-white transition-all" value={formData.costo_unitario} onChange={e => setFormData({ ...formData, costo_unitario: e.target.value })} />
                            </div>
                        </div>

                        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setModalAbierto(false)} className="px-5 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-full transition-colors text-xs uppercase tracking-widest">
                                Cancelar
                            </button>
                            <button type="submit" disabled={guardando} className="px-8 py-3 bg-[#0055af] text-white font-black rounded-full hover:-translate-y-1 shadow-lg shadow-[#0055af]/30 transition-all text-xs uppercase tracking-widest border-2 border-[#0055af] hover:border-[#ffdd1c]">
                                {guardando ? 'Guardando...' : 'Guardar Producto'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}