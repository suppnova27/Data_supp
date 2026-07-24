import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';
import FormularioFinanzaModal from './FormularioFinanzaModal';

const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    const match = String(fechaStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [_, y, m, d] = match;
        return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
    }
    const fecha = new Date(fechaStr);
    return isNaN(fecha.getTime()) ? '-' : fecha.toLocaleDateString('es-BO');
};

const parsearServicio = (servicioStr) => {
    if (!servicioStr) return { servicio: '-', detalle: '-' };
    const limpio = servicioStr.trim();
    const matchRutinaria = limpio.match(/^🧹 Limpieza Rutinaria - (.+)$/i);
    if (matchRutinaria) {
        return { servicio: 'Limpieza Rutinaria', detalle: matchRutinaria[1] };
    }
    const idxGuion = limpio.indexOf(' - ');
    if (idxGuion > 0) {
        return { servicio: limpio.substring(0, idxGuion), detalle: limpio.substring(idxGuion + 3) };
    }
    return { servicio: limpio, detalle: '-' };
};

export default function FinanzasPage() {
    const [finanzas, setFinanzas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [finanzaEditando, setFinanzaEditando] = useState(null);
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
    const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
    const [importando, setImportando] = useState(false);

    const fileInputRef = useRef(null);

    const fetchFinanzas = async () => {
        setCargando(true);
        const { data } = await supabase
            .from('finanzas')
            .select('*, clientes(nombres, apellido_paterno)')
            .order('fecha_registro', { ascending: false });

        if (data) {
            const finanzaIds = data.map(f => f.id);
            let serviciosMap = {};

            if (finanzaIds.length > 0) {
                const { data: fsData } = await supabase
                    .from('finanza_servicios')
                    .select('finanza_id, servicio_id, servicios(nombre, etiqueta_id)')
                    .in('finanza_id', finanzaIds);

                if (fsData) {
                    fsData.forEach(fs => {
                        if (!serviciosMap[fs.finanza_id]) serviciosMap[fs.finanza_id] = [];
                        if (fs.servicios) {
                            serviciosMap[fs.finanza_id].push(fs.servicios);
                        }
                    });
                }
            }

            const enriched = data.map(f => ({
                ...f,
                servicios_vinculados: serviciosMap[f.id] || []
            }));

            setFinanzas(enriched);
        }
        setCargando(false);
    };

    useEffect(() => { fetchFinanzas(); }, []);

    const finanzasFiltradas = finanzas.filter(f => {
        if (!f.fecha_registro) return false;
        const match = String(f.fecha_registro).match(/^(\d{4})-(\d{2})-(\d{2})/);
        let mes, anio;
        if (match) {
            anio = Number(match[1]);
            mes = Number(match[2]);
        } else {
            const fecha = new Date(f.fecha_registro);
            anio = fecha.getFullYear();
            mes = fecha.getMonth() + 1;
        }
        return mes === Number(filtroMes) && anio === Number(filtroAnio);
    });

    const ingresos = finanzasFiltradas.filter(f => f.tipo === 'Ingreso').reduce((acc, curr) => acc + Number(curr.monto), 0);
    const gastos = finanzasFiltradas.filter(f => f.tipo === 'Gasto').reduce((acc, curr) => acc + Number(curr.monto), 0);
    const balance = ingresos - gastos;

    const abrirModal = (finanza = null) => {
        setFinanzaEditando(finanza);
        setModalAbierto(true);
    };

    const eliminarRegistro = async (id) => {
        if (window.confirm("¿Eliminar este registro financiero? Esta acción es irreversible.")) {
            await supabase.from('finanza_servicios').delete().eq('finanza_id', id);
            await supabase.from('finanzas').delete().eq('id', id);
            fetchFinanzas();
        }
    };

    const obtenerNombresClientes = (f) => {
        const todos = [];
        if (f.clientes?.nombres) {
            todos.push(`${f.clientes.nombres} ${f.clientes.apellido_paterno || ''}`.trim());
        }
        return todos.length > 0 ? todos : ['Sin cliente asignado'];
    };

    const obtenerServiciosVinculados = (f) => {
        if (!f.servicios_vinculados || f.servicios_vinculados.length === 0) return [];
        return f.servicios_vinculados.map(s => s.nombre || 'Servicio sin nombre');
    };

    const exportarExcel = () => {
        if (finanzasFiltradas.length === 0) {
            alert("No hay movimientos para exportar con el filtro actual.");
            return;
        }

        const datosFormateados = finanzasFiltradas.map(f => {
            const nombresClientes = obtenerNombresClientes(f).join(', ');
            const serviciosVinculados = obtenerServiciosVinculados(f).join(', ');
            const { servicio, detalle } = parsearServicio(f.servicio);

            return {
                'Fecha de Registro': formatearFecha(f.fecha_registro),
                'Tipo': f.tipo,
                'Categoría': f.categoria || '-',
                'Detalle / Concepto': f.concepto || '-',
                'Monto (Bs)': Number(f.monto),
                'Cliente / Personal': nombresClientes,
                'Servicios Vinculados': serviciosVinculados || '-',
                'Servicio Principal': servicio,
                'Detalle Servicio': detalle,
                'Banco / Entidad': f.banco || 'Efectivo',
                'Nro. Cuenta': f.numero_cuenta || '-',
                'Titular Cuenta': f.titular || '-',
                'ID Operación / Ref': f.id_operacion || '-'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(datosFormateados);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Financiero");

        const nombreMes = new Date(0, filtroMes - 1).toLocaleString('es', { month: 'long' });
        XLSX.writeFile(workbook, `Finanzas_ORE_${nombreMes}_${filtroAnio}.xlsx`);
    };

    const handleImportarExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImportando(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (jsonRows.length === 0) {
                alert("El archivo Excel no contiene datos.");
                setImportando(false);
                return;
            }

            const { data: listaClientes } = await supabase.from('clientes').select('id, nombres, apellido_paterno');

            const registrosAAgregar = [];

            for (const row of jsonRows) {
                const rawFecha = row['Fecha de Registro'] || row['Fecha'] || row['fecha'] || '';
                let fecha_registro = '';

                if (rawFecha instanceof Date && !isNaN(rawFecha)) {
                    const y = rawFecha.getFullYear();
                    const m = String(rawFecha.getMonth() + 1).padStart(2, '0');
                    const d = String(rawFecha.getDate()).padStart(2, '0');
                    fecha_registro = `${y}-${m}-${d}`;
                } else if (typeof rawFecha === 'string' && rawFecha.includes('/')) {
                    const partes = rawFecha.split('/');
                    if (partes.length === 3) {
                        const d = partes[0].padStart(2, '0');
                        const m = partes[1].padStart(2, '0');
                        const y = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
                        fecha_registro = `${y}-${m}-${d}`;
                    }
                } else if (typeof rawFecha === 'string' && rawFecha.includes('-')) {
                    fecha_registro = rawFecha.split('T')[0];
                } else {
                    const d = new Date();
                    fecha_registro = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }

                const tipo = (row['Tipo'] || row['tipo'] || 'Ingreso').trim();
                const categoria = String(row['Categoría'] || row['Categoria'] || row['categoria'] || '');
                const concepto = String(row['Detalle / Concepto'] || row['Concepto'] || row['Detalle'] || 'Movimiento importado');
                const monto = parseFloat(row['Monto (Bs)'] || row['Monto'] || row['monto'] || 0);

                const clienteTexto = String(row['Lead / Cliente Relacionado'] || row['Cliente'] || '').trim().toLowerCase();
                let cliente_id = null;
                if (listaClientes && clienteTexto && !clienteTexto.includes('gasto general')) {
                    const clienteEncontrado = listaClientes.find(c => {
                        const nombreCompleto = `${c.nombres} ${c.apellido_paterno || ''}`.trim().toLowerCase();
                        return nombreCompleto.includes(clienteTexto) || clienteTexto.includes(c.nombres.toLowerCase());
                    });
                    if (clienteEncontrado) {
                        cliente_id = clienteEncontrado.id;
                    }
                }

                const servicioCol = row['Servicio'] || '';
                const detalleCol = row['Detalle Servicio'] || '';
                const servicioLegacy = row['Servicio Realizado'] || '';
                let servicio = '';
                if (servicioCol && detalleCol && detalleCol !== '-') {
                    servicio = `${servicioCol} - ${detalleCol}`;
                } else if (servicioCol) {
                    servicio = servicioCol;
                } else {
                    servicio = servicioLegacy;
                }

                const banco = String(row['Banco / Entidad'] || row['Banco'] || 'Efectivo');
                const numero_cuenta = String(row['Nro. Cuenta'] || row['Nro Cuenta'] || row['Cuenta'] || '');
                const titular = String(row['Titular Cuenta'] || row['Titular'] || '');
                const id_operacion = String(row['ID Operación / Ref'] || row['ID Operacion'] || row['Ref'] || '');

                registrosAAgregar.push({
                    fecha_registro,
                    tipo: tipo === 'Gasto' ? 'Gasto' : 'Ingreso',
                    categoria,
                    concepto,
                    monto: isNaN(monto) ? 0 : monto,
                    cliente_id,
                    servicio,
                    banco,
                    numero_cuenta,
                    titular,
                    id_operacion
                });
            }

            const { error } = await supabase.from('finanzas').insert(registrosAAgregar);

            if (error) {
                console.error("Error al importar datos:", error);
                alert("Error al guardar los registros en la base de datos.");
            } else {
                alert(`¡Éxito! Se importaron ${registrosAAgregar.length} registros correctamente.`);
                fetchFinanzas();
            }
        } catch (err) {
            console.error("Error procesando Excel:", err);
            alert("Ocurrió un error al procesar el archivo Excel.");
        } finally {
            setImportando(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[98%] mx-auto flex flex-col gap-6 animate-in fade-in pb-20">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 gap-6 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-[#0055af] tracking-tight">Gestión Financiera</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Historial completo con detalle bancario e importación Excel.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx, .xls"
                        onChange={handleImportarExcel}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importando}
                        className="px-5 py-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-black text-xs uppercase tracking-wider rounded-full transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {importando ? '⏳ Importando...' : '📥 Importar Excel'}
                    </button>
                    <button
                        onClick={() => abrirModal()}
                        className="px-8 py-3.5 bg-[#0055af] text-white font-black text-sm uppercase tracking-widest rounded-full shadow-lg hover:-translate-y-1 transition-all"
                    >
                        + Registrar Movimiento
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingresos del Mes</p>
                    <p className="text-3xl font-black text-slate-800 mt-2">Bs. {ingresos.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-rose-500">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gastos del Mes</p>
                    <p className="text-3xl font-black text-slate-800 mt-2">Bs. {gastos.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 ${balance >= 0 ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance Neto</p>
                    <p className={`text-3xl font-black mt-2 ${balance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                        Bs. {balance.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Historial</h3>
                        <div className="flex gap-2">
                            <select
                                value={filtroMes}
                                onChange={e => setFiltroMes(Number(e.target.value))}
                                className="bg-white border border-slate-200 text-xs font-bold text-slate-700 px-3 py-1.5 rounded-lg outline-none focus:border-[#0055af]"
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mes, idx) => (
                                    <option key={idx + 1} value={idx + 1}>{mes}</option>
                                ))}
                            </select>
                            <select
                                value={filtroAnio}
                                onChange={e => setFiltroAnio(Number(e.target.value))}
                                className="bg-white border border-slate-200 text-xs font-bold text-slate-700 px-3 py-1.5 rounded-lg outline-none focus:border-[#0055af]"
                            >
                                {[2024, 2025, 2026, 2027].map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={exportarExcel}
                        className="px-5 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white font-black rounded-full text-[10px] uppercase tracking-widest border border-emerald-200 transition-all shadow-sm flex items-center gap-1.5"
                    >
                        📊 Exportar Excel (.xlsx)
                    </button>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm text-slate-600 min-w-[1000px]">
                        <thead className="bg-white border-b border-slate-100 uppercase text-[10px] font-black text-slate-400">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Detalle / Proyecto</th>
                                <th className="px-6 py-4">Banco / Cuenta</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4 text-center">Ref.</th>
                                <th className="px-6 py-4 text-right">Monto (Bs)</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {cargando ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-slate-400 font-medium">Cargando movimientos...</td>
                                </tr>
                            ) : finanzasFiltradas.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-slate-400 font-medium">No hay registros financieros en este período.</td>
                                </tr>
                            ) : (
                                finanzasFiltradas.map(f => {
                                    return (
                                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-xs text-slate-700">
                                                {formatearFecha(f.fecha_registro)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-black text-slate-800 text-sm">{f.concepto}</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {obtenerNombresClientes(f).map((nom, idx) => (
                                                        <span key={idx} className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            {nom}
                                                        </span>
                                                    ))}
                                                    {obtenerServiciosVinculados(f).map((serv, idx) => (
                                                        <span key={`serv-${idx}`} className="text-[9px] font-bold text-[#0055af] bg-[#0055af]/10 px-1.5 py-0.5 rounded">
                                                            🧹 {serv}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-bold text-slate-700">{f.banco || 'Efectivo'}</div>
                                                {f.numero_cuenta && <div className="text-[9px] text-slate-400 font-medium">{f.numero_cuenta}</div>}
                                                {f.titular && <div className="text-[9px] text-slate-400 font-medium">{f.titular}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${f.tipo === 'Ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {f.tipo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono text-[10px]">{f.id_operacion || '-'}</td>
                                            <td className={`px-6 py-4 text-right font-black ${f.tipo === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                Bs. {Number(f.monto).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center flex justify-center items-center gap-2">
                                                <button onClick={() => abrirModal(f)} className="text-slate-300 hover:text-[#0055af] bg-transparent hover:bg-blue-50 p-2 rounded-full transition-all">✏️</button>
                                                <button onClick={() => eliminarRegistro(f.id)} className="text-slate-300 hover:text-red-500 bg-transparent hover:bg-red-50 p-2 rounded-full transition-all">🗑️</button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <FormularioFinanzaModal
                isOpen={modalAbierto}
                onClose={() => setModalAbierto(false)}
                onGuardado={fetchFinanzas}
                finanzaEditando={finanzaEditando}
            />
        </div>
    );
}
