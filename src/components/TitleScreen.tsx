import { useState } from 'react';
import { Play, RotateCcw, Swords, Shield, Compass } from 'lucide-react';
import { OpeningCinematic } from './OpeningCinematic';

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

export function TitleScreen({ hasSave, onNewGame, onContinue }: TitleScreenProps) {
  const [opening, setOpening] = useState(false);

  if (opening) {
    return (
      <OpeningCinematic
        onComplete={onNewGame}
        onSkip={onNewGame}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-6 pointer-events-auto bg-[#07111b]/72">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-cyan-200/15 bg-[#0b1420]/95 p-5 shadow-2xl sm:p-7 md:p-9">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-cyan-300">
          <span>Exploração espacial</span><span aria-hidden="true">·</span>
          <span>Mundo Virtual</span><span aria-hidden="true">·</span>
          <span>Sobrevivência e construção</span>
        </div>

        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white md:text-5xl">Tomas Vagabundo</h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.22em] text-cyan-200">UMA NOVA VIDA COMEÇA ENTRE AS ESTRELAS</p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
          Tomas chega em uma nave de exploração a um planeta desconhecido. Ele é um androide híbrido capaz de mapear organismos vivos e assumir formas orgânicas. Com a orientação de Cowila, a IA da nave, você irá explorar territórios nativos, sobreviver e construir um novo lar.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#111e2b] p-3.5">
            <div className="flex items-center gap-2 text-cyan-300 text-sm font-semibold"><Compass className="h-4 w-4 shrink-0" /><span>Desbravar</span></div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Explore um planeta inóspito, descubra recursos e investigue sinais de vida.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111e2b] p-3.5">
            <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold"><Shield className="h-4 w-4 shrink-0" /><span>Adaptar-se</span></div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Mapeie organismos e desbloqueie formas orgânicas com capacidades próprias.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111e2b] p-3.5">
            <div className="flex items-center gap-2 text-rose-300 text-sm font-semibold"><Swords className="h-4 w-4 shrink-0" /><span>Respeitar territórios</span></div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Habitats têm habitantes que podem defender suas regiões. O combate continua fazendo parte da jornada.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {hasSave && (
            <button type="button" onClick={onContinue} className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400">
              <Play className="h-4 w-4" /><span>Continuar Jornada</span>
            </button>
          )}
          <button type="button" onClick={() => setOpening(true)} className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${hasSave ? 'border border-white/15 bg-[#162536] text-slate-100 hover:bg-[#20364a]' : 'bg-amber-400 text-slate-950 hover:bg-amber-300'}`}>
            {hasSave ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{hasSave ? 'Nova missão' : 'Iniciar missão'}</span>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-4 text-xs text-slate-400">
          <span>WASD: mover</span><span aria-hidden="true">·</span><span>Espaço: pular</span><span aria-hidden="true">·</span><span>E: interagir</span><span aria-hidden="true">·</span><span>Tab: status</span>
        </div>
      </div>
    </div>
  );
}
