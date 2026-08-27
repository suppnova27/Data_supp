import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const SUB_SERVICIOS_RUTINARIA = [
    'Lavado de sofá',
    'Lavado de sillas',
    'Lavado de colchón',
    'Lavado de alfombra',
    'Lavado de cortinas',
    'Otro (Especificar)'
];

async function cargarEtiquetasBD() {
    try {
        const { data, error } = await supabase
            .from('etiquetas')
            .select('id, nombre, color')
            .order('nombre', { ascending: true });
        
        if (error) {
            console.error('Error cargando etiquetas:', error.message);
            return [];
        }
        return (data || []).filter(e => e.activa !== false);
    } catch (e) {
        console.error('Excepción cargando etiquetas:', e);
        return [];
    }
}

async function cargarServiciosBD(etiquetaId = null) {
    try {
        let query = supabase
            .from('servicios')
            .select('id, nombre, etiqueta_id, activa');
        
        const { data, error } = await query.order('nombre', { ascending: true });
        
        if (error) {
            console.error('Error cargando servicios:', error.message);
            return [];
        }

        let servicios = (data || []).filter(s => s.activa !== false);

        if (etiquetaId) {
            servicios = servicios.filter(s => s.etiqueta_id === etiquetaId);
        }
        
        const nombres = servicios.map(s => s.nombre);
        if (!nombres.includes('✨ Otro (Especificar)')) {
            nombres.push('✨ Otro (Especificar)');
        }
        return nombres;
    } catch (e) {
        console.error('Excepción cargando servicios:', e);
        return [];
    }
}

