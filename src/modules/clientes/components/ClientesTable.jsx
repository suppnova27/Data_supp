import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

export default function LeadsTable({ refreshTrigger, onEditar, onCerrar, onRefrescar }) {
    const [leadsBase, setLeadsBase] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Estados de Filtros y Orden
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('Todos');
    const [filtroOrigen, setFiltroOrigen] = useState('Todos');
    const [ordenColumna, setOrdenColumna] = useState('fecha_creacion');
    const [ordenDireccion, setOrdenDireccion] = useState('desc');

    const fetchLeads = async () => {
        setCargando(true);
        const { data, error } = await supabase
            .from('clientes') // ¡CORREGIDO AQUÍ!
            .select('*')
            .not('cerrado', 'eq', true);

        if (!error) setLeadsBase(data);
        setCargando(false);
    };

    useEffect(() => {
        fetchLeads();
    }, [refreshTrigger]);

    // Lógica de Filtrado y Ordenamiento
    const leadsFiltradosYOrdenados = useMemo(() => {
        let resultado = [...leadsBase];

        if (busqueda) {
            const b = busqueda.toLowerCase();
            resultado = resultado.filter(c =>
                (c.nombre?.toLowerCase() || '').includes(b) ||
                (c.celular || '').includes(b)
            );
        }

        if (filtroEstado !== 'Todos') resultado = resultado.filter(c => c.estado === filtroEstado);
        if (filtroOrigen !== 'Todos') resultado = resultado.filter(c => c.origen === filtroOrigen);

        resultado.sort((a, b) => {
            let vA = a[ordenColumna] || '';
            let vB = b[ordenColumna] || '';
            if (typeof vA === 'string') vA = vA.toLowerCase();
            if (typeof vB === 'string') vB = vB.toLowerCase();

            if (vA < vB) return ordenDireccion === 'asc' ? -1 : 1;
            if (vA > vB) return ordenDireccion === 'asc' ? 1 : -1;
            return 0;
        });

        return resultado;
    }, [leadsBase, busqueda, filtroEstado, filtroOrigen, ordenColumna, ordenDireccion]);

    const cambiarOrden = (columna) => {
        if (ordenColumna === columna) setOrdenDireccion(ordenDireccion === 'asc' ? 'desc' : 'asc');
        else { setOrdenColumna(columna); setOrdenDireccion('asc'); }
    };

    const handleEliminar = async (id, nombre) => {
        if (window.confirm(`¿Estás completamente seguro de eliminar a ${nombre}? Esta acción NO se puede deshacer.`)) {
            const { error } = await supabase.from('clientes').delete().eq('id', id); // ESTO YA ESTABA BIEN
            if (error) {
                alert("Hubo un error al eliminar el lead.");
                console.error(error);
            } else {
                onRefrescar();
            }
        }
    };

    if (cargando) return <div className="p-10 text-center text-slate-500 animate-pulse">Cargando directorio...</div>;

    return (
        <div className="flex flex-col gap-4">
            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <input
                    type="text"
                    placeholder="🔍 Buscar por nombre o celular..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="flex-1 w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="w-full md:w-48 border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Todos">Todos los Estados</option>
                    <option value="Nuevo Lead">Nuevo Lead</option>
                    <option value="En negociación">En negociación</option>
                    <option value="Cotización enviada">Cotización enviada</option>
                    <option value="No responde">No responde</option>
                </select>
                <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value)} className="w-full md:w-48 border border-slate-300 rounded-lg px-4 py-2 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Todos">Todos los Orígenes</option>
                    <option value="Botpress">Botpress</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Referido">Referido</option>
                </select>
            </div>

            {/* Tabla */}
            <div className="w-full overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200 pb-24">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-bold text-slate-500">
                        <tr>
                            <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => cambiarOrden('fecha_creacion')}>Fecha ↕</th>
                            <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => cambiarOrden('nombre')}>Lead ↕</th>
                            <th className="px-4 py-3 text-center">Evidencia</th>
                            <th className="px-4 py-3">Contacto</th>
                            <th className="px-4 py-3">Resumen AI</th>
                            <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => cambiarOrden('origen')}>Origen ↕</th>
                            <th className="px-4 py-3 cursor-pointer hover:bg-slate-100" onClick={() => cambiarOrden('estado')}>Estado ↕</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leadsFiltradosYOrdenados.length === 0 ? (
                            <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No hay leads activos para mostrar.</td></tr>
                        ) : (
                            leadsFiltradosYOrdenados.map((c) => (
                                <tr key={c.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                            {new Date(c.fecha_creacion).toLocaleDateString('es-BO')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 font-medium text-slate-900">
                                        {c.nombre}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {c.imagen ? (
                                            <a href={c.imagen} target="_blank" rel="noopener noreferrer" className="inline-block group relative">
                                                <img
                                                    src={c.imagen}
                                                    alt="Evidencia"
                                                    className="w-8 h-8 rounded-full object-cover border border-slate-300 group-hover:scale-125 transition-transform shadow-sm"
                                                    onError={(e) => e.target.style.display = 'none'}
                                                />
                                            </a>
                                        ) : (
                                            <span className="text-slate-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="font-semibold text-slate-700">{c.celular}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        {c.resumen ? (
                                            <div className="group relative cursor-help inline-block">
                                                <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 w-max">
                                                    <span>🤖</span> Ver Contexto
                                                </span>
                                                <div className="absolute hidden group-hover:block bg-slate-900 text-white p-3 rounded-xl text-xs w-64 z-[100] shadow-xl bottom-full mb-2 left-1/2 -translate-x-1/2">
                                                    <p className="leading-relaxed font-medium">{c.resumen}</p>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 italic text-xs">Sin resumen</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold">{c.origen}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${c.estado === 'Nuevo Lead' ? 'bg-amber-100 text-amber-700' :
                                            c.estado === 'En negociación' ? 'bg-purple-100 text-purple-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                            {c.estado}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => onEditar(c)} title="Editar Datos" className="p-1.5 text-blue-600 hover:bg-blue-100 hover:scale-110 transition-all rounded">✏️</button>
                                            <button onClick={() => onCerrar(c)} title="Archivar Lead" className="p-1.5 text-amber-600 hover:bg-amber-100 hover:scale-110 transition-all rounded">📦</button>
                                            <button onClick={() => handleEliminar(c.id, c.nombre)} title="Eliminar Definitivamente" className="p-1.5 text-red-600 hover:bg-red-100 hover:scale-110 transition-all rounded">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}