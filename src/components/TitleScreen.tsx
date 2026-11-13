import { Play, RotateCcw, Swords, Shield, Skull } from 'lucide-react';

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

export function TitleScreen({ hasSave, onNewGame, onContinue }: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6 pointer-events-auto bg-[#0B0F17]/65">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0E1420]/95 p-5 sm:p-7 md:p-9 shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-400 font-medium tracking-wide">
          <span>Terceira Pessoa 3D</span>
          <span aria-hidden="true">·</span>
          <span>Mundo Aberto 440m</span>
          <span aria-hidden="true">·</span>
          <span>5 Chances &amp; Checkpoints</span>
          <span aria-hidden="true">·</span>
          <span>Nível 99 Alpha</span>
        </div>

        <h1 className="font-display mt-3 text-4xl md:text-5xl font-bold tracking-tight text-white">
          FELIS-09
        </h1>

        <p className="mt-3 text-sm md:text-base text-slate-300 leading-relaxed max-w-xl">
          Abandonado em uma metrópole devastada em terceira pessoa 3D, sobreviva entre casas em ruínas, arranha-céus escaláveis, hospitais inundados e um mega estádio. Você tem 5 chances para continuar de onde caiu, checkpoints automáticos após cada chefe, disputas de telhados por Estrelas e evolução até o Nível 99 (Gato Líder &amp; Alpha).
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-[#141C2B] p-3.5">
            <div className="flex items-center gap-2 text-rose-400 text-sm font-semibold">
              <Swords className="w-4 h-4 shrink-0" />
              <span>Disputa de Telhados</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Escale paredes, enfrente gatos rivais nos telhados e ganhe Estrelas e Status até o Nível 99 Alpha.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#141C2B] p-3.5">
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Habilidades Felinas</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Corra, mie para distrair, azunhe predadores, entre em casas abertas e caia sempre em pé.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#141C2B] p-3.5">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
              <Skull className="w-4 h-4 shrink-0" />
              <span>Chefes de Fase</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              Derrote o Rei Rato Gigante, Gato Selvagem, Cachorro Cibernético e o Leão Apex.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {hasSave && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4" />
              <span>Continuar Jornada</span>
            </button>
          )}
          <button
            type="button"
            onClick={onNewGame}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              hasSave
                ? 'border border-white/15 bg-[#161F30] text-slate-100 hover:bg-[#1E2A40]'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {hasSave ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{hasSave ? 'Novo Jogo' : 'Iniciar Sobrevivência'}</span>
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
          <span>WASD: Mover / Subir Paredes</span>
          <span aria-hidden="true">·</span>
          <span>Clique / J: Azunhar</span>
          <span aria-hidden="true">·</span>
          <span>V: Miar</span>
          <span aria-hidden="true">·</span>
          <span>Espaço: Pular</span>
          <span aria-hidden="true">·</span>
          <span>E: Interagir</span>
          <span aria-hidden="true">·</span>
          <span>Tab: Status</span>
        </div>
      </div>
    </div>
  );
}
