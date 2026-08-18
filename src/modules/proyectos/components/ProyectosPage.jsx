import { useState, useEffect, useMemo, useRef, Fragment as FragmentProyecto } from 'react';
import { supabase } from '../../../lib/supabase';
import html2canvas from 'html2canvas';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const obtenerFechaHoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ProyectosPage() {
    const [finanzas, setFinanzas] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [exportandoImg, setExportandoImg] = useState(false);

    const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
    const [clientesSeleccionados, setClientesSeleccionados] = useState([]);
    const [filtroVista, setFiltroVista] = useState('Ambos');
    const [proyectoDetalleAbierto, setProyectoDetalleAbierto] = useState(null);

    // Filtro de período (mismo patrón que Finanzas): 'Día' | 'Mes' | 'Año'
    const [filtroTipoPeriodo, setFiltroTipoPeriodo] = useState('Mes');
    const [filtroFechaDia, setFiltroFechaDia] = useState(obtenerFechaHoyISO());
    const [filtroFechaDiaHasta, setFiltroFechaDiaHasta] = useState(obtenerFechaHoyISO());
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
    const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());

    const graficosRef = useRef(null);
    const COLORES_PIE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e'];

    useEffect(() => {
        const fetchDatosAnalytics = async () => {
            setCargando(true);
            const [resFinanzas, resCuentas] = await Promise.all([
                supabase
                    .from('finanzas')
                    .select(`*, clientes (nombres, apellido_paterno, trabajo_realizado)`),
                supabase
                    .from('directorio_cuentas')
                    .select(`*`)
            ]);

            if (resFinanzas.data) {
                setFinanzas(resFinanzas.data);

                // Inicializar filtros seleccionados por defecto con todos los datos
                const clientIds = [];
                const serviceNames = new Set();
                resFinanzas.data.forEach(mov => {
                    if (mov.cliente_id) {
                        clientIds.push(mov.cliente_id);
                        const sName = mov.clientes?.trabajo_realizado || mov.servicio || 'Servicio';
                        if (sName && !sName.toLowerCase().startsWith('sueldo:')) {
                            serviceNames.add(sName);
                        }
                    }
                });
                setClientesSeleccionados(Array.from(new Set(clientIds)));
                setServiciosSeleccionados(Array.from(serviceNames));
            }
            if (resCuentas.data) setCuentas(resCuentas.data);
            setCargando(false);
        };
        fetchDatosAnalytics();
    }, []);

    // Filtrado por período (Día/Mes/Año) — alimenta TODA la analítica
    const finanzasFiltradas = useMemo(() => {
        return finanzas.filter(f => {
            if (!f.fecha_registro) return false;
            const match = String(f.fecha_registro).match(/^(\d{4})-(\d{2})-(\d{2})/);
            let mes, anio, dia;
            if (match) {
                anio = Number(match[1]);
                mes = Number(match[2]);
                dia = Number(match[3]);
            } else {
                const fecha = new Date(f.fecha_registro);
                anio = fecha.getFullYear();
                mes = fecha.getMonth() + 1;
                dia = fecha.getDate();
            }

            if (filtroTipoPeriodo === 'Día') {
                // Rango de fechas: desde hasta (ambos inclusive). Si desde > hasta se invierte automáticamente.
                const desde = String(filtroFechaDia).split('-').map(Number);
                const hasta = String(filtroFechaDiaHasta).split('-').map(Number);
                const [inicio, fin] = (filtroFechaDia <= filtroFechaDiaHasta) ? [desde, hasta] : [hasta, desde];
                const fechaReg = [anio, mes, dia];
                return (
                    (fechaReg[0] > inicio[0] || (fechaReg[0] === inicio[0] && (fechaReg[1] > inicio[1] || (fechaReg[1] === inicio[1] && fechaReg[2] >= inicio[2])))) &&
                    (fechaReg[0] < fin[0] || (fechaReg[0] === fin[0] && (fechaReg[1] < fin[1] || (fechaReg[1] === fin[1] && fechaReg[2] <= fin[2]))))
                );
            }
            if (filtroTipoPeriodo === 'Año') {
                return anio === Number(filtroAnio);
            }
            // Mes
            return mes === Number(filtroMes) && anio === Number(filtroAnio);
        });
    }, [finanzas, filtroTipoPeriodo, filtroFechaDia, filtroFechaDiaHasta, filtroMes, filtroAnio]);

    // 1. Agrupamiento de Proyectos (por Cliente)
    const { todosLosProyectos, listasFiltros } = useMemo(() => {
        const agrupados = {};
        const clientesMap = new Map();
        const serviciosSet = new Set();

        finanzasFiltradas.forEach(mov => {
            if (!mov.cliente_id) return;

            const clienteId = mov.cliente_id;
            const nombreCliente = mov.clientes 
                ? `${mov.clientes.nombres || ''} ${mov.clientes.apellido_paterno || ''}`.trim() 
                : 'Cliente Sin Nombre';
            const servicioProyecto = mov.clientes?.trabajo_realizado || mov.servicio || 'Servicio';

            clientesMap.set(clienteId, nombreCliente);
            if (servicioProyecto && !servicioProyecto.toLowerCase().startsWith('sueldo:')) {
                serviciosSet.add(servicioProyecto);
            }

            if (!agrupados[clienteId]) {
                agrupados[clienteId] = {
                    id: clienteId,
                    cliente_id: clienteId,
                    nombre: `${nombreCliente} - ${servicioProyecto}`,
                    cliente: nombreCliente,
                    servicio: servicioProyecto,
                    ingresos: 0,
                    gastos: 0,
                    insumos: [],
                    ultimoMovimiento: 0
                };
            }

            if (mov.tipo === 'Ingreso') {
                agrupados[clienteId].ingresos += Number(mov.monto);
            }
            if (mov.tipo === 'Gasto') {
                agrupados[clienteId].gastos += Number(mov.monto);
                if (mov.categoria === 'Materiales/Insumos') {
                    agrupados[clienteId].insumos.push(mov.concepto);
                }
            }
        });

        const proyectos = Object.values(agrupados).map(p => ({
            ...p,
            rentabilidad: p.ingresos - p.gastos,
            margen: p.ingresos > 0 ? Math.round(((p.ingresos - p.gastos) / p.ingresos) * 100) : 0
        }));

        return {
            todosLosProyectos: proyectos,
            listasFiltros: {
                clientes: Array.from(clientesMap, ([id, nombre]) => ({ id, nombre })),
                servicios: Array.from(serviciosSet)
            }
        };
    }, [finanzasFiltradas]);

    // Proyectos filtrados (Con fallback robusto para que no se quede vacío)
    const datosFiltrados = useMemo(() => {
        const fallbackServicios = serviciosSeleccionados.length === 0;
        const fallbackClientes = clientesSeleccionados.length === 0;

        return todosLosProyectos.filter(p =>
            (fallbackServicios || serviciosSeleccionados.includes(p.servicio)) &&
            (fallbackClientes || clientesSeleccionados.includes(p.cliente_id))
        );
    }, [todosLosProyectos, serviciosSeleccionados, clientesSeleccionados]);

    // 2. Analítica de Servicios (Ganancia / Pérdida por Tipo de Servicio)
    const serviciosAnalytics = useMemo(() => {
        const services = {};

        finanzasFiltradas.forEach(mov => {
            let servicio = 'Otros / Operaciones';
            if (mov.cliente_id && mov.clientes?.trabajo_realizado) {
                servicio = mov.clientes.trabajo_realizado;
            } else if (mov.servicio) {
                if (mov.servicio.toLowerCase().startsWith('sueldo:')) {
                    return;
                }
                servicio = mov.servicio;
            }

            if (!services[servicio]) {
                services[servicio] = {
                    nombre: servicio,
                    ingresos: 0,
                    gastos: 0,
                    rentabilidad: 0
                };
            }

            if (mov.tipo === 'Ingreso') {
                services[servicio].ingresos += Number(mov.monto);
            } else if (mov.tipo === 'Gasto') {
                services[servicio].gastos += Number(mov.monto);
            }
        });

        return Object.values(services).map(s => ({
            ...s,
            rentabilidad: s.ingresos - s.gastos
        }));
    }, [finanzasFiltradas]);

    // 3. Distribución de Ingresos
    const distribucionIngresos = useMemo(() => {
        const dist = {};
        finanzasFiltradas.forEach(mov => {
            if (mov.tipo === 'Ingreso') {
                let servicio = 'Otros';
                if (mov.cliente_id && mov.clientes?.trabajo_realizado) {
                    servicio = mov.clientes.trabajo_realizado;
                } else if (mov.servicio) {
                    servicio = mov.servicio;
                }
                dist[servicio] = (dist[servicio] || 0) + Number(mov.monto);
            }
        });
        return Object.keys(dist).map(name => ({ name, value: dist[name] })).filter(d => d.value > 0);
    }, [finanzasFiltradas]);

    // 4. Distribución de Gastos
    const distribucionGastos = useMemo(() => {
        const dist = {};
        finanzasFiltradas.forEach(mov => {
            if (mov.tipo === 'Gasto') {
                const cat = mov.categoria || 'Otros Gastos';
                dist[cat] = (dist[cat] || 0) + Number(mov.monto);
            }
        });
        return Object.keys(dist).map(name => ({ name, value: dist[name] })).filter(d => d.value > 0);
    }, [finanzasFiltradas]);

    // 5. Analítica de Personal (Costo Sueldo vs Ingreso de Proyecto Asociado)
    const personalAnalytics = useMemo(() => {
        const data = {};

        cuentas.filter(c => c.tipo === 'Personal').forEach(p => {
            data[p.alias] = {
                nombre: p.alias,
                costo: 0,
                ingresoAsociado: 0
            };
        });

        finanzasFiltradas.forEach(mov => {
            const esPagoPersonal = mov.tipo === 'Gasto' && (
                mov.categoria === 'Nómina y Salarios' || 
                (mov.servicio && mov.servicio.toLowerCase().startsWith('sueldo:'))
            );
            if (esPagoPersonal && mov.titular) {
                const titularName = mov.titular;
                if (!data[titularName]) {
                    data[titularName] = { nombre: titularName, costo: 0, ingresoAsociado: 0 };
                }
                data[titularName].costo += Number(mov.monto);

                if (mov.cliente_id) {
                    const totalIngresosProyecto = finanzasFiltradas
                        .filter(f => f.tipo === 'Ingreso' && f.cliente_id === mov.cliente_id)
                        .reduce((acc, curr) => acc + Number(curr.monto), 0);
                    data[titularName].ingresoAsociado += totalIngresosProyecto;
                }
            }
        });

        return Object.values(data).filter(d => d.costo > 0 || d.ingresoAsociado > 0);
    }, [finanzasFiltradas, cuentas]);

    // 6. Relación Personal-Proyectos (Detalle)
    const relacionPersonalProyectos = useMemo(() => {
        const participaciones = [];
        const ingresosPorCliente = {};
        finanzasFiltradas.forEach(mov => {
            if (mov.tipo === 'Ingreso' && mov.cliente_id) {
                ingresosPorCliente[mov.cliente_id] = (ingresosPorCliente[mov.cliente_id] || 0) + Number(mov.monto);
            }
        });

        finanzasFiltradas.forEach(mov => {
            const esPagoPersonal = mov.tipo === 'Gasto' && (
                mov.categoria === 'Nómina y Salarios' || 
                (mov.servicio && mov.servicio.toLowerCase().startsWith('sueldo:'))
            );
            if (esPagoPersonal && mov.titular) {
                const totalIngresosProyecto = mov.cliente_id ? (ingresosPorCliente[mov.cliente_id] || 0) : 0;
                const nombreProyecto = mov.clientes 
                    ? `${mov.clientes.nombres} ${mov.clientes.apellido_paterno || ''} - ${mov.clientes.trabajo_realizado || mov.servicio || 'Servicio'}`.trim()
                    : 'Gasto General / Sin Proyecto';
                
                participaciones.push({
                    id: mov.id,
                    personal: mov.titular,
                    proyecto: nombreProyecto,
                    ingresoGenerado: totalIngresosProyecto,
                    pagoRealizado: Number(mov.monto),
                    balance: totalIngresosProyecto - Number(mov.monto)
                });
            }
        });

        return participaciones;
    }, [finanzasFiltradas]);

    // 6b. Desglose detallado por proyecto (movimientos individuales + resumen)
    const desglosePorProyecto = useMemo(() => {
        const mapa = {};

        finanzasFiltradas.forEach(mov => {
            if (!mov.cliente_id) return;
            if (!mapa[mov.cliente_id]) {
                mapa[mov.cliente_id] = {
                    ingresos: [],
                    gastos: [],
                    adelantosPersonal: [],
                    comprasInsumos: [],
                    otrosGastos: [],
                    totalIngresos: 0,
                    totalGastos: 0,
                    totalAdelantos: 0
                };
            }

            const registro = {
                fecha: mov.fecha_registro,
                concepto: mov.concepto || '-',
                categoria: mov.categoria || '-',
                monto: Number(mov.monto),
                banco: mov.banco || 'Efectivo',
                id_operacion: mov.id_operacion || '-'
            };

            const esPagoPersonal = mov.tipo === 'Gasto' && (
                mov.categoria === 'Nómina y Salarios' || 
                (mov.servicio && mov.servicio.toLowerCase().startsWith('sueldo:'))
            );

            if (mov.tipo === 'Ingreso') {
                mapa[mov.cliente_id].ingresos.push(registro);
                mapa[mov.cliente_id].totalIngresos += registro.monto;
            } else if (mov.tipo === 'Gasto') {
                mapa[mov.cliente_id].gastos.push(registro);
                mapa[mov.cliente_id].totalGastos += registro.monto;

                if (esPagoPersonal) {
                    mapa[mov.cliente_id].adelantosPersonal.push({
                        ...registro,
                        titular: mov.titular || 'Personal'
                    });
                    mapa[mov.cliente_id].totalAdelantos += registro.monto;
                } else if (mov.categoria === 'Materiales/Insumos') {
                    mapa[mov.cliente_id].comprasInsumos.push(registro);
                } else {
                    mapa[mov.cliente_id].otrosGastos.push(registro);
                }
            }
        });

        return mapa;
    }, [finanzasFiltradas]);

    const formatearFechaDetalle = (fechaStr) => {
        if (!fechaStr) return '-';
        const match = String(fechaStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return `${parseInt(match[3], 10)}/${parseInt(match[2], 10)}/${match[1]}`;
        }
        const fecha = new Date(fechaStr);
        return isNaN(fecha.getTime()) ? '-' : fecha.toLocaleDateString('es-BO');
    };

    const toggleDetalleProyecto = (clienteId) => {
        setProyectoDetalleAbierto(prev => prev === clienteId ? null : clienteId);
    };

    // 7. Balance por Cuentas Bancarias
    const balancePorCuentas = useMemo(() => {
        return cuentas.map(cuenta => {
            let ingresos = 0;
            let gastos = 0;
            const proyectosAlimentadores = new Set();
            const proyectosDebitadores = new Set();

            finanzasFiltradas.forEach(mov => {
                const coincideCuenta = 
                    (mov.numero_cuenta && cuenta.numero_cuenta && mov.numero_cuenta.trim() === cuenta.numero_cuenta.trim()) ||
                    (mov.banco && cuenta.banco && mov.banco.trim().toLowerCase() === cuenta.banco.trim().toLowerCase() && 
                     mov.titular && cuenta.titular && mov.titular.trim().toLowerCase() === cuenta.titular.trim().toLowerCase());

                if (coincideCuenta) {
                    const montoNum = Number(mov.monto);
                    const nombreProyecto = mov.clientes 
                        ? `${mov.clientes.nombres} - ${mov.clientes.trabajo_realizado || mov.servicio || 'Servicio'}`
                        : null;

                    if (mov.tipo === 'Ingreso') {
                        ingresos += montoNum;
                        if (nombreProyecto) proyectosAlimentadores.add(nombreProyecto);
                    } else if (mov.tipo === 'Gasto') {
                        gastos += montoNum;
                        if (nombreProyecto) proyectosDebitadores.add(nombreProyecto);
                    }
                }
            });

            return {
                ...cuenta,
                ingresos,
                gastos,
                balance: ingresos - gastos,
                alimentadores: Array.from(proyectosAlimentadores),
                debitadores: Array.from(proyectosDebitadores)
            };
        });
    }, [cuentas, finanzasFiltradas]);

    // Métricas Globales del Ecosistema
    const metricasGlobales = useMemo(() => {
        let totalIngresos = 0;
        let totalGastos = 0;
        let totalSalarios = 0;

        finanzasFiltradas.forEach(mov => {
            if (mov.tipo === 'Ingreso') totalIngresos += Number(mov.monto);
            if (mov.tipo === 'Gasto') {
                totalGastos += Number(mov.monto);
                if (mov.categoria === 'Nómina y Salarios' || (mov.servicio && mov.servicio.toLowerCase().startsWith('sueldo:'))) {
                    totalSalarios += Number(mov.monto);
                }
            }
        });

        return {
            ingresos: totalIngresos,
            gastos: totalGastos,
            neto: totalIngresos - totalGastos,
            salarios: totalSalarios,
            margenPromedio: totalIngresos > 0 ? Math.round(((totalIngresos - totalGastos) / totalIngresos) * 100) : 0
        };
    }, [finanzasFiltradas]);

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
                <div className="bg-white p-4 shadow-2xl border border-slate-100 rounded-2xl z-50 text-xs">
                    <p className="font-black text-slate-800 border-b border-slate-100 pb-1.5 mb-2">{data.nombre || data.name}</p>
                    <div className="flex flex-col gap-1.5">
                        {data.ingresos !== undefined && <p className="text-emerald-600 font-bold flex justify-between gap-4"><span>Ingresos:</span> <span>Bs. {Math.round(data.ingresos).toLocaleString('es-BO')}</span></p>}
                        {data.gastos !== undefined && <p className="text-red-500 font-bold flex justify-between gap-4"><span>Gastos:</span> <span>Bs. {Math.round(data.gastos).toLocaleString('es-BO')}</span></p>}
                        {data.rentabilidad !== undefined && <p className={`font-black flex justify-between gap-4 ${data.rentabilidad >= 0 ? 'text-blue-600' : 'text-rose-600'}`}><span>Neto:</span> <span>Bs. {Math.round(data.rentabilidad).toLocaleString('es-BO')}</span></p>}
                        {data.margen !== undefined && <p className="text-[#0055af] font-bold flex justify-between gap-4"><span>Margen:</span> <span>{data.margen}%</span></p>}
                        {data.costo !== undefined && <p className="text-red-500 font-bold flex justify-between gap-4"><span>Costo (Salario):</span> <span>Bs. {Math.round(data.costo).toLocaleString('es-BO')}</span></p>}
                        {data.ingresoAsociado !== undefined && <p className="text-emerald-600 font-bold flex justify-between gap-4"><span>Ingreso Asociado:</span> <span>Bs. {Math.round(data.ingresoAsociado).toLocaleString('es-BO')}</span></p>}
                        {data.value !== undefined && <p className="text-slate-700 font-bold flex justify-between gap-4"><span>Total:</span> <span>Bs. {Math.round(data.value).toLocaleString('es-BO')}</span></p>}
                    </div>
                </div>
            );
        }
        return null;
    };

    // Label de % DENTRO del anillo del donut (oculta sectores < 5% para no saturar)
    const renderLabelDonut = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        const pct = Math.round(percent * 100);
        if (pct < 5) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                {pct}%
            </text>
        );
    };

    const toggleServicio = (servicio) => {
        setServiciosSeleccionados(prev => prev.includes(servicio) ? prev.filter(s => s !== servicio) : [...prev, servicio]);
    };
    const toggleCliente = (id) => {
        setClientesSeleccionados(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
    };

    if (cargando) return <div className="p-10 text-center text-slate-500 animate-pulse font-bold tracking-widest uppercase">Cargando Analítica...</div>;

    return (
        <div className="p-4 md:p-8 max-w-[98%] mx-auto flex flex-col gap-6 animate-in fade-in duration-500 pb-20" ref={graficosRef}>
            
            {/* Header del Dashboard */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-10 translate-x-1/4 opacity-5 pointer-events-none text-9xl">📈</div>
                <div className="relative z-10">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inteligencia de Negocios y Analítica</h1>
                    <p className="text-sm text-slate-500 mt-1">Monitorea visualmente las ganancias, pérdidas, retorno de personal y distribución de flujo.</p>
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="flex flex-wrap gap-2 items-center">
                        <select value={filtroTipoPeriodo} onChange={(e) => setFiltroTipoPeriodo(e.target.value)}
                            className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-[#0055af] outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm">
                            <option value="Día">📆 Por Día</option>
                            <option value="Mes">📅 Por Mes</option>
                            <option value="Año">🗓️ Por Año</option>
                        </select>

                        {filtroTipoPeriodo === 'Día' && (
                            <>
                                <input
                                    type="date"
                                    value={filtroFechaDia}
                                    onChange={(e) => setFiltroFechaDia(e.target.value)}
                                    title="Desde"
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-[#0055af] outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm"
                                />
                                <span className="text-[10px] font-black text-slate-400 uppercase">a</span>
                                <input
                                    type="date"
                                    value={filtroFechaDiaHasta}
                                    onChange={(e) => setFiltroFechaDiaHasta(e.target.value)}
                                    title="Hasta"
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-[#0055af] outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm"
                                />
                            </>
                        )}

                        {filtroTipoPeriodo === 'Mes' && (
                            <>
                                <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-[#0055af] outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm">
                                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mes, idx) => (
                                        <option key={idx + 1} value={idx + 1}>{mes}</option>
                                    ))}
                                </select>
                                <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-[#0055af] outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm">
                                    {[2024, 2025, 2026, 2027].map(a => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        {filtroTipoPeriodo === 'Año' && (
                            <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
                                className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-[#0055af] outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm">
                                {[2024, 2025, 2026, 2027].map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <select value={filtroVista} onChange={(e) => setFiltroVista(e.target.value)} className="border-2 border-slate-100 rounded-xl px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:border-blue-500 outline-none font-bold text-slate-700 text-xs transition-colors cursor-pointer shadow-sm">
                        <option value="Ambos">📊 Vista: Todo</option>
                        <option value="Ingresos">📈 Vista: Solo Ingresos</option>
                        <option value="Gastos">📉 Vista: Solo Gastos</option>
                    </select>
                    <button onClick={exportarGraficosComoImagen} disabled={exportandoImg || finanzas.length === 0} className="px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                        {exportandoImg ? '📸 Capturando...' : '📸 Exportar Reporte'}
                    </button>
                </div>
            </div>

            {/* SECCIÓN DE FILTROS FIJADOS EN LA PARTE SUPERIOR */}
            <div className="sticky top-2 z-30 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-md border border-slate-200 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🎛️</span>
                        <h2 className="font-black text-slate-800 text-sm tracking-tight">Filtros Dinámicos de Análisis (Fijados)</h2>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold">Activo para desgloses y comparativas</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-end mb-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><span>👥</span> Filtrar por Clientes</label>
                            <div className="flex gap-1.5">
                                <button onClick={() => setClientesSeleccionados(listasFiltros.clientes.map(c => c.id))} className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md transition-colors">Todos</button>
                                <button onClick={() => setClientesSeleccionados([])} className="text-[9px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md transition-colors">Ninguno</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {listasFiltros.clientes.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic p-2">No hay clientes con transacciones vinculadas.</p>
                            ) : (
                                listasFiltros.clientes.map(cliente => (
                                    <label key={cliente.id} className="flex items-center gap-2 cursor-pointer group bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg transition-colors border border-slate-100">
                                        <input type="checkbox" checked={clientesSeleccionados.includes(cliente.id)} onChange={() => toggleCliente(cliente.id)} className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 cursor-pointer" />
                                        <span className={`text-[11px] font-bold transition-colors truncate ${clientesSeleccionados.includes(cliente.id) ? 'text-slate-800' : 'text-slate-400'}`}>{cliente.nombre}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-end mb-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><span>🛠️</span> Filtrar por Servicios</label>
                            <div className="flex gap-1.5">
                                <button onClick={() => setServiciosSeleccionados(listasFiltros.servicios)} className="text-[9px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md transition-colors">Todos</button>
                                <button onClick={() => setServiciosSeleccionados([])} className="text-[9px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md transition-colors">Ninguno</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1.5 custom-scrollbar">
                            {listasFiltros.servicios.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic p-2">No hay servicios registrados en transacciones.</p>
                            ) : (
                                listasFiltros.servicios.map(servicio => (
                                    <label key={servicio} className="flex items-center gap-2 cursor-pointer group bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg transition-colors border border-slate-100">
                                        <input type="checkbox" checked={serviciosSeleccionados.includes(servicio)} onChange={() => toggleServicio(servicio)} className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 cursor-pointer" />
                                        <span className={`text-[11px] font-bold transition-colors truncate ${serviciosSeleccionados.includes(servicio) ? 'text-slate-800' : 'text-slate-400'}`}>{servicio}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards Globales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm border-l-4 border-l-emerald-500 hover:-translate-y-1 transition-transform">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Ingresos</p>
                    <p className="text-2xl font-black text-emerald-600 mt-2">Bs. {Math.round(metricasGlobales.ingresos).toLocaleString('es-BO')}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Flujo bruto ingresado</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm border-l-4 border-l-rose-500 hover:-translate-y-1 transition-transform">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Gastos</p>
                    <p className="text-2xl font-black text-rose-600 mt-2">Bs. {Math.round(metricasGlobales.gastos).toLocaleString('es-BO')}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Egresos y costos operativos</p>
                </div>
                <div className={`bg-white p-6 rounded-3xl border shadow-sm border-l-4 hover:-translate-y-1 transition-transform ${metricasGlobales.neto >= 0 ? 'border-blue-100 border-l-blue-500' : 'border-amber-100 border-l-amber-500'}`}>
                    <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance Neto</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">{metricasGlobales.margenPromedio}% Margen</span>
                    </div>
                    <p className={`text-2xl font-black mt-2 ${metricasGlobales.neto >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                        Bs. {Math.round(metricasGlobales.neto).toLocaleString('es-BO')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Ganancia/Pérdida acumulada</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm border-l-4 border-l-indigo-500 hover:-translate-y-1 transition-transform">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo de Personal</p>
                    <p className="text-2xl font-black text-indigo-600 mt-2">Bs. {Math.round(metricasGlobales.salarios).toLocaleString('es-BO')}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Nóminas y salarios pagados</p>
                </div>
            </div>

            {/* SECCIÓN 1: RENTABILIDAD POR TIPO DE SERVICIO (Servicio Gain/Loss) */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 mb-6">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <span>🛠️</span> Ganancias y Pérdidas por Tipo de Servicio
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Relación visual de ingresos brutos, gastos y margen de ganancia real por cada categoría de servicio.</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Gráfico de barras agrupado de servicios */}
                    <div className="lg:col-span-2 h-[350px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={serviciosAnalytics} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#475569', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '15px', fontSize: '11px' }} />
                                <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="rentabilidad" name="Rentabilidad Neta" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Desglose visual y porcentual */}
                    <div className="flex flex-col gap-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen de Servicios</h4>
                        {serviciosAnalytics.map((s, i) => (
                            <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-700 truncate max-w-[70%]">{s.nombre}</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${s.rentabilidad >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {s.rentabilidad >= 0 ? 'Ganancia' : 'Pérdida'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 text-center gap-1.5 pt-1.5 border-t border-slate-200/50">
                                    <div>
                                        <span className="text-[8px] text-slate-400 font-bold block uppercase">Ingresos</span>
                                        <span className="text-[10px] font-black text-slate-600">Bs. {Math.round(s.ingresos)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] text-slate-400 font-bold block uppercase">Gastos</span>
                                        <span className="text-[10px] font-black text-red-500">Bs. {Math.round(s.gastos)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] text-slate-400 font-bold block uppercase">Neto</span>
                                        <span className={`text-[10px] font-black ${s.rentabilidad >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>Bs. {Math.round(s.rentabilidad)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 2: DISTRIBUCION DE INGRESOS Y EGRESOS (Double Donut charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Distribución de Ingresos */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="border-b border-slate-100 pb-3 mb-5">
                        <h3 className="text-sm font-black text-slate-800">Distribución de Ingresos por Servicio</h3>
                        <p className="text-[10px] text-slate-500">Porcentaje de aportación de cada servicio a las ventas totales.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart>
                                    <Pie data={distribucionIngresos} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none" label={renderLabelDonut} labelLine={false}>
                                        {distribucionIngresos.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORES_PIE[index % COLORES_PIE.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {distribucionIngresos.map((d, index) => {
                                const total = distribucionIngresos.reduce((acc, curr) => acc + curr.value, 0);
                                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                return (
                                    <div key={index} className="flex justify-between items-center text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-2 truncate max-w-[70%]">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORES_PIE[index % COLORES_PIE.length] }} />
                                            <span className="truncate">{d.name}</span>
                                        </div>
                                        <span>{pct}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Distribución de Egresos */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="border-b border-slate-100 pb-3 mb-5">
                        <h3 className="text-sm font-black text-slate-800">Distribución de Egresos por Categoría</h3>
                        <p className="text-[10px] text-slate-500">¿A dónde va el capital? Desglose por concepto/rubro de gasto.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart>
                                    <Pie data={distribucionGastos} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none" label={renderLabelDonut} labelLine={false}>
                                        {distribucionGastos.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORES_PIE[(index + 3) % COLORES_PIE.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {distribucionGastos.map((d, index) => {
                                const total = distribucionGastos.reduce((acc, curr) => acc + curr.value, 0);
                                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                return (
                                    <div key={index} className="flex justify-between items-center text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-2 truncate max-w-[70%]">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORES_PIE[(index + 3) % COLORES_PIE.length] }} />
                                            <span className="truncate">{d.name}</span>
                                        </div>
                                        <span>{pct}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>

            {/* SECCIÓN 3: RENDIMIENTO Y RETORNO DE COSTO DE PERSONAL (Personal ROI) */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 mb-6">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <span>👥</span> Retorno de Inversión y Costo de Personal
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Compara el sueldo total pagado a cada colaborador frente al ingreso bruto de los proyectos/clientes que tienen vinculados.</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Gráfico de barras agrupado */}
                    <div className="lg:col-span-2 h-[320px]">
                        {personalAnalytics.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-xs bg-slate-50 border-2 border-dashed rounded-2xl">
                                Registre nóminas asociadas a clientes en "Finanzas" para ver el retorno de personal
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={personalAnalytics} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#475569', fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '15px', fontSize: '11px' }} />
                                    <Bar dataKey="costo" name="Costo (Sueldo Pagado)" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="costo" position="top" formatter={(v) => `Bs. ${Math.round(v).toLocaleString('es-BO')}`} style={{ fontSize: 9, fontWeight: 700, fill: '#d97706' }} />
                                    </Bar>
                                    <Bar dataKey="ingresoAsociado" name="Ingreso Proyecto Asociado" fill="#10b981" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="ingresoAsociado" position="top" formatter={(v) => `Bs. ${Math.round(v).toLocaleString('es-BO')}`} style={{ fontSize: 9, fontWeight: 700, fill: '#059669' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Tabla de ROI rápida */}
                    <div className="flex flex-col gap-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Índice de Retorno</h4>
                        {personalAnalytics.map((p, i) => {
                            const ratio = p.costo > 0 ? (p.ingresoAsociado / p.costo).toFixed(1) : '0';
                            return (
                                <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-700">{p.nombre}</span>
                                        <span className="text-[9px] text-slate-400 font-bold mt-0.5">Sueldo: Bs. {Math.round(p.costo)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase ${Number(ratio) >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            x{ratio} Retorno
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Gráfico Comparativo por Clientes/Proyectos */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                <h3 className="text-xs font-black text-slate-800 mb-6 text-center">Detalle Comparativo de Proyectos Filtrados</h3>
                <div className="h-[350px] w-full overflow-x-auto custom-scrollbar">
                    {datosFiltrados.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 italic text-xs bg-slate-50 border-2 border-dashed rounded-2xl">
                            No hay proyectos que coincidan con la selección de filtros actual.
                        </div>
                    ) : (
                        <div style={{ width: `${Math.max(100, datosFiltrados.length * 22)}%`, minWidth: '100%', height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={datosFiltrados} margin={{ top: 30, right: 10, left: -20, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="nombre" axisLine={false} tickLine={false} interval={0} height={70}
                                        tick={({ x, y, payload }) => {
                                            const partes = String(payload.value).split(' - ');
                                            const cliente = partes[0] || payload.value;
                                            const servicio = partes.slice(1).join(' - ') || '';
                                            return (
                                                <g transform={`translate(${x},${y})`}>
                                                    <text x={0} y={0} dy={10} textAnchor="middle" fill="#475569" fontSize={9} fontWeight="bold">
                                                        {cliente.length > 22 ? cliente.slice(0, 22) + '…' : cliente}
                                                    </text>
                                                    <text x={0} y={0} dy={24} textAnchor="middle" fill="#94a3b8" fontSize={8}>
                                                        {servicio.length > 22 ? servicio.slice(0, 22) + '…' : servicio}
                                                    </text>
                                                </g>
                                            );
                                        }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
                                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                                    {(filtroVista === 'Ambos' || filtroVista === 'Ingresos') && <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="ingresos" position="top" formatter={(v) => `Bs. ${Math.round(v).toLocaleString('es-BO')}`} style={{ fontSize: 9, fontWeight: 700, fill: '#059669' }} />
                                    </Bar>}
                                    {(filtroVista === 'Ambos' || filtroVista === 'Gastos') && <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="gastos" position="top" formatter={(v) => `Bs. ${Math.round(v).toLocaleString('es-BO')}`} style={{ fontSize: 9, fontWeight: 700, fill: '#dc2626' }} />
                                    </Bar>}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* TABLA: Desglose Numérico */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📋</span>
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Desglose de Rentabilidad por Proyecto</h3>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">👆 Haz clic en "Ver Detalle" para revisar ingresos, gastos, adelantos al personal y compras de cada proyecto</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 min-w-[800px]">
                        <thead className="bg-white border-b border-slate-100 uppercase text-[10px] font-black text-slate-400">
                            <tr>
                                <th className="px-6 py-4">Proyecto</th>
                                <th className="px-6 py-4 text-center">Ingresos</th>
                                <th className="px-6 py-4 text-center">Gastos</th>
                                <th className="px-6 py-4 text-right">Rentabilidad</th>
                                <th className="px-6 py-4 text-center">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {datosFiltrados.length === 0 ? (
                                <tr><td colSpan="5" className="p-6 text-center text-slate-400 italic">No hay proyectos seleccionados.</td></tr>
                            ) : (
                                datosFiltrados.map((p) => {
                                    const detalle = desglosePorProyecto[p.cliente_id];
                                    const estaAbierto = proyectoDetalleAbierto === p.cliente_id;
                                    const esGanancia = p.rentabilidad >= 0;
                                    return (
                                        <FragmentProyecto key={p.cliente_id}>
                                            <tr className={`hover:bg-slate-50 transition-colors ${estaAbierto ? 'bg-blue-50/40' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{p.cliente}</div>
                                                    {p.servicio && <div className="text-[9px] font-bold text-slate-400 mt-0.5">{p.servicio}</div>}
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-emerald-600">Bs. {Math.round(p.ingresos).toLocaleString('es-BO')}</td>
                                                <td className="px-6 py-4 text-center font-bold text-red-500">Bs. {Math.round(p.gastos).toLocaleString('es-BO')}</td>
                                                <td className={`px-6 py-4 text-right font-black ${esGanancia ? 'text-blue-600' : 'text-rose-600'}`}>
                                                    Bs. {Math.round(p.rentabilidad).toLocaleString('es-BO')}
                                                    {detalle && detalle.totalAdelantos > 0 && (
                                                        <div className="text-[9px] text-amber-500 font-bold mt-0.5">👥 Incluye Bs. {Math.round(detalle.totalAdelantos).toLocaleString('es-BO')} en personal</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleDetalleProyecto(p.cliente_id)}
                                                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all shadow-sm ${estaAbierto
                                                            ? 'bg-[#0055af] text-white border-[#0055af]'
                                                            : 'bg-white text-[#0055af] border-[#0055af]/30 hover:bg-[#0055af] hover:text-white'
                                                            }`}
                                                    >
                                                        {estaAbierto ? '▲ Ocultar' : '▼ Ver Detalle'}
                                                    </button>
                                                </td>
                                            </tr>

                                            {estaAbierto && (
                                                <tr className="bg-slate-50/70 border-b border-slate-100">
                                                    <td colSpan="5" className="px-6 py-6">
                                                        {detalle ? (
                                                            <div className="flex flex-col gap-5">
                                                                {/* Resumen del proyecto */}
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingresos</p>
                                                                        <p className="text-lg font-black text-emerald-600 mt-0.5">Bs. {detalle.totalIngresos.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</p>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gastos</p>
                                                                        <p className="text-lg font-black text-red-500 mt-0.5">Bs. {detalle.totalGastos.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</p>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Adelantos Personal</p>
                                                                        <p className="text-lg font-black text-amber-500 mt-0.5">Bs. {detalle.totalAdelantos.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</p>
                                                                    </div>
                                                                    <div className={`bg-white p-3 rounded-xl border shadow-sm ${esGanancia ? 'border-blue-100' : 'border-rose-100'}`}>
                                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rentabilidad Neta</p>
                                                                        <p className={`text-lg font-black mt-0.5 ${esGanancia ? 'text-blue-600' : 'text-rose-600'}`}>
                                                                            Bs. {detalle.totalIngresos - detalle.totalGastos >= 0 ? '+' : ''}{(detalle.totalIngresos - detalle.totalGastos).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                                    {/* Ingresos del proyecto */}
                                                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                                                                        <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">💰 Ingresos ({detalle.ingresos.length})</span>
                                                                            <span className="text-[10px] font-black text-emerald-700">Bs. {detalle.totalIngresos.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                                                                            {detalle.ingresos.length === 0 ? (
                                                                                <p className="p-4 text-xs text-slate-400 italic">Sin ingresos registrados.</p>
                                                                            ) : detalle.ingresos.map((ing, i) => (
                                                                                <div key={`ing-${i}`} className="px-4 py-2.5 flex justify-between items-start gap-2">
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <span className="text-xs font-bold text-slate-700 break-words">{ing.concepto}</span>
                                                                                        <span className="text-[9px] text-slate-400 font-medium">{formatearFechaDetalle(ing.fecha)} • {ing.banco}</span>
                                                                                    </div>
                                                                                    <span className="text-xs font-black text-emerald-600 shrink-0">Bs. {ing.monto.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Adelantos al personal */}
                                                                    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden flex flex-col">
                                                                        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">👥 Adelantos al Personal ({detalle.adelantosPersonal.length})</span>
                                                                            <span className="text-[10px] font-black text-amber-700">Bs. {detalle.totalAdelantos.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                                                                            {detalle.adelantosPersonal.length === 0 ? (
                                                                                <p className="p-4 text-xs text-slate-400 italic">No se registraron pagos al personal en este proyecto.</p>
                                                                            ) : detalle.adelantosPersonal.map((adv, i) => (
                                                                                <div key={`adv-${i}`} className="px-4 py-2.5 flex justify-between items-start gap-2">
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <span className="text-xs font-bold text-slate-700">👤 {adv.titular}</span>
                                                                                        <span className="text-[9px] text-slate-400 font-medium">{formatearFechaDetalle(adv.fecha)} • {adv.concepto}</span>
                                                                                    </div>
                                                                                    <span className="text-xs font-black text-amber-600 shrink-0">Bs. {adv.monto.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Compras / Insumos y otros gastos */}
                                                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                                                                        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                                                                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">🛒 Compras / Insumos ({detalle.comprasInsumos.length})</span>
                                                                            <span className="text-[10px] font-black text-rose-700">Bs. {detalle.comprasInsumos.reduce((a, c) => a + c.monto, 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div className="max-h-[150px] overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                                                                            {detalle.comprasInsumos.length === 0 ? (
                                                                                <p className="p-4 text-xs text-slate-400 italic">Sin compras de insumos.</p>
                                                                            ) : detalle.comprasInsumos.map((comp, i) => (
                                                                                <div key={`comp-${i}`} className="px-4 py-2 flex justify-between items-start gap-2">
                                                                                    <div className="flex flex-col min-w-0">
                                                                                        <span className="text-[11px] font-bold text-slate-700 break-words">{comp.concepto}</span>
                                                                                        <span className="text-[9px] text-slate-400 font-medium">{formatearFechaDetalle(comp.fecha)}</span>
                                                                                    </div>
                                                                                    <span className="text-[11px] font-black text-rose-600 shrink-0">Bs. {comp.monto.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
                                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Otros Gastos ({detalle.otrosGastos.length})</p>
                                                                            {detalle.otrosGastos.length === 0 ? (
                                                                                <p className="text-[10px] text-slate-400 italic">Sin otros gastos.</p>
                                                                            ) : (
                                                                                <div className="max-h-[110px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                                                                                    {detalle.otrosGastos.map((otro, i) => (
                                                                                        <div key={`otro-${i}`} className="py-1.5 flex justify-between items-start gap-2">
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <span className="text-[10px] font-bold text-slate-600 break-words">{otro.concepto}</span>
                                                                                                <span className="text-[8px] text-slate-400">{formatearFechaDetalle(otro.fecha)} • {otro.categoria}</span>
                                                                                            </div>
                                                                                            <span className="text-[10px] font-black text-slate-500 shrink-0">Bs. {otro.monto.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic text-center py-6">Este proyecto no tiene movimientos financieros vinculados.</p>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </FragmentProyecto>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TABLA: Detalle de Nóminas */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <span className="text-lg">💼</span>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Historial de Pagos y Vinculación Laboral</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-white border-b border-slate-100 uppercase text-[10px] font-black text-slate-400">
                            <tr>
                                <th className="px-6 py-4">Personal</th>
                                <th className="px-6 py-4">Proyecto</th>
                                <th className="px-6 py-4 text-center">Pago (Gasto)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {relacionPersonalProyectos.length === 0 ? (
                                <tr><td colSpan="3" className="p-6 text-center text-slate-400 italic">No hay nóminas registradas.</td></tr>
                            ) : (
                                relacionPersonalProyectos.map((r) => (
                                    <tr key={r.id}>
                                        <td className="px-6 py-4 font-bold text-slate-800">{r.personal}</td>
                                        <td className="px-6 py-4 text-slate-500">{r.proyecto}</td>
                                        <td className="px-6 py-4 text-center font-bold text-red-500">Bs. {Math.round(r.pagoRealizado).toLocaleString('es-BO')}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PANEL: Balance por Cuenta Bancaria */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-6">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4">Balance Acumulado por Cuentas Bancarias</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {balancePorCuentas.map(c => (
                        <div key={c.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                            <div className="flex justify-between items-start">
                                <span className="font-black text-slate-800 text-sm truncate">{c.alias || c.banco}</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${c.tipo === 'Propia' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {c.tipo}
                                </span>
                            </div>
                            <div className="text-xs font-bold text-blue-600">Balance: Bs. {Math.round(c.balance).toLocaleString('es-BO')}</div>
                            <div className="text-[9px] text-slate-400">Banco: {c.banco}</div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}