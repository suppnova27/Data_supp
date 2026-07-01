import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const SERVICIOS_REALES = ['Limpieza Rutinaria', 'Limpieza Profunda', 'Limpieza Post Obra', 'Lavado de Tapicería', 'Servicio Corporativo'];

export default function FormularioFinanzaModal({ isOpen, onClose, onGuardado }) {
    const [guardando, setGuardando] = useState(false);
    const [clientes, setClientes] = useState([]);
    const [personal, setPersonal] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [productos, setProductos] = useState([]);

    const [formData, setFormData] = useState({
        tipo: 'Gasto',
        categoria: '',
        concepto: '',
        monto: '',
        cliente_id: '',
        servicio: SERVICIOS_REALES[0],
        banco: 'Efectivo',
        numero_cuenta: '',
        titular: '',
        cuenta_id: '',
        id_operacion: '' // 👈 Nuevo campo
    });

    const [consumo, setConsumo] = useState({ inventario_id: '', cantidad: 0 });

    useEffect(() => {
        if (isOpen) {
            cargarDatosBasicos();
            setFormData({
                tipo: 'Gasto',
                categoria: '',
                concepto: '',
                monto: '',
                cliente_id: '',
                servicio: SERVICIOS_REALES[0],
                banco: 'Efectivo',
                numero_cuenta: '',
                titular: '',
                cuenta_id: '',
                id_operacion: ''
            });
            setConsumo({ inventario_id: '', cantidad: 0 });
        }
    }, [isOpen]);

    const cargarDatosBasicos = async () => {
        const { data: dataClientes } = await supabase.from('clientes').select('id, nombres').eq('cerrado', false);
        if (dataClientes) setClientes(dataClientes);
        const { data: dataPersonal } = await supabase.from('directorio_cuentas').select('*').eq('tipo', 'Personal');
        if (dataPersonal) setPersonal(dataPersonal);
        // 👇 Ahora incluye numero_cuenta y titular
        const { data: dataCuentas } = await supabase.from('directorio_cuentas').select('id, alias, banco, numero_cuenta, titular').eq('tipo', 'Propia');
        if (dataCuentas) setCuentas(dataCuentas);
        const { data: dataInv } = await supabase.from('inventario').select('id, nombre, cantidad, unidad_medida');
        if (dataInv) setProductos(dataInv);
    };

    // 👇 Autocompletado inteligente: ahora con todos los datos bancarios
    const handleSeleccionarCuenta = (id) => {
        const ctaSeleccionada = cuentas.find(c => c.id === id);
        if (ctaSeleccionada) {
            setFormData({
                ...formData,
                cuenta_id: id,
                banco: ctaSeleccionada.banco,
                numero_cuenta: ctaSeleccionada.numero_cuenta || '',
                titular: ctaSeleccionada.titular || ''
            });
        } else {
            setFormData({
                ...formData,
                cuenta_id: '',
                banco: 'Efectivo',
                numero_cuenta: '',
                titular: ''
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        const datosParaSupabase = {
            ...formData,
            monto: parseFloat(formData.monto),
            cuenta_id: formData.cuenta_id || null
        };

        if (datosParaSupabase.cliente_id === 'pago-personal') {
            datosParaSupabase.cliente_id = null;
            datosParaSupabase.categoria = 'Nómina y Salarios';
        } else if (datosParaSupabase.cliente_id === '') {
            datosParaSupabase.cliente_id = null;
        }

        const { data: nuevaFinanza, error: errFinanza } = await supabase
            .from('finanzas')
            .insert([datosParaSupabase])
            .select()
            .single();

        if (!errFinanza && formData.tipo === 'Gasto' && consumo.inventario_id) {
            const producto = productos.find(p => p.id === consumo.inventario_id);
            if (producto) {
                await supabase.from('consumo_inventario').insert({
                    finanza_id: nuevaFinanza.id,
                    inventario_id: consumo.inventario_id,
                    cantidad_usada: consumo.cantidad
                });
                await supabase
                    .from('inventario')
                    .update({ cantidad: producto.cantidad - consumo.cantidad })
                    .eq('id', consumo.inventario_id);
            }
        }
        setGuardando(false);
        if (!errFinanza) {
            onGuardado();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-t-4 border-t-[#ffdd1c]">

                {/* CABECERA DEL MODAL */}
                <div className="p-6 border-b bg-white flex justify-between items-center relative overflow-hidden">
                    <div className="absolute -left-10 -top-10 w-32 h-32 bg-[#0055af] opacity-5 rounded-full blur-2xl"></div>
                    <h2 className="text-xl font-black text-[#0055af] flex items-center gap-2 relative z-10">💸 Registrar Movimiento</h2>
                    <button onClick={onClose} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 font-bold transition-colors">
                        &times;
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="form-finanzas" onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Tipo y Monto */}
                        <div className="grid grid-cols-2 gap-4">
                            <select required value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className="border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-slate-700 outline-none focus:border-[#0055af]">
                                <option value="Ingreso">📈 INGRESO</option>
                                <option value="Gasto">📉 GASTO</option>
                            </select>
                            <input type="number" step="0.01" required value={formData.monto} onChange={e => setFormData({ ...formData, monto: e.target.value })} className="border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-lg outline-none focus:border-[#0055af]" placeholder="Monto (Bs.)" />
                        </div>

                        {/* NUEVA SECCIÓN: Cuenta bancaria + ID Operación */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cuenta Bancaria</label>
                                <select
                                    required
                                    value={formData.cuenta_id}
                                    onChange={(e) => handleSeleccionarCuenta(e.target.value)}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]"
                                >
                                    <option value="">-- Seleccionar Cuenta --</option>
                                    {cuentas.map(cta => (
                                        <option key={cta.id} value={cta.id}>{cta.alias} ({cta.banco})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">ID Operación / Ref</label>
                                <input
                                    type="text"
                                    placeholder="Ej. TRANS-12345"
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#0055af]"
                                    value={formData.id_operacion || ''}
                                    onChange={e => setFormData({ ...formData, id_operacion: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Campos de solo lectura con datos bancarios */}
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="text"
                                readOnly
                                className="border-none bg-slate-50 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500"
                                value={`Banco: ${formData.banco || 'Efectivo'}`}
                            />
                            <input
                                type="text"
                                readOnly
                                className="border-none bg-slate-50 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500"
                                value={`Titular: ${formData.titular || 'N/A'}`}
                            />
                        </div>

                        {/* Concepto */}
                        <input
                            type="text"
                            required
                            placeholder="Concepto / Detalle"
                            className="border rounded-xl px-4 py-3 outline-none focus:border-[#0055af] text-sm font-bold"
                            value={formData.concepto}
                            onChange={e => setFormData({ ...formData, concepto: e.target.value })}
                        />

                        {/* Consumo de inventario (solo si es gasto) */}
                        {formData.tipo === 'Gasto' && (
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex flex-col gap-2">
                                <label className="text-[10px] font-black text-amber-800 uppercase block">¿Consumiste insumos de inventario?</label>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 border rounded-lg px-2 py-2 text-sm bg-white font-bold text-slate-700"
                                        onChange={e => setConsumo({ ...consumo, inventario_id: e.target.value })}
                                    >
                                        <option value="">Seleccionar producto...</option>
                                        {productos.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre} ({p.cantidad} disp.)</option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            placeholder="Cant."
                                            className="w-20 border rounded-lg px-2 py-2 text-sm font-bold"
                                            onChange={e => setConsumo({ ...consumo, cantidad: parseFloat(e.target.value) })}
                                        />
                                        <span className="text-[10px] font-bold text-amber-700 uppercase w-12">
                                            {consumo.inventario_id ? productos.find(p => p.id === consumo.inventario_id)?.unidad_medida : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Proyecto / Cliente y Servicio */}
                        <div className="grid grid-cols-2 gap-4">
                            <select
                                value={formData.cliente_id}
                                onChange={e => setFormData({ ...formData, cliente_id: e.target.value })}
                                className="border rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]"
                            >
                                <option value="">-- Proyecto (Cliente) --</option>
                                {formData.tipo === 'Gasto' && (
                                    <option value="pago-personal" className="bg-[#ffdd1c]/20 text-[#0055af]">🏢 PAGO AL PERSONAL</option>
                                )}
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombres}</option>
                                ))}
                            </select>

                            {formData.cliente_id === 'pago-personal' ? (
                                <select
                                    onChange={e => {
                                        const emp = personal.find(p => p.id === e.target.value);
                                        if (emp)
                                            setFormData({
                                                ...formData,
                                                servicio: `Sueldo: ${emp.titular}`,
                                                banco: emp.banco,
                                                numero_cuenta: emp.numero_cuenta,
                                                titular: emp.titular
                                            });
                                    }}
                                    className="border rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]"
                                >
                                    <option value="">-- Seleccionar Empleado --</option>
                                    {personal.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.titular}</option>
                                    ))}
                                </select>
                            ) : (
                                <select
                                    value={formData.servicio}
                                    onChange={e => setFormData({ ...formData, servicio: e.target.value })}
                                    className="border rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]"
                                >
                                    {SERVICIOS_REALES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </form>
                </div>

                {/* BOTONES */}
                <div className="p-6 border-t bg-white flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-full transition-colors text-xs uppercase tracking-widest"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="form-finanzas"
                        disabled={guardando}
                        className="px-8 py-3 bg-[#0055af] text-white font-black rounded-full hover:-translate-y-1 shadow-lg shadow-[#0055af]/30 transition-all text-xs uppercase tracking-widest border-2 border-[#0055af] hover:border-[#ffdd1c]"
                    >
                        {guardando ? 'Procesando...' : 'Confirmar Registro'}
                    </button>
                </div>
            </div>
        </div>
    );
}