import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import FormularioFinanzaModal from './FormularioFinanzaModal';

export default function FinanzasPage() {
    const [finanzas, setFinanzas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1);
    const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());

    const fetchFinanzas = async () => {
        setCargando(true);
        const { data } = await supabase
            .from('finanzas')
            .select('*, clientes(nombres)')
            .order('fecha_registro', { ascending: false });

        if (data) setFinanzas(data);
        setCargando(false);
    };

    useEffect(() => { fetchFinanzas(); }, []);

    const finanzasFiltradas = finanzas.filter(f => {
        const fecha = new Date(f.fecha_registro);
        return (fecha.getMonth() + 1) === Number(filtroMes) && fecha.getFullYear() === Number(filtroAnio);
    });

    const ingresos = finanzasFiltradas.filter(f => f.tipo === 'Ingreso').reduce((acc, curr) => acc + Number(curr.monto), 0);
    const gastos = finanzasFiltradas.filter(f => f.tipo === 'Gasto').reduce((acc, curr) => acc + Number(curr.monto), 0);
    const balance = ingresos - gastos;

    const eliminarRegistro = async (id) => {
        if (window.confirm("¿Eliminar este registro financiero? Esta acción es irreversible.")) {
            await supabase.from('finanzas').delete().eq('id', id);
            fetchFinanzas();
        }
    };

    // 🚀 EXPORTACIÓN MEJORADA: Columnas separadas
    const exportarCSV = () => {
        if (finanzasFiltradas.length === 0) {
            alert("No hay movimientos para exportar.");
            return;
        }

        // Definimos las cabeceras separando los datos bancarios
        const cabeceras = ['Fecha', 'Concepto', 'Proyecto/Cliente', 'Categoria', 'Tipo', 'Monto (Bs)', 'Banco/Entidad', 'Nro Cuenta', 'Titular', 'ID Operación'];

        const filas = finanzasFiltradas.map(f => {
            const fecha = new Date(f.fecha_registro).toLocaleDateString('es-BO');
            const concepto = `"${(f.concepto || '').replace(/"/g, '""')}"`;
            const proyecto = `"${(f.clientes?.nombres || f.servicio || 'N/A').replace(/"/g, '""')}"`;
            const categoria = `"${(f.categoria || 'General').replace(/"/g, '""')}"`;
            const tipo = `"${f.tipo}"`;
            const monto = f.monto;

            // Datos bancarios separados
            const banco = `"${(f.banco || 'Efectivo').replace(/"/g, '""')}"`;
            const nroCuenta = `"${(f.numero_cuenta || '').replace(/"/g, '""')}"`;
            const titular = `"${(f.titular || '').replace(/"/g, '""')}"`;
            const operacion = `"${(f.id_operacion || '').replace(/"/g, '""')}"`;

            return [fecha, concepto, proyecto, categoria, tipo, monto, banco, nroCuenta, titular, operacion].join(',');
        });

        const contenidoCSV = '\uFEFF' + [cabeceras.join(','), ...filas].join('\n');
        const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const nombreMes = new Date(0, filtroMes - 1).toLocaleString('es', { month: 'long' });
        link.setAttribute('download', `Reporte_Financiero_${nombreMes}_${filtroAnio}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-8 max-w-[98%] mx-auto flex flex-col gap-6 animate-in fade-in pb-20">
            {/* CABECERA Y TABLA SE MANTIENEN IGUAL... */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 gap-6 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-black text-[#0055af] tracking-tight">Gestión Financiera</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Historial completo con detalle bancario.</p>
                </div>
                <button onClick={() => setModalAbierto(true)} className="px-8 py-3.5 bg-[#0055af] text-white font-black text-sm uppercase tracking-widest rounded-full shadow-lg hover:-translate-y-1 transition-all">+ Registrar Movimiento</button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Historial</h3>
                    <button onClick={exportarCSV} className="px-5 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white font-black rounded-full text-[10px] uppercase tracking-widest border border-emerald-200 transition-all shadow-sm">📥 Exportar CSV Detallado</button>
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
                            {finanzasFiltradas.map(f => (
                                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-xs">{new Date(f.fecha_registro).toLocaleDateString('es-BO')}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-slate-800 text-sm">{f.concepto}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{f.clientes?.nombres || f.servicio}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-bold text-slate-700">{f.banco || 'Efectivo'}</div>
                                        <div className="text-[9px] text-slate-400 font-medium">{f.numero_cuenta}</div>
                                        <div className="text-[9px] text-slate-400 font-medium">{f.titular}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${f.tipo === 'Ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {f.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-[10px]">{f.id_operacion || '-'}</td>
                                    <td className={`px-6 py-4 text-right font-black ${f.tipo === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {Number(f.monto).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => eliminarRegistro(f.id)} className="text-slate-300 hover:text-red-500">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <FormularioFinanzaModal isOpen={modalAbierto} onClose={() => setModalAbierto(false)} onGuardado={fetchFinanzas} />
        </div>
    );
}