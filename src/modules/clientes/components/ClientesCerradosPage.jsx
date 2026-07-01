import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';

export default function ClientesCerradosPage() {
    const [cerradosBase, setCerradosBase] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [exportando, setExportando] = useState(false);

    const [busqueda, setBusqueda] = useState('');
    const [filtroMotivo, setFiltroMotivo] = useState('Todos');

    const fetchCerrados = async () => {
        setCargando(true);
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('cerrado', true)
            .order('fecha_creacion', { ascending: false });

        if (!error) setCerradosBase(data);
        setCargando(false);
    };

    useEffect(() => { fetchCerrados(); }, []);

    const cerradosFiltrados = useMemo(() => {
        let resultado = [...cerradosBase];

        if (busqueda) {
            const b = busqueda.toLowerCase();
            resultado = resultado.filter(c =>
                // CAMBIO: Adaptado a c.nombres
                (c.nombres?.toLowerCase() || '').includes(b)
            );
        }

        if (filtroMotivo !== 'Todos') {
            resultado = resultado.filter(c => c.motivo_cierre === filtroMotivo);
        }

        return resultado;
    }, [cerradosBase, busqueda, filtroMotivo]);

    const handleReabrir = async (id, nombres) => {
        if (window.confirm(`¿Deseas reabrir el expediente de ${nombres}? Volverá al Pipeline de Leads Activos.`)) {
            const { error } = await supabase
                .from('clientes')
                .update({
                    cerrado: false,
                    motivo_cierre: null,
                    estado: 'Nuevo Lead'
                })
                .eq('id', id);

            if (error) alert("Error al reabrir el lead.");
            else fetchCerrados();
        }
    };

    const handleEliminar = async (id, nombres) => {
        if (window.confirm(`ADVERTENCIA: ¿Eliminar a ${nombres} permanentemente? Se borrarán todos sus registros históricos.`)) {
            const { error } = await supabase.from('clientes').delete().eq('id', id);
            if (error) alert("Error al eliminar.");
            else fetchCerrados();
        }
    };

    const exportarFiltradosAExcel = () => {
        setExportando(true);
        const datosParaExportar = cerradosFiltrados.map(c => ({
            // CAMBIO: Nombres de columnas actualizados a la base de datos SQL
            'Cliente': c.nombres,
            'Teléfono': c.telefono || 'Sin teléfono',
            'Dirección': c.calle_avenida || '-',
            'Trabajo Realizado': c.trabajo_realizado || 'Por definir',
            'Motivo de Cierre': c.motivo_cierre || 'No especificado',
            'Estado Final': c.estado,
            'Fecha de Registro': new Date(c.fecha_creacion).toLocaleDateString('es-BO')
        }));

        const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads Archivados");
        XLSX.writeFile(workbook, `Historial_Leads_Cerrados.xlsx`);
        setExportando(false);
    };

    return (
        <div className="p-8 max-w-[95%] mx-auto flex flex-col gap-6 animate-in fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Historial de Leads Cerrados</h1>
                    <p className="text-sm text-slate-500 mt-1">Consulta los motivos de cierre y recupera prospectos.</p>
                </div>
                <button
                    onClick={exportarFiltradosAExcel}
                    disabled={exportando || cerradosFiltrados.length === 0}
                    className="px-5 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {exportando ? '⏳ Generando...' : '📊 Exportar Vista Actual'}
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="🔍 Buscar por nombre..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                    value={filtroMotivo}
                    onChange={(e) => setFiltroMotivo(e.target.value)}
                    className="w-full md:w-64 border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="Todos">Todos los Motivos</option>
                    <option value="Venta concretada">Venta concretada</option>
                    <option value="Perdido por precio">Perdido por precio</option>
                    <option value="Perdido por competencia">Perdido por competencia</option>
                    <option value="No responde / Desistió">No responde / Desistió</option>
                </select>
            </div>

            <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {cargando ? (
                    <div className="p-10 text-center text-slate-400 animate-pulse font-bold tracking-widest uppercase">Consultando archivos...</div>
                ) : (
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-bold text-slate-500 tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Lead / Cliente</th>
                                <th className="px-6 py-4">Servicio Realizado</th>
                                <th className="px-6 py-4">Motivo de Cierre</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {cerradosFiltrados.length === 0 ? (
                                <tr><td colSpan="4" className="p-12 text-center text-slate-400 italic">No hay registros que coincidan con la búsqueda.</td></tr>
                            ) : (
                                cerradosFiltrados.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            {/* CAMBIO: Renderizamos c.nombres en lugar de c.nombre */}
                                            <div className="font-bold text-slate-800 text-base">{c.nombres}</div>
                                            <div className="text-[10px] text-slate-400 font-bold tracking-wider mt-1 flex items-center gap-2">
                                                {/* CAMBIO: Renderizamos c.telefono en lugar de c.celular */}
                                                <span>📱 {c.telefono}</span>
                                                <span>•</span>
                                                <span className="uppercase">{new Date(c.fecha_creacion).toLocaleDateString('es-BO')}</span>
                                            </div>
                                        </td>
                                        {/* CAMBIO: Renderizamos c.trabajo_realizado */}
                                        <td className="px-6 py-4 text-xs font-semibold">{c.trabajo_realizado || <span className="italic text-slate-400">Por definir</span>}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${c.motivo_cierre === 'Venta concretada'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-rose-100 text-rose-700'
                                                }`}>
                                                {c.motivo_cierre || 'Cerrado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {/* CAMBIO: Pasamos c.nombres */}
                                                <button
                                                    onClick={() => handleReabrir(c.id, c.nombres)}
                                                    title="Reabrir / Activar Lead"
                                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-1.5"
                                                >
                                                    🔄 Reabrir
                                                </button>
                                                <button
                                                    onClick={() => handleEliminar(c.id, c.nombres)}
                                                    title="Eliminar permanentemente"
                                                    className="px-3 py-2 text-rose-400 hover:text-white hover:bg-rose-500 rounded-lg transition-all"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}