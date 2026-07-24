import { supabase } from '../../lib/supabase';

export default function LoginPage() {
    const handleLoginGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

    return (
        <div className="min-h-screen flex">
            {/* Panel izquierdo - branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 relative overflow-hidden flex-col items-center justify-center p-12">
                {/* Elementos decorativos de fondo */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-gold-500/3 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <img src="/logo_novai.png" alt="NovAI" className="w-48 h-48 object-contain mb-8 drop-shadow-2xl" />
                    <h1 className="text-4xl font-black text-white tracking-tight mb-3">NovAI</h1>
                    <p className="text-gold-300 text-sm font-bold uppercase tracking-[0.3em] mb-6">CRM & Ventas</p>
                    <div className="w-16 h-px bg-gold-500/40 mb-6"></div>
                    <p className="text-brand-200 text-xs font-medium max-w-xs leading-relaxed">
                        Solución inteligente para la gestión de clientes, ventas y operaciones comerciales.
                    </p>
                </div>

                <div className="absolute bottom-8 left-0 right-0 text-center">
                    <p className="text-brand-400 text-[9px] font-bold uppercase tracking-[0.25em]">
                        Parte del Ecosistema NovaSolum
                    </p>
                </div>
            </div>

            {/* Panel derecho - formulario */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
                {/* Logo mobile */}
                <div className="absolute top-8 left-8 flex items-center gap-3 lg:hidden">
                    <img src="/logo_novai.png" alt="NovAI" className="w-10 h-10 object-contain" />
                    <div>
                        <h2 className="text-sm font-black text-brand-700 tracking-tight">NovAI</h2>
                        <p className="text-[8px] text-gold-500 font-bold uppercase tracking-widest">CRM & Ventas</p>
                    </div>
                </div>

                <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="mb-10">
                        <h2 className="text-3xl font-black text-brand-800 tracking-tight">Bienvenido</h2>
                        <p className="text-slate-400 text-sm mt-2 font-medium">Accede para gestionar tus operaciones.</p>
                    </div>

                    <button
                        onClick={handleLoginGoogle}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-3.5 px-6 rounded-2xl font-bold text-slate-600 hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 transition-all duration-300 shadow-sm hover:shadow-md group"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Continuar con Google
                    </button>

                    <div className="mt-12 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-px bg-slate-200"></div>
                            <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">NovaSolum</span>
                            <div className="w-6 h-px bg-slate-200"></div>
                        </div>
                        <p className="text-[9px] text-slate-300 uppercase font-bold tracking-wider">Acceso Restringido • Santa Cruz, BO</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
