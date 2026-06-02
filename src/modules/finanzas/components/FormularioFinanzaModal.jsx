import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function FormularioFinanzaModal({ isOpen, onClose, onGuardado }) {
    const [guardando, setGuardando] = useState(false);
    const [clientes, setClientes] = useState([]);
    const [personal, setPersonal] = useState([]);

    const [formData, setFormData] = useState({
        tipo: 'Gasto',
        categoria: '',
        concepto: '',
        monto: '',
        cliente_id: '',
        servicio: '',
        banco: 'Efectivo',
        numero_cuenta: '',
        titular: '',
        id_operacion: ''
    });

    useEffect(() => {
        if (isOpen) {
            cargarDatosBasicos();
            setFormData({
                tipo: 'Gasto', categoria: '', concepto: '', monto: '',
                cliente_id: '', servicio: '', banco: 'Efectivo',
                numero_cuenta: '', titular: '', id_operacion: ''
            });
        }
    }, [isOpen]);

    const cargarDatosBasicos = async () => {
        // ADAPTADO: Ahora consultamos la tabla 'clientes'
        const { data: dataClientes } = await supabase.from('clientes').select('*').eq('cerrado', false);
        if (dataClientes) setClientes(dataClientes);

        const { data: dataPersonal } = await supabase.from('directorio_cuentas').select('*').eq('tipo', 'Personal');
        if (dataPersonal) setPersonal(dataPersonal);
    };

    const handleSeleccionarEmpleado = (e) => {
        const idEmpleado = e.target.value;
        const empleado = personal.find(p => p.id === idEmpleado);

        if (empleado) {
            setFormData({
                ...formData,
                servicio: `Sueldo: ${empleado.titular}`,
                banco: empleado.banco || 'Efectivo',
                numero_cuenta: empleado.numero_cuenta || '',
                titular: empleado.titular || ''
            });
        } else {
            setFormData({ ...formData, servicio: '', banco: 'Efectivo', numero_cuenta: '', titular: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);

        const datosParaSupabase = {
            ...formData,
            monto: parseFloat(formData.monto) // Aseguramos que sea número
        };

        if (datosParaSupabase.cliente_id === 'pago-personal') {
            datosParaSupabase.cliente_id = null;
            datosParaSupabase.categoria = 'Nómina y Salarios';
        } else if (datosParaSupabase.cliente_id === '') {
            datosParaSupabase.cliente_id = null;
        }

        const { error } = await supabase.from('finanzas').insert([datosParaSupabase]);

        setGuardando(false);

        if (!error) {
            onGuardado();
            onClose();
        } else {
            alert("Error al guardar el movimiento.");
            console.error(error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <span>💸</span> Registrar Movimiento
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center font-bold transition-colors">
                        &times;
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="form-finanzas" onSubmit={handleSubmit} className="flex flex-col gap-6">

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Movimiento</label>
                                <select
                                    required
                                    value={formData.tipo}
                                    onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                    className={`border-2 rounded-xl px-4 py-3 outline-none font-black transition-colors cursor-pointer
                                        ${formData.tipo === 'Ingreso' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}
                                    `}
                                >
                                    <option value="Ingreso">📈 INGRESO</option>
                                    <option value="Gasto">📉 GASTO</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto (Bs.) *</label>
                                <input
                                    type="number" step="0.01" required
                                    value={formData.monto}
                                    onChange={e => setFormData({ ...formData, monto: e.target.value })}
                                    className="border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-black text-slate-800 text-lg"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concepto / Detalle *</label>
                            <input
                                type="text" required
                                value={formData.concepto}
                                onChange={e => setFormData({ ...formData, concepto: e.target.value })}
                                className="border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 font-medium text-slate-800 bg-slate-50 focus:bg-white transition-colors"
                                placeholder="Ej: Adelanto de pago, Compra de insumos..."
                            />
                        </div>

                        <hr className="border-slate-100" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vincular a Proyecto</label>
                                <select
                                    value={formData.cliente_id}
                                    onChange={e => setFormData({ ...formData, cliente_id: e.target.value })}
                                    className="border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 font-bold text-slate-700 bg-slate-50 cursor-pointer"
                                >
                                    <option value="">-- Gasto General / Ninguno --</option>
                                    {formData.tipo === 'Gasto' && (
                                        <option value="pago-personal" className="bg-indigo-100 text-indigo-800 font-black">
                                            🏢 PAGO AL PERSONAL / NÓMINA
                                        </option>
                                    )}
                                    <optgroup label="Leads / Clientes Activos">
                                        {clientes.map(c => (
                                            /* ADAPTADO: Usamos 'c.nombre' */
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${formData.cliente_id === 'pago-personal' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    {formData.cliente_id === 'pago-personal' ? '💼 Seleccionar Empleado' : '🛠️ Servicio Realizado'}
                                </label>

                                {formData.cliente_id === 'pago-personal' ? (
                                    <select
                                        onChange={handleSeleccionarEmpleado}
                                        className="border-2 border-indigo-200 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 font-black text-indigo-800 bg-indigo-50 cursor-pointer"
                                    >
                                        <option value="">-- Elegir Empleado --</option>
                                        {personal.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.titular}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <select
                                        value={formData.servicio}
                                        onChange={e => setFormData({ ...formData, servicio: e.target.value })}
                                        className="border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 font-bold text-slate-700 bg-slate-50 cursor-pointer"
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        <option value="Limpieza de interiores">Limpieza de interiores</option>
                                        <option value="Encerado de pisos">Encerado de pisos</option>
                                        <option value="Limpieza de vidrios">Limpieza de vidrios</option>
                                        <option value="Servicio Completo">Servicio Completo</option>
                                    </select>
                                )}
                            </div>
                        </div>

                        {formData.cliente_id !== 'pago-personal' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría Contable</label>
                                <select
                                    value={formData.categoria}
                                    onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                                    className="border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 font-medium text-slate-700 bg-slate-50"
                                >
                                    <option value="">-- General --</option>
                                    {formData.tipo === 'Ingreso' ? (
                                        <>
                                            <option value="Venta Directa">Venta Directa</option>
                                            <option value="Abono / Anticipo">Abono / Anticipo</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="Materiales/Insumos">Materiales/Insumos</option>
                                            <option value="Transporte">Transporte</option>
                                            <option value="Publicidad">Publicidad / Marketing</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        )}

                        <hr className="border-slate-100" />

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <h3 className="text-xs font-black text-slate-700 mb-3 flex items-center gap-2"><span>🏦</span> Datos de Conciliación Bancaria</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input type="text" placeholder="Banco (Ej. BNB, BCP, Efectivo)" value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                <input type="text" placeholder="Nro de Cuenta" value={formData.numero_cuenta} onChange={e => setFormData({ ...formData, numero_cuenta: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                <input type="text" placeholder="Titular de la cuenta" value={formData.titular} onChange={e => setFormData({ ...formData, titular: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                                <input type="text" placeholder="ID de Transacción / Ref" value={formData.id_operacion} onChange={e => setFormData({ ...formData, id_operacion: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                    <button type="submit" form="form-finanzas" disabled={guardando} className="px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-600/30 disabled:opacity-50 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
                        {guardando ? 'Guardando...' : 'Confirmar Registro'}
                    </button>
                </div>
            </div>
        </div>
    );
}