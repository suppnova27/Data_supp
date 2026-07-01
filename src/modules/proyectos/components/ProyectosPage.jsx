import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import html2canvas from 'html2canvas';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell, LabelList
} from 'recharts';

export default function ProyectosPage() {
    const [finanzas, setFinanzas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [exportandoImg, setExportandoImg] = useState(false);

    const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
    const [clientesSeleccionados, setClientesSeleccionados] = useState([]);
    const [filtroVista, setFiltroVista] = useState('Ambos');

    const graficosRef = useRef(null);
    const COLORES_PIE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

    useEffect(() => {
        const fetchDatosAnalytics = async () => {
            setCargando(true);
            const { data, error } = await supabase
                .from('finanzas')
                .select(`*, clientes (nombres)`)
                .not('cliente_id', 'is', null)
                .not('servicio', 'is', null);

            if (error) {
                console.error("Error al cargar analíticas:", error);
            } else if (data) {
                setFinanzas(data);
            }
            setCargando(false);
        };
        fetchDatosAnalytics();
    }, []);

    const { todosLosProyectos, listasFiltros } = useMemo(() => {
        const agrupados = {};
        const clientesMap = new Map();
        const serviciosSet = new Set();

        finanzas.forEach(mov => {
            const llave = `${mov.cliente_id}-${mov.servicio}`;
            const nombreCliente = mov.clientes?.nombres || 'Cliente Sin Nombre';

            clientesMap.set(mov.cliente_id, nombreCliente);
            serviciosSet.add(mov.servicio);

            if (!agrupados[llave]) {
                agrupados[llave] = {
                    id: llave,
                    cliente_id: mov.cliente_id,
                    nombre: `${nombreCliente.split(' ')[0]} - ${mov.servicio}`,
                    cliente: nombreCliente,
                    servicio: mov.servicio,
                    ingresos: 0, gastos: 0, insumos: [], ultimoMovimiento: 0
                };
            }

            if (mov.tipo === 'Ingreso') agrupados[llave].ingresos += Number(mov.monto);
            if (mov.tipo === 'Gasto') {
                agrupados[llave].gastos += Number(mov.monto);
                if (mov.categoria === 'Materiales/Insumos') agrupados[llave].insumos.push(mov.concepto);
            }
        });

        const proyectos = Object.values(agrupados).map(p => ({
            ...p,
            rentabilidad: p.ingresos - p.gastos,
            margin: p.ingresos > 0 ? Math.round(((p.ingresos - p.gastos) / p.ingresos) * 100) : 0
        }));

        return {
            todosLosProyectos: proyectos,
            listasFiltros: {
                clientes: Array.from(clientesMap, ([id, nombre]) => ({ id, nombre })),
                servicios: Array.from(serviciosSet)
            }
        };
    }, [finanzas]);

    useEffect(() => {
        if (listasFiltros.servicios.length > 0 && serviciosSeleccionados.length === 0) {
            setServiciosSeleccionados(listasFiltros.servicios);
        }
        if (listasFiltros.clientes.length > 0 && clientesSeleccionados.length === 0) {
            setClientesSeleccionados(listasFiltros.clientes.map(c => c.id));
        }
    }, [listasFiltros]);

    const datosFiltrados = useMemo(() => {
        return todosLosProyectos.filter(p =>
            serviciosSeleccionados.includes(p.servicio) &&
            clientesSeleccionados.includes(p.cliente_id)
        );
    }, [todosLosProyectos, serviciosSeleccionados, clientesSeleccionados]);

    const toggleServicio = (servicio) => {
        setServiciosSeleccionados(prev => prev.includes(servicio) ? prev.filter(s => s !== servicio) : [...prev, servicio]);
    };
    const toggleCliente = (id) => {
        setClientesSeleccionados(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
    };

    const metricasGlobales = useMemo(() => {
        let totalIngresos = 0, totalGastos = 0;
        datosFiltrados.forEach(p => { totalIngresos += p.ingresos; totalGastos += p.gastos; });
        return {
            ingresos: totalIngresos,
            gastos: totalGastos,
            neto: totalIngresos - totalGastos,
            margenPromedio: totalIngresos > 0 ? Math.round(((totalIngresos - totalGastos) / totalIngresos) * 100) : 0
        };
    }, [datosFiltrados]);

    const datosPie = useMemo(() => {
        const dist = {};
        datosFiltrados.forEach(p => {
            let valorParaGraficar = 0;
            if (filtroVista === 'Ambos') valorParaGraficar = p.rentabilidad;
            if (filtroVista === 'Ingresos') valorParaGraficar = p.ingresos;
            if (filtroVista === 'Gastos') valorParaGraficar = p.gastos;
            if (valorParaGraficar > 0) dist[p.servicio] = (dist[p.servicio] || 0) + valorParaGraficar;
        });
        return Object.keys(dist).map(name => ({ name, value: dist[name] })).filter(d => d.value > 0);
    }, [datosFiltrados, filtroVista]);

    const exportarGraficosComoImagen = async () => {
        if (!graficosRef.current) return;
        setExportandoImg(true);
        try {
            const canvas = await html2canvas(graficosRef.current, { scale: 2, backgroundColor: '#f8fafc' });
            const enlace = document.createElement('a');
            enlace.download = `Analitica_ORE_${new Date().getTime()}.png`;
            enlace.href = canvas.toDataURL('image/png');
            enlace.click();
        } catch (error) {
            console.error("Error al exportar:", error);
        } finally {
            setExportandoImg(false);
        }
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-5 shadow-2xl border border-slate-100 rounded-2xl z-50">
                    <p className="font-black text-slate-800 border-b border-slate-100 pb-2 mb-3">{data.nombre || data.name}</p>
                    {data.ingresos !== undefined && (
                        <div className="flex flex-col gap-1">
                            {(filtroVista === 'Ambos' || filtroVista === 'Ingresos') && <p className="text-xs text-emerald-600 font-bold flex justify-between gap-4"><span>Ingresos:</span> <span>Bs. {Math.round(data.ingresos).toLocaleString('es-BO')}</span></p>}
                            {(filtroVista === 'Ambos' || filtroVista === 'Gastos') && <p className="text-xs text-red-500 font-bold flex justify-between gap-4"><span>Gastos:</span> <span>Bs. {Math.round(data.gastos).toLocaleString('es-BO')}</span></p>}
                            {filtroVista === 'Ambos' && <p className="text-xs text-blue-600 font-black mt-1 border-t border-slate-100 pt-2 flex justify-between gap-4"><span>Margen:</span> <span>{data.margin}%</span></p>}
                        </div>
                    )}
                    {data.value !== undefined && (
                        <p className="text-xs font-black text-slate-700 mt-2">
                            {filtroVista === 'Ambos' ? 'Rentabilidad' : filtroVista === 'Ingresos' ? 'Ingresos Brutos' : 'Gasto Total'}: Bs. {Math.round(data.value).toLocaleString('es-BO')}
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    const CustomXAxisTick = ({ x, y, payload }) => {
        const partes = payload.value.split(' - ');
        const cliente = partes[0];
        const servicio = partes.slice(1).join(' - ');
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={14} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight="900">{cliente}</text>
                <text x={0} y={0} dy={26} textAnchor="middle" fill="#64748b" fontSize={9} fontWeight="600">{servicio}</text>
            </g>
        );
    };

    if (cargando) return <div className="p-10 text-center text-slate-500 animate-pulse font-bold tracking-widest uppercase">Cargando Analítica...</div>;

    return (
        <div className="p-4 md:p-8 max-w-[98%] mx-auto flex flex-col gap-6 animate-in fade-in duration-500 pb-20" ref={graficosRef}>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-10 translate-x-1/4 opacity-5 pointer-events-none text-9xl">📈</div>
                <div className="relative z-10">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inteligencia de Negocios</h1>
                    <p className="text-sm text-slate-500 mt-1">Descubre qué servicios y clientes generan mayor rentabilidad.</p>
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <select value={filtroVista} onChange={(e) => setFiltroVista(e.target.value)} className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-blue-500 outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm">
                        <option value="Ambos">📊 Vista: Rentabilidad Neta</option>
                        <option value="Ingresos">📈 Vista: Solo Ingresos</option>
                        <option value="Gastos">📉 Vista: Solo Gastos</option>
                    </select>
                    <button onClick={exportarGraficosComoImagen} disabled={exportandoImg || datosFiltrados.length === 0} className="px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                        {exportandoImg ? '📸 Capturando...' : '📸 Exportar Reporte'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`bg-white p-6 rounded-3xl border transition-opacity ${filtroVista === 'Gastos' ? 'opacity-40' : 'border-emerald-100 shadow-sm border-l-4 border-l-emerald-500'}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Ingresos</p>
                    <p className="text-3xl font-black text-emerald-600 mt-2">Bs. {Math.round(metricasGlobales.ingresos).toLocaleString('es-BO')}</p>
                </div>
                <div className={`bg-white p-6 rounded-3xl border transition-opacity ${filtroVista === 'Ingresos' ? 'opacity-40' : 'border-red-100 shadow-sm border-l-4 border-l-red-500'}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Gastos</p>
                    <p className="text-3xl font-black text-red-600 mt-2">Bs. {Math.round(metricasGlobales.gastos).toLocaleString('es-BO')}</p>
                </div>
                <div className={`bg-white p-6 rounded-3xl border shadow-sm border-l-4 ${metricasGlobales.neto >= 0 ? 'border-blue-100 border-l-blue-500' : 'border-amber-100 border-l-amber-500'}`}>
                    <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rentabilidad Neta</p>
                        <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-600">Margen: {metricasGlobales.margenPromedio}%</span>
                    </div>
                    <p className={`text-3xl font-black mt-1 ${metricasGlobales.neto >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                        Bs. {Math.round(metricasGlobales.neto).toLocaleString('es-BO')}
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
                    <span className="text-xl">🎛️</span>
                    <h2 className="font-black text-slate-800 tracking-tight">Filtros de Análisis</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Seleccionar Clientes</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {listasFiltros.clientes.map(cliente => (
                                <label key={cliente.id} className="flex items-center gap-3 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <input type="checkbox" checked={clientesSeleccionados.includes(cliente.id)} onChange={() => toggleCliente(cliente.id)} className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer" />
                                    <span className="text-xs font-bold text-slate-800 truncate">{cliente.nombre}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Seleccionar Servicios</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {listasFiltros.servicios.map(servicio => (
                                <label key={servicio} className="flex items-center gap-3 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <input type="checkbox" checked={serviciosSeleccionados.includes(servicio)} onChange={() => toggleServicio(servicio)} className="w-4 h-4 rounded text-blue-600 border-slate-300 cursor-pointer" />
                                    <span className="text-xs font-bold text-slate-800 truncate">{servicio}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-xs font-black text-slate-800 mb-6 text-center">Gráfico Comparativo</h3>
                    <div className="h-[350px] w-full overflow-x-auto custom-scrollbar">
                        <div style={{ width: `${Math.max(100, datosFiltrados.length * 15)}%`, minWidth: '100%', height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={datosFiltrados} margin={{ top: 20, right: 10, left: -20, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={<CustomXAxisTick />} interval={0} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                                    {(filtroVista === 'Ambos' || filtroVista === 'Ingresos') && (
                                        <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[6, 6, 0, 0]} />
                                    )}
                                    {(filtroVista === 'Ambos' || filtroVista === 'Gastos') && (
                                        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[6, 6, 0, 0]} />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-xs font-black text-slate-800 mb-6 text-center">Distribución</h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 0, bottom: 30, left: 0 }}>
                                <Pie data={datosPie} cx="50%" cy="50%" innerRadius={50} outerRadius={110} paddingAngle={4} dataKey="value" stroke="none">
                                    {datosPie.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}