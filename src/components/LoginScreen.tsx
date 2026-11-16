import { Cat, Cloud, ShieldCheck } from 'lucide-react';
import type { User } from 'firebase/auth';

interface LoginScreenProps {
  configured: boolean;
  busy: boolean;
  error: string | null;
  user?: User | null;
  accountLoading?: boolean;
  onGoogleLogin: () => void;
  onRetry?: () => void;
  onLogout?: () => void;
}

export function LoginScreen({ configured, busy, error, user, accountLoading, onGoogleLogin, onRetry, onLogout }: LoginScreenProps) {
  return (
    <main className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#12334b_0%,#0b1220_48%,#070b13_100%)] p-4 text-white">
      <section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-[#0c1523]/95 p-7 shadow-[0_24px_90px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-300"><Cat className="h-9 w-9" /></div>
        <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[.28em] text-cyan-300">FELIS-09 · Conta protegida</p>
        <h1 className="mt-2 text-center text-3xl font-black tracking-tight">Tomas Vagabundo</h1>
        <p className="mt-3 text-center text-sm leading-6 text-slate-300">Entre com sua conta Google para acessar seu personagem. Seu progresso, inventário, tarefas e conquistas ficam vinculados à sua identidade.</p>
        <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <div className="flex items-center gap-3 text-sm text-slate-200"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Um personagem por conta Google</div>
          <div className="flex items-center gap-3 text-sm text-slate-200"><Cloud className="h-5 w-5 text-cyan-300" /> Salvamento sincronizado pela nuvem</div>
        </div>
        {user ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-200">Conta: <strong>{user.email ?? user.displayName ?? user.uid}</strong></p>
            {accountLoading && <p className="mt-3 text-sm text-cyan-200">Verificando seu personagem e os salvamentos...</p>}
            {error && <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
            {error && onRetry && <button onClick={onRetry} className="mt-4 w-full rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950">Tentar novamente</button>}
            {onLogout && <button onClick={onLogout} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-300">Sair desta conta</button>}
          </div>
        ) : (
          <>
            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
            {!configured && <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-sm leading-5 text-amber-100">A integração está no código, mas falta configurar as chaves do aplicativo Firebase no ambiente de publicação e ativar Google em Authentication.</p>}
            <button type="button" disabled={!configured || busy} onClick={onGoogleLogin} className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 font-black text-[#4285F4]">G</span>
              {busy ? 'Conectando...' : 'Entrar com Google'}
            </button>
          </>
        )}
        <p className="mt-5 text-center text-[11px] leading-5 text-slate-500">A conta protege o acesso ao personagem. Nunca compartilhe sua sessão em dispositivos públicos.</p>
      </section>
    </main>
  );
}
