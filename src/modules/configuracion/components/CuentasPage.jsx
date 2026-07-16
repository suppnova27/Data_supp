import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import * as XLSX from 'xlsx';

export default function CuentasPage() {
    const [cuentas, setCuentas] = useState([]);
    const [finanzas, setFinanzas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [modalAbierto, setModalAbierto] = useState(false);

    const valoresPorDefecto = {
        alias: '',
        titular: '',
        banco: '',
        numero_cuenta: '',
        tipo: 'Propia',
        saldo_inicial: ''
    };
    const [formData, setFormData] = useState(valoresPorDefecto);
    const [editandoId, setEditandoId] = useState(null);

    const fetchCuentas = async () => {
        setCargando(true);

        const { data: dataCuentas } = await supabase.from('directorio_cuentas').select('*').order('alias', { ascending: true });
        const { data: dataFinanzas } = await supabase.from('finanzas').select('*');

        if (dataFinanzas) setFinanzas(dataFinanzas);

        if (dataCuentas) {
            const cuentasConSaldo = dataCuentas.map(cuenta => {
                const movimientos = dataFinanzas?.filter(f => f.cuenta_id === cuenta.id) || [];

                // CORRECCIÓN AQUÍ: Cambiamos m.monto por curr.monto
                const ingresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((acc, curr) => acc + Number(curr.monto), 0);
                const gastos = movimientos.filter(m => m.tipo === 'Gasto').reduce((acc, curr) => acc + Number(curr.monto), 0);

                return {
                    ...cuenta,
                    saldo_actual: Number(cuenta.saldo_inicial || 0) + ingresos - gastos
                };
            });
            setCuentas(cuentasConSaldo);
        }
        setCargando(false);
    };

    useEffect(() => { fetchCuentas(); }, []);

    const resumenCuentas = useMemo(() => {
        return cuentas.map(cuenta => {
            let entrante = 0;
            let saliente = 0;

            finanzas.forEach(mov => {
                const coincideCuenta = 
                    (mov.cuenta_id && cuenta.id && String(mov.cuenta_id) === String(cuenta.id)) ||
                    (!mov.cuenta_id && (
                        (mov.numero_cuenta && cuenta.numero_cuenta && mov.numero_cuenta.trim() === cuenta.numero_cuenta.trim()) ||
                        (mov.banco && cuenta.banco && mov.banco.trim().toLowerCase() === cuenta.banco.trim().toLowerCase() && 
                         mov.titular && cuenta.titular && mov.titular.trim().toLowerCase() === cuenta.titular.trim().toLowerCase())
                    ));

                if (coincideCuenta) {
                    if (mov.tipo === 'Ingreso') {
                        entrante += Number(mov.monto);
                    } else if (mov.tipo === 'Gasto') {
                        saliente += Number(mov.monto);
                    }
                }
            });

            return {
                ...cuenta,
                entrante,
                saliente,
                neto: Number(cuenta.saldo_inicial || 0) + entrante - saliente
            };
        });
    }, [cuentas, finanzas]);

    const descargarExcel = () => {
        try {
            const datosFormateados = resumenCuentas.map(c => ({
                'Alias de Cuenta': c.alias,
                'Titular': c.titular,
                'Banco': c.banco || 'Efectivo',
                'Nro. Cuenta': c.numero_cuenta || 'N/A',
                'Tipo de Cuenta': c.tipo,
                'Saldo Inicial (Bs)': Number(c.saldo_inicial || 0),
                'Dinero Entrante (Bs)': Number(c.entrante),
                'Dinero Saliente (Bs)': Number(c.saliente),
                'Balance Neto (Bs)': Number(c.neto)
            }));

            const worksheet = XLSX.utils.json_to_sheet(datosFormateados);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen de Cuentas");

            // Autoajustar columnas
            const maxLens = {};
            datosFormateados.forEach(row => {
                Object.keys(row).forEach(key => {
                    const val = String(row[key]);
                    maxLens[key] = Math.max(maxLens[key] || 10, val.length + 2);
                });
            });
            worksheet['!cols'] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] }));

            XLSX.writeFile(workbook, `Resumen_Cuentas_ORE_${new Date().toLocaleDateString('es-BO')}.xlsx`);
        } catch (error) {
            alert("Error al exportar a Excel");
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const datosAEnviar = {
            ...formData,
            saldo_inicial: parseFloat(formData.saldo_inicial) || 0
        };

        const accion = editandoId
            ? supabase.from('directorio_cuentas').update(datosAEnviar).eq('id', editandoId)
            : supabase.from('directorio_cuentas').insert([datosAEnviar]);

        const { error } = await accion;
        if (!error) {
            setModalAbierto(false);
            setFormData(valoresPorDefecto);
            setEditandoId(null);
            fetchCuentas();
        }
    };

    const eliminarCuenta = async (id) => {
        if (window.confirm("¿Eliminar esta cuenta del directorio?")) {
            await supabase.from('directorio_cuentas').delete().eq('id', id);
            fetchCuentas();
        }
    };

    return (
        <div className="p-8 max-w-[95%] mx-auto flex flex-col gap-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Directorio de Cuentas y Proveedores</h1>
                    <p className="text-sm text-slate-500">Administra las finanzas y saldos disponibles en tiempo real.</p>
                </div>
                <button
                    onClick={() => { setEditandoId(null); setFormData(valoresPorDefecto); setModalAbierto(true); }}
                    className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all"
                >
                    + Añadir Cuenta
                </button>
            </div>

            {/* PANEL RESUMEN DE CUENTAS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b pb-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <span>📊</span> Resumen del Flujo de Cuentas
                        </h2>
                        <p className="text-xs text-slate-500">Total acumulado de flujos entrantes y salientes por cuenta conciliada.</p>
                    </div>
                    <button
                        onClick={descargarExcel}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        📥 Descargar Excel
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 uppercase text-[9px] font-bold text-slate-500 border-b">
                            <tr>
                                <th className="px-4 py-3">Alias</th>
                                <th className="px-4 py-3">Titular</th>
                                <th className="px-4 py-3">Banco / Nro. Cuenta</th>
                                <th className="px-4 py-3 text-right">Saldo Inicial</th>
                                <th className="px-4 py-3 text-right">Dinero Entrante</th>
                                <th className="px-4 py-3 text-right">Dinero Saliente</th>
                                <th className="px-4 py-3 text-right">Balance Neto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {resumenCuentas.length === 0 ? (
                                <tr><td colSpan="7" className="p-6 text-center text-slate-400 italic">No hay cuentas registradas.</td></tr>
                            ) : (
                                resumenCuentas.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-800">{c.alias}</td>
                                        <td className="px-4 py-3 font-medium text-slate-600">{c.titular}</td>
                                        <td className="px-4 py-3 font-mono text-slate-400">{c.banco} ({c.numero_cuenta || 'S/N'})</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-500">Bs. {Number(c.saldo_inicial || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-600">Bs. {c.entrante.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-bold text-red-500">Bs. {c.saliente.toFixed(2)}</td>
                                        <td className={`px-4 py-3 text-right font-black ${c.neto >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                                            Bs. {c.neto.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cuentas.map(c => (
                    <div key={c.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between gap-4 relative group">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase 
                                    ${c.tipo === 'Propia' ? 'bg-emerald-100 text-emerald-700' :
                                        c.tipo === 'Personal' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {c.tipo}
                                </span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditandoId(c.id); setFormData(c); setModalAbierto(true); }} className="text-blue-500 hover:text-blue-700 text-xs font-bold">✏️ Editar</button>
                                    <button onClick={() => eliminarCuenta(c.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">🗑️</button>
                                </div>
                            </div>
                            <h3 className="text-lg font-black text-slate-800">{c.alias}</h3>
                            <div className="text-xs space-y-1 text-slate-500 font-medium">
                                <p><span className="font-bold text-slate-700">Banco:</span> {c.banco}</p>
                                <p><span className="font-bold text-slate-700">Nro:</span> {c.numero_cuenta || '-'}</p>
                                <p><span className="font-bold text-slate-700">Titular:</span> {c.titular}</p>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Saldo Disponible</span>
                            <span className={`text-lg font-black ${c.saldo_actual >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                Bs. {Number(c.saldo_actual).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {modalAbierto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 flex flex-col gap-4">
                        <h2 className="text-xl font-black text-slate-800">{editandoId ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}</h2>

                        <div className="space-y-3">
                            <input type="text" placeholder="Alias de la Cuenta" required className="w-full border rounded-xl px-4 py-2.5 font-bold" value={formData.alias} onChange={e => setFormData({ ...formData, alias: e.target.value })} />
                            <input type="text" placeholder="Titular de la cuenta" required className="w-full border rounded-xl px-4 py-2.5" value={formData.titular} onChange={e => setFormData({ ...formData, titular: e.target.value })} />

                            <select required className="w-full border rounded-xl px-4 py-2.5 bg-white" value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })}>
                                <option value="">Seleccionar Banco...</option>
                                <option value="Banco Mercantil Santa Cruz">Banco Mercantil</option>
                                <option value="Banco Ganadero">Banco Ganadero</option>
                                <option value="Banco Unión">Banco Unión</option>
                                <option value="BCP">BCP</option>
                                <option value="Bisa">Bisa</option>
                                <option value="Economico">Economico</option>
                                <option value="BNB">BNB</option>
                                <option value="Efectivo / Caja">Efectivo / Caja</option>
                            </select>

                            <input type="text" placeholder="Número de Cuenta" className="w-full border rounded-xl px-4 py-2.5" value={formData.numero_cuenta} onChange={e => setFormData({ ...formData, numero_cuenta: e.target.value })} />

                            <div className="grid grid-cols-2 gap-2">
                                <select className="border rounded-xl px-4 py-2.5 bg-white font-bold text-slate-700" value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
                                    <option value="Propia">Cuenta Propia</option>
                                    <option value="Proveedor">Proveedor</option>
                                    <option value="Personal">Personal</option>
                                </select>
                                <input type="number" step="0.01" placeholder="Saldo Inicial (Bs.)" required={!editandoId} disabled={!!editandoId} className="border rounded-xl px-4 py-2.5 font-black text-emerald-600 disabled:bg-slate-50" value={formData.saldo_inicial} onChange={e => setFormData({ ...formData, saldo_inicial: e.target.value })} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-4 border-t pt-4">
                            <button type="button" onClick={() => setModalAbierto(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-black rounded-xl">Guardar Cuenta</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}