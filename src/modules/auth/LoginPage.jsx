import { supabase } from '../../lib/supabase';

export default function LoginPage() {
    const handleLoginGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden p-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">ORE</h1>
                    <p className="text-slate-500 text-sm font-medium mt-2 uppercase tracking-widest">Management System</p>
                </div>

                <div className="w-full space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 text-center">Bienvenido de nuevo</h2>
                    <p className="text-slate-400 text-center text-sm px-4">Accede con tu cuenta corporativa para gestionar las operaciones de ORE.</p>
                </div>

                <button
                    onClick={handleLoginGoogle}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-3 px-6 rounded-xl font-bold text-slate-700 hover:bg-slate-50 hover:border-blue-400 transition-all shadow-sm"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    Continuar con Google
                </button>

                <p className="text-[10px] text-slate-300 uppercase font-black">Acceso Restringido • Santa Cruz, BO</p>
            </div>
        </div>
    );
}
