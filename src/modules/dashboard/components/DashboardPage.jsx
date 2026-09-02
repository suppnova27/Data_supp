import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

export default function DashboardPage() {
    const [datos, setDatos] = useState({ clientes: [], finanzas: [], inventario: [], servicios: [], etiquetas: [], finanza_servicios: [] });
    const [cargando, setCargando] = useState(true);

    const COLORES_PIE = ['#0055af', '#ffdd1c', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#ef4444'];

    useEffect(() => {
        const cargarTodo = async () => {
            setCargando(true);
            const [resClientes, resFinanzas, resInventario, resServicios, resEtiquetas, resFinanzaServicios] = await Promise.all([
                supabase.from('clientes').select('*'),
                supabase.from('finanzas').select('*').order('fecha_registro', { ascending: false }),
                supabase.from('inventario').select('*'),
                supabase.from('servicios').select('id, nombre, etiqueta_id'),
                supabase.from('etiquetas').select('id, nombre, color'),
                supabase.from('finanza_servicios').select('finanza_id, servicio_id')
            ]);

            setDatos({
                clientes: resClientes.data || [],
                finanzas: resFinanzas.data || [],
                inventario: resInventario.data || [],
                servicios: resServicios.data || [],
                etiquetas: resEtiquetas.data || [],
                finanza_servicios: resFinanzaServicios.data || []
            });
            setCargando(false);
        };

        cargarTodo();
    }, []);

    const kpis = useMemo(() => {
        let ingresosTotales = 0;
        let gastosTotales = 0;

        datos.finanzas.forEach(f => {
            if (f.tipo === 'Ingreso') ingresosTotales += Number(f.monto);
            if (f.tipo === 'Gasto') gastosTotales += Number(f.monto);
        });

        const clientesActivos = datos.clientes.filter(c => !c.cerrado).length;
        const ventasConcretadas = datos.clientes.filter(c => c.cerrado && c.motivo_cierre === 'Venta concretada').length;

        return {
            ingresos: ingresosTotales,
            gastos: gastosTotales,
            neto: ingresosTotales - gastosTotales,
            clientesActivos,
            ventasConcretadas,
            margen: ingresosTotales > 0 ? Math.round(((ingresosTotales - gastosTotales) / ingresosTotales) * 100) : 0
        };
    }, [datos]);

    const ingresosPorServicio = useMemo(() => {
        const mapa = {};
        const fsMap = {};
        datos.finanza_servicios.forEach(fs => {
            if (!fsMap[fs.finanza_id]) fsMap[fs.finanza_id] = [];
            fsMap[fs.finanza_id].push(fs.servicio_id);
        });

        const serviciosMap = {};
        datos.servicios.forEach(s => { serviciosMap[s.id] = s.nombre; });

        datos.finanzas.filter(f => f.tipo === 'Ingreso').forEach(f => {
            const serviciosVinculados = fsMap[f.id] || [];
            if (serviciosVinculados.length > 0) {
                const montoPorServicio = Number(f.monto) / serviciosVinculados.length;
                serviciosVinculados.forEach(sid => {
                    const nombre = serviciosMap[sid] || 'Servicio desconocido';
                    mapa[nombre] = (mapa[nombre] || 0) + montoPorServicio;
                });
            } else if (f.servicio) {
                mapa[f.servicio] = (mapa[f.servicio] || 0) + Number(f.monto);
            }
        });
        return Object.entries(mapa)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [datos.finanzas, datos.finanza_servicios, datos.servicios]);

    const ingresosPorEtiqueta = useMemo(() => {
        const mapa = {};
        const fsMap = {};
        datos.finanza_servicios.forEach(fs => {
            if (!fsMap[fs.finanza_id]) fsMap[fs.finanza_id] = [];
            fsMap[fs.finanza_id].push(fs.servicio_id);
        });

        const serviciosMap = {};
        const servicioEtiquetaMap = {}; // nombre de servicio -> etiqueta_id
        datos.servicios.forEach(s => {
            serviciosMap[s.id] = s.etiqueta_id;
            if (s.etiqueta_id) servicioEtiquetaMap[s.nombre] = s.etiqueta_id;
        });
        const etiquetasMap = {};
        datos.etiquetas.forEach(e => { etiquetasMap[e.id] = e.nombre; });

        // Deducir etiqueta de un movimiento SIN servicios vinculados:
        // 1) etiqueta directa del movimiento (finanzas.etiqueta_id)
        // 2) nombre completo del servicio en el catálogo
        // 3) base del nombre ("Servicio - Detalle") sin prefijo decorativo (emoji)
        const etiquetaDeMovimiento = (f) => {
            if (f.etiqueta_id) return f.etiqueta_id;
            if (!f.servicio) return null;
            const limpio = String(f.servicio).trim();
            if (servicioEtiquetaMap[limpio]) return servicioEtiquetaMap[limpio];
            const base = limpio.split(' - ')[0].trim();
            if (servicioEtiquetaMap[base]) return servicioEtiquetaMap[base];
            const sinPrefijo = base.replace(/^[^\p{L}\p{N}]+/u, '').trim();
            return servicioEtiquetaMap[sinPrefijo] || null;
        };

        datos.finanzas.filter(f => f.tipo === 'Ingreso').forEach(f => {
            const serviciosVinculados = fsMap[f.id] || [];
            if (serviciosVinculados.length > 0) {
                const montoPorServicio = Number(f.monto) / serviciosVinculados.length;
                serviciosVinculados.forEach(sid => {
                    const etiquetaId = serviciosMap[sid];
                    const etiquetaNombre = etiquetaId ? (etiquetasMap[etiquetaId] || 'Sin Etiqueta') : 'Sin Etiqueta';
                    mapa[etiquetaNombre] = (mapa[etiquetaNombre] || 0) + montoPorServicio;
                });
            } else {
                const etiquetaId = etiquetaDeMovimiento(f);
                const etiquetaNombre = etiquetaId ? (etiquetasMap[etiquetaId] || 'Sin Etiqueta') : 'Sin Etiqueta';
                mapa[etiquetaNombre] = (mapa[etiquetaNombre] || 0) + Number(f.monto);
            }
        });
        return Object.entries(mapa)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [datos.finanzas, datos.finanza_servicios, datos.servicios, datos.etiquetas]);

    const flujoDeCaja = useMemo(() => {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dataMeses = meses.map(m => ({ nombre: m, ingresos: 0, gastos: 0 }));
        const añoActual = new Date().getFullYear();

        datos.finanzas.forEach(f => {
            if (!f.fecha_registro) return;
            const match = String(f.fecha_registro).match(/^(\d{4})-(\d{2})-(\d{2})/);
            let anio, mesIndex;
            if (match) {
                anio = Number(match[1]);
                mesIndex = Number(match[2]) - 1;
            } else {
                const fecha = new Date(f.fecha_registro);
                anio = fecha.getFullYear();
                mesIndex = fecha.getMonth();
            }

            if (anio === añoActual && mesIndex >= 0 && mesIndex < 12) {
                if (f.tipo === 'Ingreso') dataMeses[mesIndex].ingresos += Number(f.monto);
                if (f.tipo === 'Gasto') dataMeses[mesIndex].gastos += Number(f.monto);
            }
        });

        const mesActualIndex = new Date().getMonth();
        return dataMeses.slice(0, mesActualIndex + 1);
    }, [datos.finanzas]);

    const embudoClientes = useMemo(() => {
        const estados = {};
        datos.clientes.filter(c => !c.cerrado).forEach(c => {
            estados[c.estado] = (estados[c.estado] || 0) + 1;
        });
        return Object.keys(estados).map(key => ({ name: key, value: estados[key] }));
    }, [datos.clientes]);

    const alertasStock = useMemo(() => {
        return datos.inventario.filter(item => item.cantidad <= (item.stock_minimo || 0));
    }, [datos.inventario]);

    const movimientosRecientes = useMemo(() => {
        return datos.finanzas.slice(0, 5);
    }, [datos.finanzas]);

    if (cargando) return <div className="p-10 text-center text-[#0055af] font-black tracking-widest uppercase animate-pulse">Sincronizando Módulos...</div>;

    return (
        <div className="p-4 md:p-8 max-w-[99%] mx-auto flex flex-col gap-6 animate-in fade-in duration-500 pb-20">

            {/* BANNER EJECUTIVO */}
            <div className="bg-gradient-to-r from-[#003d80] to-[#0055af] rounded-3xl p-8 md:p-10 text-white shadow-xl shadow-[#0055af]/20 relative overflow-hidden">
                <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-[#ffdd1c] opacity-20 rounded-full blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-white">Resumen Ejecutivo</h1>
                        <p className="text-blue-200 font-medium max-w-xl text-sm md:text-base">
                            Monitoreo en tiempo real de operaciones, finanzas e inventario.
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full flex items-center gap-3 shadow-lg">
                        <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></span>
                        <span className="font-bold text-sm tracking-widest uppercase">Sistema En Línea</span>
                    </div>
                </div>
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 opacity-10 pointer-events-none">
                    <svg width="400" height="400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                </div>
            </div>

            {/* KPIs PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-2 h-full bg-emerald-500 group-hover:w-3 transition-all"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Flujo de Caja Neto</p>
                    <p className={`text-3xl font-black mt-2 ${kpis.neto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Bs. {Math.round(kpis.neto).toLocaleString('es-BO')}
                    </p>
                    <div className="mt-3 bg-slate-50 px-3 py-1.5 rounded-lg w-max border border-slate-100">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider">Margen: <span className="text-[#0055af]">{kpis.margen}%</span></p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-2 h-full bg-[#0055af] group-hover:w-3 transition-all"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingresos Totales</p>
                    <p className="text-3xl font-black text-slate-800 mt-2">Bs. {Math.round(kpis.ingresos).toLocaleString('es-BO')}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-2 h-full bg-[#ffdd1c] group-hover:w-3 transition-all"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas Exitosas</p>
                    <p className="text-3xl font-black text-[#0055af] mt-2">{kpis.ventasConcretadas}</p>
                    <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-widest">Histórico Acumulado</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-2 h-full bg-amber-500 group-hover:w-3 transition-all"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Leads Activos</p>
                    <p className="text-3xl font-black text-amber-500 mt-2">{kpis.clientesActivos}</p>
                    <p className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-widest">En Negociación</p>
                </div>
            </div>

            {/* SECCIÓN GRÁFICOS FINANCIEROS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* GRÁFICO DE LÍNEAS */}
                <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col min-w-0 overflow-hidden">
                    <h3 className="text-xs font-black text-[#0055af] uppercase tracking-widest mb-6 flex items-center gap-2">
                        <span className="text-lg">📈</span> Rendimiento Financiero ({new Date().getFullYear()})
                    </h3>

                    <div className="w-full h-[300px] min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <LineChart data={flujoDeCaja} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                    formatter={(value) => `Bs. ${Math.round(value).toLocaleString('es-BO')}`}
                                />
                                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                                <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* GRÁFICO EMBUDO */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col min-w-0 overflow-hidden">
                    <h3 className="text-xs font-black text-[#0055af] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="text-lg">🎯</span> Embudo de Ventas
                    </h3>
                    <div className="w-full h-[250px] flex justify-center mt-2 min-w-0">
                        {embudoClientes.length === 0 ? (
                            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400 font-bold italic">No hay clientes activos.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart>
                                    <Pie data={embudoClientes} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                                        {embudoClientes.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value) => `${value} prospectos`} />
                                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN ANÁLISIS DE SERVICIOS Y ETIQUETAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* GRÁFICO INGRESOS POR SERVICIO */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col min-w-0 overflow-hidden">
                    <h3 className="text-xs font-black text-[#0055af] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="text-lg">🧹</span> Ingresos por Servicio
                    </h3>
                    <div className="w-full h-[280px] flex justify-center min-w-0">
                        {ingresosPorServicio.length === 0 ? (
                            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400 font-bold italic">Sin datos de servicios aún.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart>
                                    <Pie data={ingresosPorServicio} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name" label={({ name, percent }) => `${name.length > 15 ? name.slice(0, 15) + '…' : name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {ingresosPorServicio.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value) => `Bs. ${value.toLocaleString('es-BO')}`} />
                                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* GRÁFICO INGRESOS POR ETIQUETA */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col min-w-0 overflow-hidden">
                    <h3 className="text-xs font-black text-[#0055af] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="text-lg">🏷️</span> Ingresos por Etiqueta
                    </h3>
                    <div className="w-full h-[280px] flex justify-center min-w-0">
                        {ingresosPorEtiqueta.length === 0 ? (
                            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400 font-bold italic">Sin datos de etiquetas aún.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart>
                                    <Pie data={ingresosPorEtiqueta} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {ingresosPorEtiqueta.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value) => `Bs. ${value.toLocaleString('es-BO')}`} />
                                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN ALERTAS Y ÚLTIMOS MOVIMIENTOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* WIDGET DE ALERTA DE INVENTARIO */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div className="p-5 border-b border-slate-100 bg-rose-50 flex justify-between items-center">
                        <h3 className="text-xs font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                            <span className="text-base animate-bounce">⚠️</span> Alertas de Inventario
                        </h3>
                        <span className="px-3 py-1 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-600/30">
                            {alertasStock.length} Críticos
                        </span>
                    </div>
                    <div className="p-3 flex-1 overflow-y-auto max-h-[320px] custom-scrollbar">
                        {alertasStock.length === 0 ? (
                            <div className="p-10 flex flex-col items-center justify-center text-center gap-2">
                                <span className="text-4xl">✅</span>
                                <p className="text-sm text-emerald-600 font-black uppercase tracking-widest mt-2">Almacén Abastecido</p>
                                <p className="text-xs text-slate-400 font-medium">Ningún producto está por debajo de su límite.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {alertasStock.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-4 bg-white hover:bg-rose-50 rounded-2xl border border-slate-100 hover:border-rose-200 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform">!</div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm group-hover:text-rose-700 transition-colors">{item.nombre}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Límite mínimo requerido: {item.stock_minimo}</p>
                                            </div>
                                        </div>
                                        <div className="text-right bg-rose-50 px-4 py-2 rounded-xl border border-rose-100">
                                            <p className="font-black text-rose-600 text-xl leading-none">{item.cantidad}</p>
                                            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-1">{item.unidad_medida}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* WIDGET ÚLTIMOS MOVIMIENTOS FINANCIEROS */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h3 className="text-xs font-black text-[#0055af] uppercase tracking-widest flex items-center gap-2">
                            <span className="text-base">💸</span> Últimos Movimientos
                        </h3>
                    </div>
                    <div className="p-3 flex-1 overflow-y-auto max-h-[320px] custom-scrollbar">
                        {movimientosRecientes.length === 0 ? (
                            <div className="p-10 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                                <span className="text-3xl">📭</span>
                                <p className="text-xs font-black uppercase tracking-widest mt-2">Sin Movimientos</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {movimientosRecientes.map(mov => (
                                    <div key={mov.id} className="flex justify-between items-center p-4 hover:bg-slate-50 rounded-2xl border border-slate-50 hover:border-slate-100 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-2 h-10 rounded-full shadow-sm ${mov.tipo === 'Ingreso' ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-rose-400 shadow-rose-400/50'}`}></div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm truncate max-w-[200px]">{mov.concepto}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase">{new Date(mov.fecha_registro).toLocaleDateString('es-BO')}</span>
                                                    <span className="text-[9px] font-black text-[#0055af] bg-[#0055af]/10 px-2 py-0.5 rounded-md uppercase truncate max-w-[100px]">{mov.categoria || 'General'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`text-right font-black text-lg ${mov.tipo === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {mov.tipo === 'Ingreso' ? '+' : '-'}Bs. {Math.round(Number(mov.monto)).toLocaleString('es-BO')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}