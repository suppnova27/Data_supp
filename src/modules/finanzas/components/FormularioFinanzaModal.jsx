import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const SERVICIOS_REALES = [
    '🧹 Limpieza Rutinaria',
    '🏠 Limpieza Profunda Integral',
    '🏗️ Limpieza Post Obra',
    '🛋️ Desinfección de Muebles y Alfombras',
    '🏢 Servicios Corporativos',
    '✨ Otro (Especificar)'
];

const SUB_SERVICIOS_RUTINARIA = [
    'Lavado de sofá',
    'Lavado de sillas',
    'Lavado de colchón',
    'Lavado de alfombra',
    'Lavado de cortinas',
    'Otro (Especificar)'
];

// Función auxiliar para obtener la fecha de hoy en formato YYYY-MM-DD
const obtenerFechaHoy = () => new Date().toISOString().split('T')[0];

export default function FormularioFinanzaModal({ isOpen, onClose, onGuardado, finanzaEditando }) {
    const [guardando, setGuardando] = useState(false);
    const [clientes, setClientes] = useState([]);
    const [personal, setPersonal] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [productos, setProductos] = useState([]);

    const [formData, setFormData] = useState({
        fecha_registro: obtenerFechaHoy(), // <-- Nuevo campo
        tipo: 'Gasto', categoria: '', concepto: '', monto: '', cliente_id: '',
        servicio: SERVICIOS_REALES[0], sub_servicio: SUB_SERVICIOS_RUTINARIA[0],
        servicio_manual: '', sub_servicio_manual: '',
        banco: 'Efectivo', numero_cuenta: '', titular: '', id_operacion: '', cuenta_id: ''
    });

    const [consumo, setConsumo] = useState({ inventario_id: '', cantidad: 0 });

    useEffect(() => {
        if (isOpen) {
            cargarDatosBasicos();

            if (finanzaEditando) {
                let servicioBase = finanzaEditando.servicio || '';
                let subServ = SUB_SERVICIOS_RUTINARIA[0];
                let servManual = '';
                let subManual = '';

                if (servicioBase.startsWith('🧹 Limpieza Rutinaria - ')) {
                    const partes = servicioBase.split(' - ');
                    servicioBase = partes[0];
                    const subExtraido = partes.slice(1).join(' - ');

                    if (SUB_SERVICIOS_RUTINARIA.includes(subExtraido)) {
                        subServ = subExtraido;
                    } else {
                        subServ = 'Otro (Especificar)';
                        subManual = subExtraido;
                    }
                } else if (!SERVICIOS_REALES.includes(servicioBase) && servicioBase !== '' && finanzaEditando.cliente_id !== null) {
                    servManual = servicioBase;
                    servicioBase = '✨ Otro (Especificar)';
                }

                setFormData({
                    fecha_registro: finanzaEditando.fecha_registro ? finanzaEditando.fecha_registro.split('T')[0] : obtenerFechaHoy(), // <-- Cargar fecha al editar
                    tipo: finanzaEditando.tipo,
                    categoria: finanzaEditando.categoria || '',
                    concepto: finanzaEditando.concepto,
                    monto: finanzaEditando.monto,
                    cliente_id: finanzaEditando.cliente_id || '',
                    servicio: servicioBase,
                    sub_servicio: subServ,
                    servicio_manual: servManual,
                    sub_servicio_manual: subManual,
                    banco: finanzaEditando.banco || 'Efectivo',
                    numero_cuenta: finanzaEditando.numero_cuenta || '',
                    titular: finanzaEditando.titular || '',
                    id_operacion: finanzaEditando.id_operacion || '',
                    cuenta_id: finanzaEditando.cuenta_id || ''
                });
            } else {
                setFormData({
                    fecha_registro: obtenerFechaHoy(), // <-- Reset a hoy al crear nuevo
                    tipo: 'Gasto', categoria: '', concepto: '', monto: '', cliente_id: '',
                    servicio: SERVICIOS_REALES[0], sub_servicio: SUB_SERVICIOS_RUTINARIA[0],
                    servicio_manual: '', sub_servicio_manual: '',
                    banco: 'Efectivo', numero_cuenta: '', titular: '', id_operacion: '', cuenta_id: ''
                });
                setConsumo({ inventario_id: '', cantidad: 0 });
            }
        }
    }, [isOpen, finanzaEditando]);

    const cargarDatosBasicos = async () => {
        const { data: dataClientes } = await supabase.from('clientes').select('id, nombres').eq('cerrado', false);
        if (dataClientes) setClientes(dataClientes);
        const { data: dataPersonal } = await supabase.from('directorio_cuentas').select('*').eq('tipo', 'Personal');
        if (dataPersonal) setPersonal(dataPersonal);
        const { data: dataCuentas } = await supabase.from('directorio_cuentas').select('id, alias, banco, numero_cuenta, titular').eq('tipo', 'Propia');
        if (dataCuentas) setCuentas(dataCuentas);
        const { data: dataInv } = await supabase.from('inventario').select('id, nombre, cantidad, unidad_medida');
        if (dataInv) setProductos(dataInv);
    };

    const handleSeleccionarCuenta = (id) => {
        const ctaSeleccionada = cuentas.find(c => c.id === id);
        if (ctaSeleccionada) {
            setFormData({
                ...formData, cuenta_id: id, banco: ctaSeleccionada.banco,
                numero_cuenta: ctaSeleccionada.numero_cuenta, titular: ctaSeleccionada.titular
            });
        } else {
            setFormData({ ...formData, cuenta_id: '', banco: 'Efectivo', numero_cuenta: '', titular: '' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);

        let servicioFinal = formData.servicio === '✨ Otro (Especificar)' ? formData.servicio_manual : formData.servicio;

        if (formData.servicio === '🧹 Limpieza Rutinaria') {
            const subFinal = formData.sub_servicio === 'Otro (Especificar)' ? formData.sub_servicio_manual : formData.sub_servicio;
            if (subFinal) {
                servicioFinal = `${formData.servicio} - ${subFinal}`;
            }
        }

        const datosParaSupabase = {
            fecha_registro: formData.fecha_registro, // <-- Se envía la fecha seleccionada
            tipo: formData.tipo,
            categoria: formData.categoria,
            concepto: formData.concepto,
            monto: parseFloat(formData.monto),
            cliente_id: formData.cliente_id || null,
            servicio: servicioFinal,
            banco: formData.banco,
            numero_cuenta: formData.numero_cuenta,
            titular: formData.titular,
            id_operacion: formData.id_operacion,
            cuenta_id: formData.cuenta_id || null
        };

        if (datosParaSupabase.cliente_id === 'pago-personal') {
            datosParaSupabase.cliente_id = null;
            datosParaSupabase.categoria = 'Nómina y Salarios';
        }

        let errFinanza = null;
        let nuevaFinanza = null;

        if (finanzaEditando) {
            const { error } = await supabase.from('finanzas').update(datosParaSupabase).eq('id', finanzaEditando.id);
            errFinanza = error;
        } else {
            const { data, error } = await supabase.from('finanzas').insert([datosParaSupabase]).select().single();
            nuevaFinanza = data;
            errFinanza = error;

            if (!errFinanza && formData.tipo === 'Gasto' && consumo.inventario_id) {
                const producto = productos.find(p => p.id === consumo.inventario_id);
                if (producto) {
                    await supabase.from('consumo_inventario').insert({ finanza_id: nuevaFinanza.id, inventario_id: consumo.inventario_id, cantidad_usada: consumo.cantidad });
                    await supabase.from('inventario').update({ cantidad: producto.cantidad - consumo.cantidad }).eq('id', consumo.inventario_id);
                }
            }
        }

        setGuardando(false);
        if (!errFinanza) { onGuardado(); onClose(); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-t-4 border-t-[#ffdd1c]">

                <div className="p-6 border-b bg-white flex justify-between items-center relative overflow-hidden">
                    <div className="absolute -left-10 -top-10 w-32 h-32 bg-[#0055af] opacity-5 rounded-full blur-2xl"></div>
                    <h2 className="text-xl font-black text-[#0055af] flex items-center gap-2 relative z-10">
                        {finanzaEditando ? '✏️ Editar Movimiento' : '💸 Registrar Movimiento'}
                    </h2>
                    <button onClick={onClose} className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 font-bold transition-colors">
                        &times;
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="form-finanzas" onSubmit={handleSubmit} className="flex flex-col gap-5">

                        {/* PRIMERA FILA: Fecha, Tipo y Monto */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Fecha</label>
                                <input type="date" required value={formData.fecha_registro} onChange={e => setFormData({ ...formData, fecha_registro: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]" />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo de Movimiento</label>
                                <select required value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-slate-700 outline-none focus:border-[#0055af]">
                                    <option value="Ingreso">📈 INGRESO</option>
                                    <option value="Gasto">📉 GASTO</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Monto (Bs.)</label>
                                <input type="number" step="0.01" required value={formData.monto} onChange={e => setFormData({ ...formData, monto: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-lg outline-none focus:border-[#0055af]" placeholder="0.00" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cuenta Bancaria</label>
                                <select required value={formData.cuenta_id} onChange={(e) => handleSeleccionarCuenta(e.target.value)} className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm bg-white outline-none focus:border-[#0055af]">
                                    <option value="">-- Seleccionar Cuenta --</option>
                                    {cuentas.map(cta => <option key={cta.id} value={cta.id}>{cta.alias} ({cta.banco})</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">ID Operación / Ref</label>
                                <input type="text" placeholder="Ej. TRANS-12345" className="border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-[#0055af]" value={formData.id_operacion || ''} onChange={e => setFormData({ ...formData, id_operacion: e.target.value })} />
                            </div>
                        </div>

                        <input type="text" required placeholder="Concepto / Detalle" className="border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-[#0055af] text-sm font-bold mt-2" value={formData.concepto} onChange={e => setFormData({ ...formData, concepto: e.target.value })} />

                        {!finanzaEditando && formData.tipo === 'Gasto' && (
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex flex-col gap-2">
                                <label className="text-[10px] font-black text-amber-800 uppercase block">¿Consumiste insumos de inventario?</label>
                                <div className="flex gap-2">
                                    <select className="flex-1 border-2 border-amber-100 rounded-lg px-3 py-2 text-sm bg-white font-bold text-slate-700 outline-none" onChange={e => setConsumo({ ...consumo, inventario_id: e.target.value })}>
                                        <option value="">Seleccionar producto...</option>
                                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.cantidad} disp.)</option>)}
                                    </select>
                                    <div className="flex items-center gap-1">
                                        <input type="number" placeholder="Cant." className="w-20 border-2 border-amber-100 rounded-lg px-2 py-2 text-sm font-bold outline-none text-center" onChange={e => setConsumo({ ...consumo, cantidad: parseFloat(e.target.value) })} />
                                        <span className="text-[10px] font-bold text-amber-700 uppercase w-12">{consumo.inventario_id ? productos.find(p => p.id === consumo.inventario_id)?.unidad_medida : ''}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Proyecto Vinculado</label>
                                <select value={formData.cliente_id} onChange={e => setFormData({ ...formData, cliente_id: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                    <option value="">-- Proyecto (Cliente) --</option>
                                    {formData.tipo === 'Gasto' && (<option value="pago-personal" className="bg-[#ffdd1c]/20 text-[#0055af]">🏢 PAGO AL PERSONAL</option>)}
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombres}</option>)}
                                </select>
                            </div>

                            {formData.cliente_id === 'pago-personal' ? (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Seleccionar Empleado</label>
                                    <select onChange={e => {
                                        const emp = personal.find(p => p.id === e.target.value);
                                        if (emp) setFormData({ ...formData, servicio: `Sueldo: ${emp.titular}`, banco: emp.banco, numero_cuenta: emp.numero_cuenta, titular: emp.titular });
                                    }} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                        <option value="">-- Seleccionar Empleado --</option>
                                        {personal.map(emp => <option key={emp.id} value={emp.id}>{emp.titular}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Servicio Realizado</label>
                                    <select value={formData.servicio} onChange={e => setFormData({ ...formData, servicio: e.target.value })} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                        {SERVICIOS_REALES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>

                                    {formData.servicio === '✨ Otro (Especificar)' && (
                                        <input type="text" placeholder="Escribe el servicio aquí..." required className="border-2 border-emerald-200 bg-emerald-50 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-emerald-500 animate-in slide-in-from-top-2" value={formData.servicio_manual} onChange={e => setFormData({ ...formData, servicio_manual: e.target.value })} />
                                    )}

                                    {formData.servicio === '🧹 Limpieza Rutinaria' && (
                                        <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                                            <select value={formData.sub_servicio} onChange={e => setFormData({ ...formData, sub_servicio: e.target.value })} className="border-2 border-blue-200 bg-blue-50 text-[#0055af] rounded-xl px-4 py-2 text-xs font-black outline-none focus:border-[#0055af]">
                                                {SUB_SERVICIOS_RUTINARIA.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                            </select>

                                            {formData.sub_servicio === 'Otro (Especificar)' && (
                                                <input type="text" placeholder="¿Qué se va a lavar?" required className="border-2 border-emerald-200 bg-emerald-50 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-emerald-500 animate-in slide-in-from-top-2" value={formData.sub_servicio_manual} onChange={e => setFormData({ ...formData, sub_servicio_manual: e.target.value })} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t bg-white flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-full transition-colors text-xs uppercase tracking-widest">
                        Cancelar
                    </button>
                    <button type="submit" form="form-finanzas" disabled={guardando} className="px-8 py-3 bg-[#0055af] text-white font-black rounded-full hover:-translate-y-1 shadow-lg shadow-[#0055af]/30 transition-all text-xs uppercase tracking-widest border-2 border-[#0055af] hover:border-[#ffdd1c]">
                        {guardando ? 'Procesando...' : (finanzaEditando ? 'Actualizar Registro' : 'Confirmar Registro')}
                    </button>
                </div>
            </div>
        </div>
    );
}