async function cargarProyectosBD() {
    try {
        const { data, error } = await supabase
            .from('proyectos')
            .select('id, nombre, cliente_id')
            .eq('activa', true)
            .order('nombre', { ascending: true });

        if (error) {
            // Si la tabla aún no existe (migración pendiente), devolvemos lista vacía
            console.warn('Aviso cargando proyectos:', error.message);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Excepción cargando proyectos:', e);
        return [];
    }
}

const obtenerFechaHoy = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


export default function FormularioFinanzaModal({ isOpen, onClose, onGuardado, finanzaEditando }) {
    const [guardando, setGuardando] = useState(false);
    const [clientes, setClientes] = useState([]);
    const [personal, setPersonal] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [productos, setProductos] = useState([]);
    const [etiquetas, setEtiquetas] = useState([]);
    const [etiquetaSeleccionada, setEtiquetaSeleccionada] = useState('');
    const [catalogoServicios, setCatalogoServicios] = useState([]);
    const [proyectos, setProyectos] = useState([]);

    const [formData, setFormData] = useState({
        fecha_registro: obtenerFechaHoy(),
        tipo: 'Gasto', categoria: '', concepto: '', monto: '',
        cliente_id: '', personal_id: '', proyecto_id: '',
        servicio: '', sub_servicio: SUB_SERVICIOS_RUTINARIA[0],
        servicio_manual: '', sub_servicio_manual: '',
        banco: 'Efectivo', numero_cuenta: '', titular: '', id_operacion: '', cuenta_id: ''
    });

    const [consumo, setConsumo] = useState({ inventario_id: '', cantidad: 0 });

    async function cargarDatosBasicos() {
        const { data: dataClientes } = await supabase.from('clientes').select('id, nombres').order('nombres', { ascending: true });
        if (dataClientes) setClientes(dataClientes);
        const { data: dataPersonal } = await supabase.from('directorio_cuentas').select('*').eq('tipo', 'Personal');
        if (dataPersonal) setPersonal(dataPersonal);
        const { data: dataCuentas } = await supabase.from('directorio_cuentas').select('id, alias, banco, numero_cuenta, titular').eq('tipo', 'Propia');
        if (dataCuentas) setCuentas(dataCuentas);
        const { data: dataInv } = await supabase.from('inventario').select('id, nombre, cantidad, unidad_medida');
        if (dataInv) setProductos(dataInv);

        // Compatibilidad: en registros legacy de pagos al personal, el nombre del
        // empleado quedaba guardado en `titular` (sin personal_id). Lo deducimos.
        if (finanzaEditando && !finanzaEditando.personal_id && dataPersonal) {
            const esLegacy = finanzaEditando.tipo === 'Gasto' && (
                finanzaEditando.categoria === 'Nómina y Salarios' ||
                (finanzaEditando.servicio && finanzaEditando.servicio.toLowerCase().startsWith('sueldo:'))
            );
            if (esLegacy && finanzaEditando.titular) {
                const emp = dataPersonal.find(p => p.titular === finanzaEditando.titular);
                if (emp) {
                    setFormData(prev => ({ ...prev, personal_id: emp.id }));
                }
            }
        }
    }

    useEffect(() => {
        if (isOpen) {
            cargarServiciosBD(etiquetaSeleccionada || null).then(servicios => setCatalogoServicios(servicios));
        }
    }, [etiquetaSeleccionada, isOpen]);

    useEffect(() => {
        if (isOpen) {
            cargarDatosBasicos();
            cargarProyectosBD().then(data => setProyectos(data));
            cargarEtiquetasBD().then(data => setEtiquetas(data));
            cargarServiciosBD().then(servicios => {
                setCatalogoServicios(servicios);
                if (!finanzaEditando && servicios.length > 0) {
                    setFormData(prev => ({ ...prev, servicio: servicios[0] }));
                }
            });

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
                } else if (servicioBase !== '' && finanzaEditando.cliente_id !== null && !servicioBase.toLowerCase().startsWith('sueldo:') && finanzaEditando.categoria !== 'Nómina y Salarios') {
                    servManual = servicioBase;
                    servicioBase = '✨ Otro (Especificar)';
                }

                const esPagoPersonalLegacy = finanzaEditando.tipo === 'Gasto' && (
                    finanzaEditando.categoria === 'Nómina y Salarios' || 
                    (finanzaEditando.servicio && finanzaEditando.servicio.toLowerCase().startsWith('sueldo:'))
                );

                // En registros legacy el cliente_id era un vínculo OPCIONAL a cliente/proyecto,
                // así que se conserva como cliente_id. El personal se deduce por `titular`.
                const cid = finanzaEditando.cliente_id || '';
                const pid = finanzaEditando.personal_id || '';

                setFormData({
                    fecha_registro: finanzaEditando.fecha_registro ? finanzaEditando.fecha_registro.split('T')[0] : obtenerFechaHoy(),
                    tipo: finanzaEditando.tipo,
                    categoria: finanzaEditando.categoria || '',
                    concepto: finanzaEditando.concepto,
                    monto: finanzaEditando.monto,
                    cliente_id: cid,
                    personal_id: pid,
                    proyecto_id: finanzaEditando.proyecto_id || '',
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
                    fecha_registro: obtenerFechaHoy(),
                    tipo: 'Gasto', categoria: '', concepto: '', monto: '',
                    cliente_id: '', personal_id: '', proyecto_id: '',
                    servicio: '', sub_servicio: SUB_SERVICIOS_RUTINARIA[0],
                    servicio_manual: '', sub_servicio_manual: '',
                    banco: 'Efectivo', numero_cuenta: '', titular: '', id_operacion: '', cuenta_id: ''
                });
                setConsumo({ inventario_id: '', cantidad: 0 });
            }
        }
    }, [isOpen, finanzaEditando]);

    // Selección independiente de CLIENTE
    const handleSeleccionarCliente = (id) => {
        setFormData(prev => ({ ...prev, cliente_id: id }));
    };

    // Selección independiente de PERSONAL: el anticipo/pago queda asociado
    // directamente a la cuenta del personal seleccionado (banco, nro. cuenta y titular)
    const handleSeleccionarPersonal = (id) => {
        const emp = personal.find(p => p.id === id);
        if (emp) {
            setFormData(prev => ({
                ...prev,
                personal_id: id,
                banco: emp.banco || prev.banco,
                numero_cuenta: emp.numero_cuenta || '',
                titular: emp.titular || prev.titular,
                categoria: prev.tipo === 'Gasto' ? 'Nómina y Salarios' : prev.categoria
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                personal_id: '',
                // Si se deselecciona el personal, se limpia la categoría automática
                categoria: prev.categoria === 'Nómina y Salarios' ? '' : prev.categoria
            }));
        }
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

    // Guardar con degradación elegante: si la BD aún no tiene las columnas nuevas
    // (personal_id / proyecto_id), reintenta sin ellas para no perder el registro.
    const quitarCamposNuevos = (registro) => {
        const copia = { ...registro };
        delete copia.personal_id;
        delete copia.proyecto_id;
        return copia;
    };

    const guardarConRespaldo = async (datos, idEditar) => {
        if (idEditar) {
            const { error } = await supabase.from('finanzas').update(datos).eq('id', idEditar);
            if (!error) return { error: null, degradado: false };
            if (error.code === '42703' || /column/i.test(error.message || '')) {
                const { error: err2 } = await supabase.from('finanzas').update(quitarCamposNuevos(datos)).eq('id', idEditar);
                return { error: err2, degradado: !err2 };
            }
            return { error, degradado: false };
        }
        const { data, error } = await supabase.from('finanzas').insert([datos]).select().single();
        if (!error) return { data, error: null, degradado: false };
        if (error.code === '42703' || /column/i.test(error.message || '')) {
            const { data: data2, error: err2 } = await supabase.from('finanzas').insert([quitarCamposNuevos(datos)]).select().single();
            return { data: data2, error: err2, degradado: !err2 };
        }
        return { data, error, degradado: false };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);

        try {
            let servicioFinal = formData.servicio === '✨ Otro (Especificar)' ? formData.servicio_manual : formData.servicio;

            if (formData.servicio === '🧹 Limpieza Rutinaria') {
                const subFinal = formData.sub_servicio === 'Otro (Especificar)' ? formData.sub_servicio_manual : formData.sub_servicio;
                if (subFinal) {
                    servicioFinal = `${formData.servicio} - ${subFinal}`;
                }
            }

            const datosParaSupabase = {
                fecha_registro: formData.fecha_registro,
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
                cuenta_id: formData.cuenta_id || null,
                personal_id: formData.personal_id || null,
                proyecto_id: formData.proyecto_id || null
            };

            let resultado;
            if (finanzaEditando) {
                resultado = await guardarConRespaldo(datosParaSupabase, finanzaEditando.id);
            } else {
                resultado = await guardarConRespaldo(datosParaSupabase, null);
            }

            setGuardando(false);
            if (resultado.error) {
                alert('Error al guardar: ' + (resultado.error.message || 'Error desconocido'));
            } else {
                if (resultado.degradado) {
                    alert('El movimiento se guardó, pero SIN personal ni proyecto.\nEjecuta la migración SQL "20260824000000_proyectos_personal_origen.sql" en Supabase para habilitar esos campos.');
                }
                onGuardado();
                onClose();
            }
        } catch (err) {
            setGuardando(false);
            alert('Error inesperado: ' + err.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
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

                        {/* SELECTORES INDEPENDIENTES: CLIENTE y PERSONAL */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">👤 Cliente</label>
                                <select value={formData.cliente_id || ''} onChange={e => handleSeleccionarCliente(e.target.value)} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                    <option value="">-- Sin cliente --</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombres}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">💼 Personal</label>
                                <select value={formData.personal_id || ''} onChange={e => handleSeleccionarPersonal(e.target.value)} className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]">
                                    <option value="">-- Sin personal --</option>
                                    {personal.map(emp => <option key={emp.id} value={emp.id}>{emp.titular}</option>)}
                                </select>
                                {(formData.personal_id || formData.categoria === 'Nómina y Salarios') && (
                                    <p className="text-[9px] font-bold text-amber-600 leading-snug">
                                        💡 Anticipo/pago asociado directamente a la cuenta del personal{formData.personal_id ? ` (${formData.banco}${formData.numero_cuenta ? ` • ${formData.numero_cuenta}` : ''})` : ''}.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* ETIQUETA y SERVICIO REALIZADO */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">🏷️ Etiqueta</label>
                                <select 
                                    value={etiquetaSeleccionada} 
                                    onChange={e => {
                                        // Filtrar por etiqueta NO borra el servicio seleccionado:
                                        // si queda fuera del filtro se conserva igualmente (ver opción extra abajo)
                                        setEtiquetaSeleccionada(e.target.value);
                                    }}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]"
                                >
                                    <option value="">-- Todas las etiquetas --</option>
                                    {etiquetas.map(et => (
                                        <option key={et.id} value={et.id}>{et.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">🛠️ Servicio Realizado</label>
                                <select
                                    value={formData.servicio}
                                    onChange={e => setFormData({ ...formData, servicio: e.target.value })}
                                    className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]"
                                >
                                    <option value="">-- Seleccionar Servicio --</option>
                                    {catalogoServicios.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                    {formData.servicio && !catalogoServicios.includes(formData.servicio) && (
                                        <option value={formData.servicio}>💾 {formData.servicio} (actual)</option>
                                    )}
                                </select>
                                {formData.servicio && !catalogoServicios.includes(formData.servicio) && (
                                    <p className="text-[9px] font-bold text-amber-600 leading-snug">
                                        Servicio guardado que no pertenece a la etiqueta filtrada; se conserva al guardar.
                                    </p>
                                )}
                            </div>
                        </div>

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

                        {/* PROYECTO (después de Cliente, Personal, Etiqueta y Servicio) */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">📁 Proyecto</label>
                            <select
                                value={formData.proyecto_id || ''}
                                onChange={e => setFormData({ ...formData, proyecto_id: e.target.value })}
                                className="border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold bg-white outline-none focus:border-[#0055af]"
                            >
                                <option value="">-- Sin proyecto --</option>
                                {proyectos.length > 0 && proyectos.some(p => p.cliente_id && formData.cliente_id && p.cliente_id === formData.cliente_id) && (
                                    <optgroup label="Proyectos del cliente seleccionado">
                                        {proyectos.filter(p => p.cliente_id && p.cliente_id === formData.cliente_id).map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </optgroup>
                                )}
                                <optgroup label="Todos los proyectos">
                                    {proyectos.map(p => {
                                        const clienteNombre = p.cliente_id ? (clientes.find(c => c.id === p.cliente_id)?.nombres || '') : '';
                                        return <option key={`all-${p.id}`} value={p.id}>{p.nombre}{clienteNombre ? ` — ${clienteNombre}` : ''}</option>;
                                    })}
                                </optgroup>
                            </select>
                            {proyectos.length === 0 && (
                                <p className="text-[9px] text-slate-400 font-medium">No hay proyectos creados. Créalos desde el menú <span className="font-black text-[#0055af]">Etiquetas → Crear Proyectos</span>.</p>
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
