import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function CuentasPage() {
    const [cuentas, setCuentas] = useState([]);
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
        const { data: dataFinanzas } = await supabase.from('finanzas').select('cuenta_id, monto, tipo');

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