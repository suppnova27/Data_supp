import { useState, useEffect } from 'react';

/**
 * Pantalla de bloqueo de cobranza.
 * Se muestra DESPUÉS del login a todos los usuarios excepto la cuenta maestra
 * (novasolum.info@gmail.com) definida en App.jsx. Imita una verificación de
 * licencia y luego presenta el aviso de suspensión; el usuario jamás llega al CRM.
 */
export default function CuentaSuspendidaPage({ onLogout }) {
  const [verificando, setVerificando] = useState(true);
  const [referencia] = useState(() => {
    const n = Math.floor(1000 + Math.random() * 9000);
    return `ORE-${new Date().getFullYear()}-${n}`;
  });

  useEffect(() => {
    const timer = setTimeout(() => setVerificando(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  // Fase de "verificación de licencia" para que nunca llegue a pensar que entró.
  if (verificando) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="font-black text-slate-400 animate-pulse uppercase tracking-widest text-xl">
            Verificando licencia...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Encabezado rojo */}
        <div className="bg-red-600 py-5 px-6 text-center">
          <h2 className="text-white text-sm font-black uppercase tracking-widest">
            Acceso suspendido temporalmente
          </h2>
        </div>

        <div className="p-10 flex flex-col gap-6">
          <div className="text-center">
            <div className="text-6xl mb-4">⛔</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Servicio Suspendido</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
              Licencia en estado irregular
            </p>
          </div>

          <div className="text-sm text-slate-600 space-y-3">
            <p>
              Estimado usuario: su <strong>período de gracia ha concluido</strong> y el sistema
              detectó un saldo pendiente en su cuenta.
            </p>
            <p>
              Por este motivo, su licencia quedó en estado{' '}
              <strong className="text-red-600">suspendida</strong> y el acceso a{' '}
              <strong>ORE Management System</strong> fue deshabilitado de manera temporal.
            </p>
            <p>
              Para <strong>reanudar el servicio en menos de 24 horas</strong>, comuníquese con
              nuestro departamento de Cobranzas y Soporte indicando la referencia de su cuenta.
              Hasta no regularizar su situación, el sistema permanecerá bloqueado.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Referencia de cuenta</span>
              <span className="font-bold text-slate-800">{referencia}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Estado de la licencia</span>
              <span className="font-bold text-red-600 uppercase">Suspendida</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Motivo</span>
              <span className="font-bold text-slate-800">Pago pendiente</span>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center text-xs font-bold text-red-700 uppercase tracking-wide">
            El servicio no estará disponible hasta que se regularice el pago
          </div>

          <button
            onClick={onLogout}
            className="w-full py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cerrar Sesión
          </button>

          <p className="text-[10px] text-slate-300 uppercase font-black text-center">
            ORE Management System • Cobranzas y Soporte
          </p>
        </div>
      </div>
    </div>
  );
}