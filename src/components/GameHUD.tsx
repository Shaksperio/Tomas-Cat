import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AlertTriangle,
  Backpack,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Droplets,
  Flame,
  Heart,
  HelpCircle,
  Home,
  MessageCircle,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Skull,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Utensils,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CHAPTER_PHASES,
  EVOLUTION_STAGES,
  GamePhase,
  HudSnapshot,
  LoreLog,
  MAX_CAT_LEVEL,
} from '../types/game';
import { getDayPeriod } from '../game/dayCycle';
import type { DuelHud } from '../types/game';
import { LORE_LOGS } from '../game/worldBuilder';
import { MOVE_UNLOCKS } from '../game/progression/unlocks';
import { DIALOGUE_DATA } from '../game/dialogue/dialogueData';
import { ITEM_CATALOG, type InventoryItemId, type EquipmentItemId, type EquipmentSlot } from '../game/items/itemCatalog';

interface GameHUDProps {
  phase: GamePhase;
  hud: HudSnapshot;
  muted: boolean;
  toast: { id: number; message: string; tone: 'info' | 'success' | 'warn' } | null;
  activeLore: LoreLog | null;
  evolvedBannerStage: number | null;
  onToggleMute: () => void;
  onPauseToggle: () => void;
  onContinueAfterVictory: () => void;
  onInteract: () => void;
  onUseInventoryItem: (itemId: InventoryItemId) => void;
  onEquipInventoryItem: (itemId: EquipmentItemId) => void;
  onUnequipEquipment: (slot: EquipmentSlot) => void;
  onDialogueOption: (optionId: string) => void;
  onDialogueClose: () => void;
  onUpgradeShelter: () => void;
  onClawAttack: () => void;
  onChallenge: () => void;
  onDuelOffer: (kind: 'coins' | 'item' | 'vitality' | 'oxygen', amount: number, group: boolean) => void;
  onDuelCancel: () => void;
  onDuelForfeit: () => void;
  onBattleCommand: (command: 'attack' | 'flurry' | 'guard' | 'limit' | 'item' | 'magic' | 'combo_a' | 'combo_b') => void;
  onComboBreaker: () => void;
  onBattleTarget: (side: 'opponent' | 'opponent2' | 'opponent3' | 'opponent4') => void;
  onMeow: () => void;
  onSonar: () => void;
  onJump: () => void;
  onCloseLore: () => void;
  onDismissEvolved: () => void;
  onReviveHere: () => void;
  onContinueCheckpoint: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCycleCamera: () => void;
  onRestart: () => void;
  onVirtualInput: (mx: number, my: number, sprint: boolean) => void;
}

function VigorBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[11px] text-slate-300 font-mono-tabular">
        <span className="truncate">{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function BattleBar({ value, tone, height = 'h-2.5' }: { value: number; tone: string; height?: string }) {
  return (
    <div className={`${height} w-full rounded-sm bg-black/50 border border-white/20 overflow-hidden`}>
      <div className={`h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%`, transition: 'width 0.25s linear' }} />
    </div>
  );
}

const BATTLE_COMMANDS: Array<{ id: 'attack' | 'flurry' | 'guard' | 'limit' | 'item' | 'magic' | 'combo_a' | 'combo_b'; label: string; key: string; requiredLevel?: number; manaCost?: number }> = [
  { id: 'attack', label: 'Arranhar', key: '1' },
  { id: 'flurry', label: 'Garra Furiosa', key: '2' },
  { id: 'guard', label: 'Defender', key: '3' },
  { id: 'limit', label: 'Especial', key: '4' },
  { id: 'item', label: 'Ração energética', key: 'I' },
  { id: 'magic', label: 'Orbe Arcano', key: '8', manaCost: 25 },
  { id: 'combo_a', label: 'Rasante Duplo', key: '6', requiredLevel: 25, manaCost: 35 },
  { id: 'combo_b', label: 'Tempestade de Garras', key: '7', requiredLevel: 55, manaCost: 70 },
];

function BattleOverlay({
  duel,
  onCommand,
  onComboBreaker,
  onForfeit,
  onTarget,
}: {
  duel: DuelHud;
  onCommand: (command: 'attack' | 'flurry' | 'guard' | 'limit' | 'item' | 'magic' | 'combo_a' | 'combo_b') => void;
  onComboBreaker: () => void;
  onForfeit: () => void;
  onTarget: (side: 'opponent' | 'opponent2' | 'opponent3' | 'opponent4') => void;
}) {
  const limitReady = duel.playerLimit >= 100;
  const windowStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #1830c8 0%, #0a1470 55%, #050a3c 100%)',
    border: '2px solid #d8def2',
    borderRadius: 10,
    boxShadow: '0 0 0 2px #05072a, 0 8px 24px rgba(0,0,0,0.55), inset 0 0 14px rgba(120,150,255,0.35)',
  };
  return (
    <div className="pointer-events-none absolute inset-0 z-50 select-none">
      {/* Barras de cinema */}
      <div className="battle-bar-top absolute inset-x-0 top-0 h-[11vh] bg-black" />
      <div className="battle-bar-bottom absolute inset-x-0 bottom-0 h-[11vh] bg-black" />

      {/* Escurecimento (Limit) e clarões */}
      <div className="absolute inset-0 bg-black" style={{ opacity: duel.darkness, transition: 'opacity 0.35s' }} />
      <div className="absolute inset-0 bg-white" style={{ opacity: duel.flash }} />
      {duel.intro && <div className="battle-swirl absolute inset-0" />}

      {duel.comboBreakerWindowOpen && !duel.intro && (
        <button
          type="button"
          onClick={onComboBreaker}
          className="pointer-events-auto absolute left-1/2 top-[27vh] -translate-x-1/2 rounded-xl border-2 border-cyan-200 bg-cyan-500/90 px-5 py-3 text-sm sm:text-base font-black tracking-widest text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.8)] animate-pulse"
        >
          COMBO BREAKERS! [9]
        </button>
      )}

      {/* Nome do golpe */}
      {duel.banner && !duel.intro && (
        <div key={duel.banner.id} className="battle-banner absolute left-1/2 top-[14vh] -translate-x-1/2 px-5 py-1.5 text-center" style={windowStyle}>
          <span className="font-display text-sm sm:text-base font-bold tracking-wide text-white">{duel.banner.text}</span>
        </div>
      )}
      {duel.intro && (
        <div className="battle-banner absolute left-1/2 top-[40vh] -translate-x-1/2 px-6 py-2" style={windowStyle}>
          <span className="font-display text-lg sm:text-2xl font-bold tracking-widest text-white">
            BATALHA vs {duel.opponentName.toUpperCase()}
          </span>
        </div>
      )}

      {/* Abandonar batalha (sempre visível) */}
      {!duel.intro && (
        <button
          type="button"
          onClick={onForfeit}
          className="pointer-events-auto absolute left-3 top-[13vh] rounded-lg border border-rose-300/60 bg-rose-700/80 px-3 py-1.5 text-xs sm:text-sm font-bold text-white shadow-lg hover:bg-rose-600 cursor-pointer"
        >
          Abandonar batalha [5]
        </button>
      )}

      {/* Oponentes (canto superior direito): um cartão por lutador; toque/clique escolhe o alvo */}
      {!duel.intro && (
        <div className="pointer-events-auto absolute right-3 top-[13vh] flex w-40 sm:w-56 flex-col gap-1.5">
          {duel.foes.map((foe) => {
            const selected = duel.foes.length > 1 && duel.targetSide === foe.side && !foe.fallen;
            return (
              <button
                key={foe.side}
                type="button"
                disabled={foe.fallen || duel.foes.length < 2}
                onClick={() => onTarget(foe.side)}
                className={`block w-full p-1.5 text-left ${foe.fallen ? 'opacity-45' : ''} ${duel.foes.length > 1 && !foe.fallen ? 'cursor-pointer' : ''}`}
                style={{ ...windowStyle, outline: selected ? '2px solid #fde047' : 'none' }}
              >
                <div className="flex justify-between text-[11px] sm:text-xs font-bold text-white">
                  <span className="truncate">
                    {selected ? '🎯 ' : ''}
                    {foe.name}
                    {foe.guard ? ' 🛡' : ''}
                    {foe.fallen ? ' ✖' : ''}
                  </span>
                  <span className="font-mono-tabular">{Math.round(foe.vigor)}/100</span>
                </div>
                <BattleBar value={foe.vigor} tone="bg-gradient-to-r from-rose-500 to-amber-300" />
                <div className="mt-1" />
                <BattleBar value={foe.atb} tone="bg-gradient-to-r from-sky-500 to-cyan-200" height="h-1.5" />
              </button>
            );
          })}
        </div>
      )}

      {/* Menu e status do jogador (estilo RPG clássico) */}
      {!duel.intro && (
        <div className="absolute inset-x-2 bottom-[12vh] flex items-end gap-2 sm:gap-3 pointer-events-auto">
          <div className="w-40 sm:w-52 p-2" style={windowStyle}>
            {BATTLE_COMMANDS.filter((c) => !c.requiredLevel || duel.playerLevel >= c.requiredLevel).map((c) => {
              const disabled = !duel.awaitingCommand || (c.id === 'limit' && !limitReady) || (c.id === 'item' && duel.playerItems <= 0) || (c.id === 'item' && duel.playerVigor >= 100) || (c.manaCost !== undefined && duel.playerLimit < c.manaCost);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onCommand(c.id)}
                  className={`flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs sm:text-sm font-bold ${
                    disabled ? 'text-slate-400/70 cursor-not-allowed' : 'text-white hover:bg-white/15 cursor-pointer'
                  } ${c.id === 'limit' && limitReady ? 'battle-limit-ready' : ''}`}
                >
                  <span className="w-3 text-amber-300">{duel.awaitingCommand && !disabled ? '▶' : ''}</span>
                  <span className="flex-1 truncate">{c.label}{c.id === 'item' ? ` (${duel.playerItems})` : c.manaCost ? ` (${c.manaCost} MP)` : ''}</span>
                  <span className="text-[10px] font-mono-tabular opacity-60">[{c.key}]</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-0 p-2" style={windowStyle}>
            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
              <span>Tomas{duel.playerGuard ? ' 🛡' : ''}</span>
              <span className="font-mono-tabular text-[11px]">
                VIGOR <span className="text-amber-200">{Math.round(duel.playerVigor)}</span>/100
              </span>
            </div>
            <BattleBar value={duel.playerVigor} tone="bg-gradient-to-r from-emerald-500 to-lime-300" />
            <div className="mt-1 flex items-center gap-2">
              <span className="w-10 text-[10px] font-bold text-cyan-200">ATB</span>
              <BattleBar
                value={duel.playerAtb}
                tone={duel.awaitingCommand ? 'bg-gradient-to-r from-yellow-400 to-amber-200 battle-atb-full' : 'bg-gradient-to-r from-sky-500 to-cyan-200'}
                height="h-2"
              />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="w-10 text-[10px] font-bold text-orange-200">MANÁ</span>
              <BattleBar
                value={duel.playerLimit}
                tone={limitReady ? 'bg-gradient-to-r from-orange-500 to-yellow-200 battle-atb-full' : 'bg-gradient-to-r from-orange-700 to-orange-400'}
                height="h-2"
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-300">
              {duel.awaitingCommand && (
                <div className="mt-1 flex items-center gap-2" aria-live="polite">
                  <span className="w-10 text-[10px] font-bold text-amber-200">TEMPO</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/45">
                    <div
                      className={duel.playerTurnTimeLeft <= 3 ? 'h-full rounded-full bg-rose-400' : 'h-full rounded-full bg-amber-300'}
                      style={{ width: `${Math.max(0, Math.min(100, duel.playerTurnTimeLeft / 10 * 100))}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[11px] font-mono-tabular text-amber-100">{Math.ceil(duel.playerTurnTimeLeft)}s</span>
                </div>
              )}
              Aposta: {duel.stakeText}{duel.foes.length > 1 ? ' por oponente' : ''}
              {duel.awaitingCommand ? ' · Sua vez!' : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DuelPanel({
  duel,
  onOffer,
  onCancel,
  onForfeit,
  onCommand,
  onComboBreaker,
  onTarget,
}: {
  duel: DuelHud;
  onOffer: (kind: 'coins' | 'item' | 'vitality' | 'oxygen', amount: number, group: boolean) => void;
  onCancel: () => void;
  onForfeit: () => void;
  onCommand: (command: 'attack' | 'flurry' | 'guard' | 'limit' | 'item' | 'magic' | 'combo_a' | 'combo_b') => void;
  onComboBreaker: () => void;
  onTarget: (side: 'opponent' | 'opponent2' | 'opponent3' | 'opponent4') => void;
}) {
  const [kind, setKind] = useState<'coins' | 'item' | 'vitality' | 'oxygen'>('coins');
  const [amount, setAmount] = useState(duel.defaultCoins);
  const [group, setGroup] = useState(false);
  const foeCount = group && duel.groupAvailable >= 2 ? duel.groupAvailable : 1;
  // Em grupo a aposta é por oponente: o jogador arrisca N× e por isso o máximo por oponente cai.
  const rawLimit =
    kind === 'coins' ? duel.limits.coins : kind === 'item' ? duel.limits.scrap : kind === 'vitality' ? duel.limits.vitality : duel.limits.oxygen;
  const limit = Math.floor(rawLimit / foeCount);
  const options: Array<['coins' | 'item' | 'vitality' | 'oxygen', string]> = [
    ['coins', 'Moedas'],
    ['item', 'Sucata (item)'],
    ['vitality', 'Energia vital'],
    ['oxygen', 'Oxigênio'],
  ];

  if (duel.phase === 'fighting') {
    return <BattleOverlay duel={duel} onCommand={onCommand} onComboBreaker={onComboBreaker} onForfeit={onForfeit} onTarget={onTarget} />;
  }

  return (
    <div className="pointer-events-auto absolute top-20 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,26rem)] rounded-xl border border-fuchsia-400/40 bg-[#0B0F17]/95 p-3.5 shadow-2xl">
      {duel.phase === 'offer' && (
        <div className="space-y-2.5">
          <div className="font-display text-sm font-bold text-fuchsia-200">
            Desafiar {duel.opponentName} para uma batalha 1x1
          </div>
          <p className="text-[11px] text-slate-400">
            Os dois apostam o mesmo valor; quem vencer leva o que o perdedor apostou. A luta é estilizada, sem ferimentos.
            Energia vital e oxigênio nunca podem ser apostados por inteiro.
          </p>
          {duel.groupAvailable >= 2 && (
            <div className="grid grid-cols-2 gap-1.5">
              {[
                [false, '1 contra 1'],
                [true, `1 contra grupo (${duel.groupAvailable})`],
              ].map(([g, label]) => (
                <button
                  key={String(g)}
                  type="button"
                  onClick={() => setGroup(g as boolean)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-bold cursor-pointer ${
                    group === g ? 'bg-amber-500/30 border-amber-300 text-white' : 'bg-[#141C2B] border-white/15 text-slate-300'
                  }`}
                >
                  {label as string}
                </button>
              ))}
            </div>
          )}
          {duel.storedMana > 0 && (
            <div className="text-[11px] text-orange-200">Maná guardado da última vitória: {Math.round(duel.storedMana)}%</div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {options.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setAmount(k === 'coins' ? duel.defaultCoins : Math.max(1, Math.min(5, k === 'item' ? duel.limits.scrap : k === 'vitality' ? duel.limits.vitality : duel.limits.oxygen)));
                }}
                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-pointer ${
                  kind === k ? 'bg-fuchsia-500/30 border-fuchsia-300 text-white' : 'bg-[#141C2B] border-white/15 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Quantidade
            <input
              type="number"
              min={1}
              max={Math.max(1, limit)}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-20 rounded-md border border-white/15 bg-[#141C2B] px-2 py-1 text-white font-mono-tabular"
            />
            <span className="text-[11px] text-slate-400">
              máx. {limit}{foeCount > 1 ? ` por oponente (${foeCount}×)` : ''}
            </span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={limit < 1}
              onClick={() => onOffer(kind, amount, group && duel.groupAvailable >= 2)}
              className="flex-1 rounded-lg bg-fuchsia-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
            >
              Lançar desafio
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/15 bg-[#141C2B] px-3 py-2 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Cancelar [B]
            </button>
          </div>
        </div>
      )}

      {duel.phase === 'result' && (
        <div
          className={`text-center text-sm font-bold ${
            duel.resultWon === true ? 'text-emerald-300' : duel.resultWon === false ? 'text-rose-300' : 'text-amber-200'
          }`}
        >
          {duel.resultText}
        </div>
      )}
    </div>
  );
}

function formatClock(timeOfDay: number): string {
  const totalMinutes = Math.floor(timeOfDay * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function formatDayPeriod(timeOfDay: number): string {
  return getDayPeriod(timeOfDay);
}

function StatBar({
  label,
  value,
  max,
  colorClass,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  colorClass: string;
  icon: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const low = pct < 25;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`flex items-center gap-1.5 font-medium ${low ? 'text-red-300' : 'text-slate-200'}`}>
          {icon}
          <span>{label}</span>
        </span>
        <span className="font-mono-tabular text-slate-300">
          {Math.round(value)}/{Math.round(max)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-150 ${low ? 'bg-red-500' : colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Botões de ação por toque: disparam em pointerdown. Com o dedo do joystick
 * já apoiado, o toque do segundo dedo não gera `click` no navegador móvel, o
 * que impedia pular/atacar enquanto o gato andava. onClick só cobre teclado.
 */
function instantPress(action: () => void) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    },
    onClick: (e: ReactMouseEvent<HTMLElement>) => {
      if (e.detail === 0) action();
    },
  };
}

function VirtualJoystick({
  sprint,
  onMove,
}: {
  sprint: boolean;
  onMove: (mx: number, my: number, sprint: boolean) => void;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const vecRef = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (pointerIdRef.current !== null) {
      onMove(vecRef.current.x, vecRef.current.y, sprint);
    }
  }, [sprint, onMove]);

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 2 ? Math.cos(angle) * clampedDist : 0;
    const ky = dist > 2 ? Math.sin(angle) * clampedDist : 0;
    const nx = dist > 4 ? kx / maxR : 0;
    const ny = dist > 4 ? ky / maxR : 0;
    vecRef.current = { x: nx, y: ny };
    setKnob({ x: kx, y: ky });
    onMove(nx, ny, sprint);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    vecRef.current = { x: 0, y: 0 };
    setKnob({ x: 0, y: 0 });
    onMove(0, 0, sprint);
  };

  return (
    <div
      ref={padRef}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (pointerIdRef.current !== null) return;
        pointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        e.stopPropagation();
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        resetStick();
      }}
      onPointerCancel={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        resetStick();
      }}
      className="relative w-28 h-28 rounded-full border border-cyan-400/35 bg-[#0B0F17]/75 shadow-inner touch-none select-none flex items-center justify-center"
    >
      <div className="w-16 h-16 rounded-full border border-white/10 pointer-events-none" />
      <div
        className="absolute w-11 h-11 rounded-full bg-cyan-400/85 border-2 border-white shadow-lg pointer-events-none transition-transform duration-75"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}

export function GameHUD({
  phase,
  hud,
  muted,
  toast,
  activeLore,
  evolvedBannerStage,
  onToggleMute,
  onPauseToggle,
  onContinueAfterVictory,
  onInteract,
  onUseInventoryItem,
  onEquipInventoryItem,
  onUnequipEquipment,
  onDialogueOption,
  onDialogueClose,
  onUpgradeShelter,
  onClawAttack,
  onChallenge,
  onDuelOffer,
  onDuelCancel,
  onDuelForfeit,
  onBattleCommand,
  onComboBreaker,
  onBattleTarget,
  onMeow,
  onSonar,
  onJump,
  onCloseLore,
  onDismissEvolved,
  onReviveHere,
  onContinueCheckpoint,
  onZoomIn,
  onZoomOut,
  onCycleCamera,
  onRestart,
  onVirtualInput,
}: GameHUDProps) {
  // Status & Evolution card starts HIDDEN in the corner; only a compact energy strip is visible!
  const [statusOpen, setStatusOpen] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showEvolutionTree, setShowEvolutionTree] = useState(false);
  const [showLoreArchive, setShowLoreArchive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [touchSprint, setTouchSprint] = useState(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (phase === 'playing' && hud.gpsTarget) {
      // Preserve the expanded task list while GPS is active so the player can
      // keep reading objectives and progress without losing the route context.
      setRadarOpen(true);
    }
  }, [phase, hud.gpsTarget?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && phase === 'playing') {
        e.preventDefault();
        setStatusOpen((prev) => !prev);
      } else if (e.code === 'KeyM' && phase === 'playing') {
        setRadarOpen((prev) => !prev);
      } else if (e.code === 'KeyH' && phase === 'playing') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'Escape') {
        if (activeLore) onCloseLore();
        else if (showEvolutionTree) setShowEvolutionTree(false);
        else if (showLoreArchive) setShowLoreArchive(false);
        else if (showHelp) setShowHelp(false);
        else if (statusOpen) setStatusOpen(false);
        else if (phase === 'playing' || phase === 'paused') onPauseToggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, activeLore, showEvolutionTree, showLoreArchive, showHelp, statusOpen, onCloseLore, onPauseToggle]);

  const stage = EVOLUTION_STAGES[hud.stageIndex];
  const chapter = CHAPTER_PHASES[Math.min(hud.currentPhase - 1, CHAPTER_PHASES.length - 1)];
  const dialogueNode = hud.activeDialogue
    ? DIALOGUE_DATA.find((node) => node.id === hud.activeDialogue?.nodeId)
    : undefined;
  const starPct =
    hud.level >= MAX_CAT_LEVEL
      ? 100
      : Math.min(100, (hud.starProgress / Math.max(1, hud.starNext)) * 100);
  const energyPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const healthPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const oxygenPct = Math.max(0, Math.min(100, (hud.oxygen / Math.max(1, hud.maxOxygen)) * 100));

  // Durante a batalha só ficam os duelistas, os comandos e o botão de abandonar.
  if (phase === 'playing' && hud.duel?.phase === 'fighting') {
    return <BattleOverlay duel={hud.duel} onCommand={onBattleCommand} onComboBreaker={onComboBreaker} onForfeit={onDuelForfeit} onTarget={onBattleTarget} />;
  }

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4">
      {/* TOP AREA */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          {/* TOP-LEFT: Ultra-compact Energy Bar + Collapsible Corner Status Drawer */}
          <div className="pointer-events-auto flex flex-col items-start gap-2 min-w-0">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F17]/88 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-lg">
              {/* Compact Energy & Vitality Bar */}
              <div className="w-24 sm:w-36 space-y-1">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-medium">
                  <span className="flex items-center gap-1 text-sky-300">
                    <Zap className="w-3 h-3 shrink-0" />
                    <span>Energia</span>
                  </span>
                  <span className="font-mono-tabular text-slate-300">{Math.round(hud.stamina)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-sky-400 transition-all duration-150"
                    style={{ width: `${energyPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-medium">
                  <span className="text-cyan-300">Oxigênio</span>
                  <span className="font-mono-tabular text-slate-300">{Math.round(hud.oxygen)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-150 ${oxygenPct < 25 ? 'bg-red-500' : 'bg-cyan-400'}`}
                    style={{ width: `${oxygenPct}%` }}
                  />
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full transition-all duration-150 ${healthPct < 25 ? 'bg-red-500' : 'bg-rose-500'}`}
                    style={{ width: `${healthPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono-tabular text-amber-300">
                  <span>
                    Nv.{hud.level}
                    {hud.isAlphaLeader ? ' ALPHA' : ''}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-rose-300">♥{hud.chances}/{hud.maxChances}</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      {hud.stars}
                    </span>
                  </span>
                </div>
              </div>

              {/* Corner toggle for full Status & Evolution panel */}
              <button
                type="button"
                onClick={() => setStatusOpen((v) => !v)}
                className="rounded-lg border border-white/15 bg-[#151D2B] px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-[#1E293D] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">{statusOpen ? 'Ocultar' : 'Status'}</span>
                <span className="hidden sm:inline">{statusOpen ? 'Ocultar' : 'Status [Tab]'}</span>
              </button>
            </div>

            {phase === 'playing' && ((hud.playerTasks?.length ?? 0) > 0 || (hud.cycleTasks?.length ?? 0) > 0 || (hud.pendingTaskRewards ?? 0) > 0) && (
              <div className="pointer-events-auto w-[min(92vw,30rem)] max-w-[30rem] rounded-xl border border-cyan-300/30 bg-[#091321]/95 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200"><Compass className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{hud.gpsTarget ? 'GPS ativo · Missão' : 'Sistema de tarefas'}</span></div>
                  <button type="button" onClick={() => setTaskPanelOpen((open) => !open)} aria-label={taskPanelOpen ? 'Minimizar tarefas' : 'Expandir tarefas'} className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-200 hover:bg-white/10">{taskPanelOpen ? 'Minimizar' : 'Expandir'}</button>
                </div>
                {hud.gpsTarget && <div className="mt-1.5 flex items-center gap-2 rounded-md border border-blue-400/30 bg-blue-500/10 px-2 py-1.5"><Compass className="h-5 w-5 shrink-0 text-blue-300" style={{ transform: `rotate(${Math.atan2(hud.gpsTarget.dx, hud.gpsTarget.dz) * 180 / Math.PI - hud.catYaw * 180 / Math.PI}deg)` }} /><div className="min-w-0 flex-1"><div className="text-[9px] font-bold uppercase tracking-wider text-blue-200">{Math.round(hud.gpsTarget.distance)} m até o destino</div><div className="truncate text-[10px] font-semibold text-white">{hud.gpsTarget.label}</div><div className="truncate text-[9px] text-slate-400">{hud.gpsTarget.objective}</div></div></div>}
                {taskPanelOpen && <>
                  {hud.cycleTasks && hud.cycleTasks.length > 0 && <div className="mt-2 border-b border-cyan-300/15 pb-2"><div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-200"><span>Tarefas do sistema</span><span>Próx. em {(() => { const remaining = Math.max(0, Math.floor(hud.secondsToNextTask ?? 0)); return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`; })()}</span></div>{Boolean(hud.pendingTaskRewards) && <div className="mb-2 rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[9px] text-amber-100">{hud.pendingTaskRewards} recompensa(s) física(s) aguardando coleta no mundo.</div>}{hud.cycleTasks.map((task) => <div key={task.id} className="mb-1.5 rounded-md bg-white/[0.035] px-2 py-1.5 text-[10px]"><div className="flex items-center justify-between gap-2"><div className={`min-w-0 truncate font-semibold ${task.status === 'completed' ? 'text-emerald-300' : 'text-slate-100'}`}>{task.title}</div>{task.status === 'completed' && <span className="shrink-0 font-bold text-emerald-300">✓ Concluída</span>}</div><div className="text-slate-400">{task.status === 'completed' ? 'Objetivo concluído' : `Etapa ${task.stageIndex + 1}/${task.stages.length}: ${task.currentStage.label} · ${task.progress}/${task.currentStage.target}`}</div><div className="mt-1 h-1 overflow-hidden rounded bg-white/10"><div className={`h-full ${task.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${task.status === 'completed' ? 100 : Math.min(100, task.progress / Math.max(1, task.currentStage.target) * 100)}%` }} /></div></div>)}</div>}
                  {(hud.playerTasks?.length ?? 0) > 0 && <div className="mb-1.5 mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-cyan-200"><span>Pedidos dos habitantes</span><span>{hud.playerTasks?.filter((task) => task.status === 'completed').length}/{hud.playerTasks?.length}</span></div>}
                  <div className="max-h-[min(34vh,19rem)] space-y-2 overflow-y-auto pr-1">{hud.playerTasks?.map((task) => <div key={task.id} className="text-[10px]"><div className="flex items-center justify-between gap-1"><span className={task.status === 'completed' ? 'text-emerald-300' : 'text-slate-100'}>{task.title}</span><span className="shrink-0 text-slate-400">{task.status === 'completed' ? '✓' : `${task.progress}/${task.target}`}</span></div><div className="mt-0.5 h-1 overflow-hidden rounded bg-white/10"><div className={`h-full ${task.status === 'completed' ? 'bg-emerald-400' : 'bg-cyan-400'}`} style={{ width: `${Math.min(100, task.progress / Math.max(1, task.target) * 100)}%` }} /></div></div>)}</div>
                </>}
              </div>
            )}
            {/* Hidden-by-default Expanded Status & Evolution Drawer */}
            {statusOpen && (
              <div className="w-64 sm:w-72 rounded-xl border border-white/15 bg-[#0B0F17]/95 p-3.5 shadow-2xl">
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-white truncate">
                      {stage.name}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        hud.isAlphaLeader ? 'text-amber-300' : 'text-cyan-300'
                      }`}
                    >
                      {hud.rankTitle} · Nível {hud.level}/{MAX_CAT_LEVEL}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 font-mono-tabular">
                      Chances: <span className="text-rose-300">{hud.chances}/{hud.maxChances}</span> ·{' '}
                      Estrelas: <span className="text-amber-300">{hud.stars}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-tabular">
                      Ataque: <span className="text-rose-300">{hud.attackPower}</span> · Sucatas:{' '}
                      <span className="text-amber-400">{hud.scrap}</span> · Moedas:{' '}
                      <span className="text-yellow-300">{hud.coins}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEvolutionTree(true)}
                    className="rounded-lg border border-white/15 bg-[#151D2B] px-2 py-1 text-[11px] font-medium text-cyan-300 hover:bg-[#1E293D] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Evoluções
                  </button>
                </div>

                <div className="mt-2.5 space-y-2">
                  <StatBar
                    label="Saúde"
                    value={hud.health}
                    max={hud.maxHealth}
                    colorClass="bg-rose-500"
                    icon={<Heart className="w-3.5 h-3.5 text-rose-400" />}
                  />
                  <StatBar
                    label="Fome"
                    value={hud.hunger}
                    max={hud.maxHunger}
                    colorClass="bg-emerald-500"
                    icon={<Utensils className="w-3.5 h-3.5 text-emerald-400" />}
                  />
                  <StatBar
                    label="Sede"
                    value={hud.thirst}
                    max={hud.maxThirst}
                    colorClass="bg-cyan-500"
                    icon={<Droplets className="w-3.5 h-3.5 text-cyan-400" />}
                  />
                  <StatBar
                    label="Oxigênio"
                    value={hud.oxygen}
                    max={hud.maxOxygen}
                    colorClass="bg-cyan-400"
                    icon={<Droplets className="w-3.5 h-3.5 text-cyan-300" />}
                  />
                  <StatBar
                    label={hud.isInsideShelter ? 'Abrigo (Protegido)' : 'Calor'}
                    value={hud.warmth}
                    max={hud.maxWarmth}
                    colorClass="bg-amber-500"
                    icon={<Flame className="w-3.5 h-3.5 text-amber-400" />}
                  />
                </div>

                <div className="mt-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Próxima Estrela</span>
                    <span className="font-mono-tabular text-amber-300">
                      {hud.level >= MAX_CAT_LEVEL
                        ? 'Nível 99 Alpha'
                        : `${Math.floor(hud.starProgress)}/${hud.starNext}`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-amber-400 transition-all duration-200"
                      style={{ width: `${starPct}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">
                    Técnicas aprendidas ({hud.unlockedMoves.length}):{' '}
                    <span className="text-cyan-200">
                      {MOVE_UNLOCKS.filter((move) => hud.unlockedMoves.includes(move.id))
                        .slice(-3)
                        .map((move) => move.name)
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                    <span>Telhados Dominados</span>
                    <span className="font-mono-tabular text-cyan-300">
                      {hud.conqueredTerritories.length}/{hud.totalTerritories}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                    <span className="text-amber-300 font-semibold">{chapter.title}:</span> {chapter.objective}
                  </p>
                </div>
              </div>
            )}
          </div>

        {/* TOP-RIGHT: Compact Sector + Utility Buttons + Optional Radar Toggle */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F17]/88 px-2 py-1.5 sm:px-3 sm:py-2 shadow-lg">
            <div className="text-right pr-2 border-r border-white/10 hidden md:block">
              <div className="font-display text-xs font-semibold text-white whitespace-nowrap">
                {hud.sectorName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono-tabular whitespace-nowrap">
                Dia {hud.day} · {formatDayPeriod(hud.timeOfDay)} · {formatClock(hud.timeOfDay)} · Chefe {hud.defeatedBosses.length}/4
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRadarOpen((v) => !v)}
                aria-label="Alternar mapa radar"
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  radarOpen
                    ? 'border-cyan-400/50 bg-[#16283D] text-cyan-300'
                    : 'border-white/10 bg-[#151D2B] text-slate-200 hover:bg-[#1E293D]'
                }`}
              >
                <Compass className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Ativar som' : 'Silenciar som'}
                className="p-1.5 rounded-lg border border-white/10 bg-[#151D2B] text-slate-200 hover:bg-[#1E293D] transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                aria-label="Ajuda e controles"
                className="p-1.5 rounded-lg border border-white/10 bg-[#151D2B] text-slate-200 hover:bg-[#1E293D] transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onPauseToggle}
                aria-label="Pausar jogo"
                className="p-1.5 rounded-lg border border-white/10 bg-[#151D2B] text-slate-200 hover:bg-[#1E293D] transition-colors cursor-pointer"
              >
                {phase === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3D Camera Perspective & Zoom Bar */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0B0F17]/88 px-2 py-1 shadow-lg">
            <button
              type="button"
              onClick={onZoomIn}
              title="Aproximar câmera (+)"
              aria-label="Aproximar câmera"
              className="p-1.5 rounded-lg border border-white/10 bg-[#151D2B] text-slate-200 hover:bg-[#1E293D] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onZoomOut}
              title="Afastar câmera (-)"
              aria-label="Afastar câmera"
              className="p-1.5 rounded-lg border border-white/10 bg-[#151D2B] text-slate-200 hover:bg-[#1E293D] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCycleCamera}
              title="Alternar perspectiva 3D (R)"
              aria-label="Alternar perspectiva 3D"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-[#151D2B] text-[11px] font-medium text-cyan-300 hover:bg-[#1E293D] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>3D</span>
            </button>
          </div>

          {/* Alerts */}
          {(hud.weather !== 'clear' || hud.isInsideShelter || hud.isClimbing) && (
            <div className="flex flex-col items-end gap-1">
              {hud.weather === 'acid_warning' && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-[#1F170B]/95 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Chuva ácida em {hud.weatherCountdown}s</span>
                </div>
              )}
              {hud.weather === 'acid_rain' && (
                <div className="flex items-center gap-1.5 rounded-lg border border-lime-500/40 bg-[#111C12]/95 px-2.5 py-1 text-[11px] font-medium text-lime-300">
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Chuva Ácida ({hud.weatherCountdown}s)</span>
                </div>
              )}
              {hud.weather === 'rain' && (
                <div className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-[#0B1724]/95 px-2.5 py-1 text-[11px] font-medium text-sky-200">
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Chuva ({hud.weatherCountdown}s)</span>
                </div>
              )}
              {hud.weather === 'snow' && (
                <div className="rounded-lg border border-cyan-300/40 bg-[#10202A]/95 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                  ❄ Neve ({hud.weatherCountdown}s)
                </div>
              )}
              {hud.weather === 'cold_wind' && (
                <div className="rounded-lg border border-blue-300/40 bg-[#101B2B]/95 px-2.5 py-1 text-[11px] font-medium text-blue-100">
                  ❄ Vento gelado ({hud.weatherCountdown}s)
                </div>
              )}
              {hud.weather === 'freezing' && (
                <div className="rounded-lg border border-indigo-300/50 bg-[#14172D]/95 px-2.5 py-1 text-[11px] font-medium text-indigo-100">
                  ❄ Frio congelante ({hud.weatherCountdown}s)
                </div>
              )}
              {hud.isInsideShelter && (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-[#0D1E1A]/95 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                  <Home className="w-3.5 h-3.5" />
                  <span>Abrigo Protegido</span>
                </div>
              )}
              {hud.isClimbing && (
                <div className="rounded-lg border border-amber-400/40 bg-[#1E170C]/95 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                  Escalando Parede
                </div>
              )}
            </div>
          )}

          {/* Optional Radar (toggled via Compass button or M) */}
          {radarOpen && (
            <div className="flex flex-col items-center rounded-xl border border-white/10 bg-[#0B0F17]/92 p-2.5 shadow-lg">
              <div className="relative w-28 h-28 rounded-full border border-cyan-500/30 bg-[#0F1726] overflow-hidden">
                <div className="absolute inset-4 rounded-full border border-white/10" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white" />
                {hud.gpsTarget && (() => {
                  const routeRange = hud.sonarActive ? Math.max(stage.sonarRadius, 75) : 65;
                  const routeX = Math.max(-1, Math.min(1, hud.gpsTarget.dx / routeRange));
                  const routeZ = Math.max(-1, Math.min(1, hud.gpsTarget.dz / routeRange));
                  const routeLength = Math.hypot(routeX, routeZ) * 44;
                  const routeAngle = Math.atan2(routeX, routeZ) * 180 / Math.PI;
                  return <><div className="absolute left-1/2 top-1/2 h-[3px] rounded-full bg-blue-400 shadow-[0_0_7px_rgba(59,130,246,0.95)]" style={{ width: `${routeLength}%`, transformOrigin: '0 50%', transform: `translateY(-50%) rotate(${routeAngle}deg)` }} /><span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,1)]" style={{ left: `${50 + routeX * 44}%`, top: `${50 + routeZ * 44}%` }} /></>;
                })()}
                {hud.radarBlips.map((b) => {
                  const maxRange = hud.sonarActive ? Math.max(stage.sonarRadius, 75) : 65;
                  const nx = Math.max(-1, Math.min(1, b.dx / maxRange));
                  const nz = Math.max(-1, Math.min(1, b.dz / maxRange));
                  const left = 50 + nx * 44;
                  const top = 50 + nz * 44;
                  const color =
                    b.kind === 'water'
                      ? 'bg-cyan-400'
                      : b.kind === 'food' || b.kind === 'prey'
                        ? 'bg-emerald-400'
                        : b.kind === 'shelter'
                          ? 'bg-purple-400'
                          : b.kind === 'boss'
                            ? 'bg-red-500 w-3 h-3'
                            : b.kind === 'rival'
                              ? 'bg-yellow-400 w-2.5 h-2.5'
                              : b.kind === 'enemy'
                                ? 'bg-orange-400'
                                : 'bg-amber-400';
                  return (
                    <span
                      key={b.id}
                      className={`absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${color}`}
                      style={{ left: `${left}%`, top: `${top}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                <span className="text-emerald-400">Comida</span>
                <span className="text-yellow-400">Rivais</span>
                <span className="text-red-400">Chefe</span>
              </div>
            </div>
          )}
              {phase === 'playing' && (
                <div className="pointer-events-auto flex w-full flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInventoryOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-xl border border-violet-300/25 bg-[#0B0F17]/90 px-3 py-2 text-xs font-semibold text-violet-100 shadow-lg backdrop-blur"
                    aria-expanded={inventoryOpen}
                  >
                    <Backpack className="h-4 w-4 text-violet-300" />
                    Mochila
                    <span className="rounded-md bg-violet-400/15 px-1.5 py-0.5 font-mono text-violet-200">
                      {(hud.inventory ?? []).reduce((sum, entry) => sum + entry.quantity, 0)}
                    </span>
                  </button>
                  {inventoryOpen && (
                    <div className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-violet-300/20 bg-[#0B0F17]/95 p-3 shadow-2xl backdrop-blur">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-violet-200">Inventário</span>
                        <button type="button" onClick={() => setInventoryOpen(false)} className="rounded p-1 text-slate-400 hover:text-white" aria-label="Fechar inventário"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        {(['collar', 'harness'] as const).map((slot) => {
                          const equippedId = hud.equipment?.[slot] ?? null;
                          return (
                            <div key={slot} className="rounded-lg border border-amber-300/20 bg-amber-400/[0.06] p-2">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-200">{slot === 'collar' ? 'Coleira' : 'Arreio'}</div>
                              <div className="mt-1 truncate text-[10px] text-slate-100">{equippedId ? ITEM_CATALOG[equippedId].name : 'Vazio'}</div>
                              {equippedId && <button type="button" onClick={() => onUnequipEquipment(slot)} className="mt-1 text-[9px] text-amber-200 underline">Remover</button>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="space-y-2">
                        {(Object.keys(ITEM_CATALOG) as InventoryItemId[]).map((itemId) => {
                          const definition = ITEM_CATALOG[itemId];
                          const quantity = hud.inventory?.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
                          const isEquipment = definition.category === 'equipment';
                          return (
                            <div key={itemId} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold text-slate-100">{definition.name}</div>
                                <div className="text-[9px] text-slate-400">{definition.description}</div>
                                <div className="mt-0.5 text-[10px] text-violet-200">Quantidade: {quantity}</div>
                              </div>
                              <button
                                type="button"
                                disabled={quantity <= 0 || phase !== 'playing'}
                                onClick={() => isEquipment ? onEquipInventoryItem(itemId as EquipmentItemId) : onUseInventoryItem(itemId)}
                                className="rounded-md border border-violet-300/25 bg-violet-500/15 px-2 py-1.5 text-[10px] font-semibold text-violet-100 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                {isEquipment ? 'Equipar' : 'Usar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {Boolean(hud.pendingTaskRewards) && <div className="mb-2 rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[9px] text-amber-100">{hud.pendingTaskRewards} recompensa(s) física(s) aguardando coleta no mundo.</div>}
                      <div className="mt-2 text-[9px] text-slate-500">A ração energética continua no inventário separado de batalha (tecla I durante duelos).</div>
                    </div>
                  )}
                </div>
              )}
        </div>
        </div>

        {/* RESPONSIVE DUEL / BOSS HEALTH BAR (Mobile + Desktop) */}
        {hud.activeBoss && (
          <div
            className={`pointer-events-none self-center w-full max-w-xs sm:max-w-sm rounded-xl border px-3.5 py-2 shadow-xl ${
              hud.activeBoss.isRivalCat
                ? 'border-amber-400/50 bg-[#1B1409]/92'
                : 'border-red-500/45 bg-[#1A0D12]/92'
            }`}
          >
            <div className="flex items-center justify-between w-full text-xs gap-2">
              <span
                className={`flex items-center gap-1.5 font-display font-bold truncate ${
                  hud.activeBoss.isRivalCat ? 'text-amber-200' : 'text-red-200'
                }`}
              >
                {hud.activeBoss.isRivalCat ? (
                  <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
                <span className="truncate">
                  {hud.activeBoss.isRivalCat
                    ? `TELHADO · ${hud.activeBoss.name} (Nv.${hud.activeBoss.rivalLevel})`
                    : `CHEFE · ${hud.activeBoss.name}`}
                </span>
              </span>
              <span
                className={`font-mono-tabular shrink-0 ${
                  hud.activeBoss.isRivalCat ? 'text-amber-300' : 'text-red-300'
                }`}
              >
                {Math.max(0, Math.ceil(hud.activeBoss.hp))}/{hud.activeBoss.maxHp}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className={`h-full transition-all duration-150 ${
                  hud.activeBoss.isRivalCat ? 'bg-amber-400' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(0, (hud.activeBoss.hp / hud.activeBoss.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            className={`rounded-lg border px-4 py-2 text-xs font-medium shadow-lg whitespace-nowrap ${
              toast.tone === 'warn'
                ? 'border-amber-500/40 bg-[#1F170B]/95 text-amber-200'
                : toast.tone === 'success'
                  ? 'border-emerald-500/40 bg-[#0D1E1A]/95 text-emerald-200'
                  : 'border-white/15 bg-[#0E1420]/95 text-slate-100'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {hud.activeDialogue && dialogueNode && (phase === 'playing' || phase === 'paused') && (() => {
        const anchor = hud.dialogueAnchor;
        const ax = Math.min(0.8, Math.max(0.2, anchor?.x ?? 0.5));
        const ay = Math.min(0.92, Math.max(0.32, anchor?.y ?? 0.45));
        return (
          <div
            className="pointer-events-auto absolute z-30 w-[min(78vw,16rem)] -translate-x-1/2 -translate-y-full"
            style={{ left: `${ax * 100}%`, top: `${ay * 100}%` }}
          >
            <div className="relative rounded-xl border border-amber-300/40 bg-[#101827]/95 px-2.5 py-2 shadow-xl backdrop-blur-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold text-amber-200">{dialogueNode.speaker}</span>
                <button type="button" onClick={onDialogueClose} aria-label="Fechar conversa" className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mb-1.5 max-h-28 overflow-y-auto text-[12px] leading-snug text-slate-100">{dialogueNode.text}</p>
              {!hud.activeDialogue.ended && (hud.activeDialogueOptions?.length ?? 0) > 0 ? (
                <div className="grid gap-1">
                  {hud.activeDialogueOptions?.map((option, index) => (
                    <button key={option.id} type="button" onClick={() => onDialogueOption(option.id)} className="rounded-md border border-cyan-300/20 bg-[#172438] px-2 py-1 text-left text-[11px] font-semibold leading-tight text-cyan-100 transition-colors hover:border-cyan-300/60 hover:bg-[#20334e]">
                      <span className="mr-1 text-amber-300">{index + 1}.</span>{option.text}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-end">
                  <button type="button" onClick={onDialogueClose} className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-300">Fechar</button>
                </div>
              )}
              <div className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-amber-300/40 bg-[#101827]" />
            </div>
          </div>
        );
      })()}

      {/* BOTTOM ACTION BAR */}
      <div className="flex flex-col items-center gap-2.5">
        {hud.prompt && phase === 'playing' && !hud.activeDialogue && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-xl border border-cyan-400/35 bg-[#0E1523]/95 px-4 py-2.5 shadow-xl">
            <div>
              <div className="font-display text-sm font-bold text-white">{hud.prompt.label}</div>
              <div className="text-xs text-slate-300">{hud.prompt.detail}</div>
            </div>
            <button
              type="button"
              onClick={onInteract}
              className="rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
            >
              [E] {hud.prompt.actionText}
            </button>
            {hud.prompt.kind === 'shelter' && hud.prompt.canUpgrade && (
              <button
                type="button"
                onClick={onUpgradeShelter}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>[U] {hud.prompt.secondaryLabel}</span>
              </button>
            )}
          </div>
        )}

        {phase === 'playing' && hud.duel && (
          <DuelPanel duel={hud.duel} onOffer={onDuelOffer} onCancel={onDuelCancel} onForfeit={onDuelForfeit} onCommand={onBattleCommand} onComboBreaker={onComboBreaker} onTarget={onBattleTarget} />
        )}

        {isTouchDevice && phase === 'playing' && !hud.activeDialogue && (
          <div className="pointer-events-auto w-full flex items-end justify-between px-1 pb-1">
            <VirtualJoystick sprint={touchSprint} onMove={onVirtualInput} />

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                {...instantPress(onClawAttack)}
                className="h-10 px-3 rounded-lg bg-rose-500/85 text-white border border-rose-300/40 text-xs font-bold whitespace-nowrap"
              >
                Azunhar
              </button>
              <button
                type="button"
                {...instantPress(onMeow)}
                className="h-10 px-3 rounded-lg bg-[#141C2B]/90 text-amber-200 border border-amber-400/35 text-xs font-semibold whitespace-nowrap"
              >
                Miar
              </button>
              <button
                type="button"
                {...instantPress(onChallenge)}
                className="h-10 px-3 rounded-lg bg-[#141C2B]/90 text-rose-200 border border-rose-400/35 text-xs font-semibold whitespace-nowrap"
              >
                Duelo
              </button>
              <button
                type="button"
                {...instantPress(() => setTouchSprint((s) => !s))}
                className={`h-10 px-3 rounded-lg border text-xs font-semibold whitespace-nowrap ${
                  touchSprint
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-[#141C2B]/90 text-slate-200 border-white/15'
                }`}
              >
                Correr
              </button>
              <button
                type="button"
                {...instantPress(onJump)}
                className="h-10 px-3 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold whitespace-nowrap"
              >
                Pular
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Combat & Ability Dock */}
        <div className="pointer-events-auto flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="mb-1 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/10 bg-[#0B0F17]/90 px-3 py-1 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? 'Habilidades [H]' : 'Ocultar [H]'}</span>
          </button>

          {!dockCollapsed && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0B0F17]/90 px-3 py-2 shadow-xl">
              {/* No toque, Azunhar/Miar/Desafiar já existem nos botões de ação: não duplicar. */}
              {!isTouchDevice && (
                <>
                  <button
                    type="button"
                    onClick={onClawAttack}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>[J / Clique] Azunhar</span>
                  </button>

                  <button
                    type="button"
                    onClick={onMeow}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/35 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>[V] Miar</span>
                  </button>

                  <button
                    type="button"
                    onClick={onChallenge}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/35 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/25 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>[B] Desafiar</span>
                  </button>
                </>
              )}

              <button
                type="button"
                {...instantPress(onSonar)}
                disabled={hud.sonarCooldown > 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  hud.sonarCooldown > 0
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-[#152236] border border-cyan-500/35 text-cyan-300 hover:bg-[#1B2C46] cursor-pointer'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>{hud.sonarCooldown > 0 ? `Sonar (${Math.ceil(hud.sonarCooldown)}s)` : '[F] Sonar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLoreArchive(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#151D2B] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1E293D] transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-mono-tabular">
                  Diários ({hud.discoveredTerminals.length}/{LORE_LOGS.length})
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {evolvedBannerStage !== null && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/40 bg-[#0E1523] p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Sparkles className="w-4 h-4" />
              <span>Evolução Concluída</span>
            </div>
            <h2 className="font-display mt-2 text-2xl font-bold text-white">
              {EVOLUTION_STAGES[evolvedBannerStage].name}
            </h2>
            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
              {EVOLUTION_STAGES[evolvedBannerStage].subtitle}
            </p>
            <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-[#141D2F] p-3.5">
              <div className="text-xs font-semibold text-slate-200">Novas Adaptações:</div>
              {EVOLUTION_STAGES[evolvedBannerStage].abilities.map((ab) => (
                <div key={ab} className="text-xs text-cyan-300">
                  · {ab}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onDismissEvolved}
              className="mt-5 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              Continuar Explorando
            </button>
          </div>
        </div>
      )}

      {activeLore && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-sky-400/35 bg-[#0E1523] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-sky-400">{activeLore.sector}</div>
                <h2 className="font-display mt-1 text-xl font-bold text-white">{activeLore.title}</h2>
              </div>
              <button
                type="button"
                onClick={onCloseLore}
                className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-200 leading-relaxed">{activeLore.content}</p>
            <button
              type="button"
              onClick={onCloseLore}
              className="mt-5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showEvolutionTree && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0E1523] p-6 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
              <div>
                <h2 className="font-display text-xl font-bold text-white">
                  Evolução por Estrelas · Nível {hud.level}/{MAX_CAT_LEVEL}
                </h2>
                <p className="text-xs text-slate-400">
                  Dispute telhados contra gatos rivais para ganhar Estrelas e alcançar o Nível 99 (Gato Líder & Alpha).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEvolutionTree(false)}
                className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EVOLUTION_STAGES.map((st, idx) => {
                const unlocked = idx <= hud.stageIndex;
                const current = idx === hud.stageIndex;
                return (
                  <div
                    key={st.level}
                    className={`rounded-xl border p-4 ${
                      current
                        ? 'border-cyan-400/60 bg-[#142033]'
                        : unlocked
                          ? 'border-emerald-500/35 bg-[#111A28]'
                          : 'border-white/10 bg-[#111722] opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-cyan-300">Estágio {st.level}</span>
                      <span className="text-slate-400 font-mono-tabular">
                        {current ? 'Atual' : unlocked ? 'Desbloqueado' : `Nível ${st.minCatLevel}+`}
                      </span>
                    </div>
                    <h3 className="font-display mt-1 text-base font-bold text-white">{st.name}</h3>
                    <p className="mt-1 text-xs text-slate-300">{st.subtitle}</p>
                    <div className="mt-2.5 space-y-1">
                      {st.abilities.map((ab) => (
                        <div key={ab} className="text-xs text-slate-400">
                          · {ab}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-xl border border-amber-400/40 bg-[#1A150B] p-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-sm font-bold text-amber-300">
                  Nível 99 · Gato Líder & Alpha
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Coroa dourada, porte máximo (1.52x) e bônus supremo de ataque e vitalidade.
                </p>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-amber-300 shrink-0">
                {hud.isAlphaLeader ? 'ALCANÇADO' : `${hud.level}/99`}
              </span>
            </div>
          </div>
        </div>
      )}

      {showLoreArchive && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#0E1523] p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
              <h2 className="font-display text-xl font-bold text-white">
                Diários da Cidade ({hud.discoveredTerminals.length}/{LORE_LOGS.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowLoreArchive(false)}
                className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {LORE_LOGS.map((log) => {
                const found = hud.discoveredTerminals.includes(log.id);
                return (
                  <div key={log.id} className="rounded-xl border border-white/10 bg-[#141D2E] p-3.5">
                    <div className="text-xs text-sky-400">{log.sector}</div>
                    <div className="font-display text-sm font-bold text-white mt-0.5">
                      {found ? log.title : 'Terminal ainda não lido'}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                      {found ? log.content : 'Explore a região e interaja com o terminal azul.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0E1523] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
              <h2 className="font-display text-xl font-bold text-white">Controles & Habilidades</h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Mover / Subir Paredes</span>
                <span className="font-semibold text-white">W A S D (encostar na parede)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Azunhar (Ataque de Garra)</span>
                <span className="font-semibold text-white">Clique ou Tecla J / C</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Miar (Distrair predadores)</span>
                <span className="font-semibold text-white">Tecla V</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Correr</span>
                <span className="font-semibold text-white">Shift</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Pular (sempre cai em pé!)</span>
                <span className="font-semibold text-white">Espaço</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Comer, Beber, Abrigo</span>
                <span className="font-semibold text-white">Tecla E</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Abrir/Fechar Status</span>
                <span className="font-semibold text-white">Tecla Tab</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Câmera 3D & Zoom</span>
                <span className="font-semibold text-white">Arrastar / Pinça / + - / Tecla R</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Sonar / Radar</span>
                <span className="font-semibold text-white">Tecla F / Tecla M</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0E1523] p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Jogo Pausado</h2>
            <p className="mt-1.5 text-xs text-slate-400">
              {chapter.title} · {stage.name}
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onPauseToggle}
                className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="inline-flex items-center justify-center gap-2 w-full rounded-lg border border-white/15 bg-[#151E30] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-[#1E2A42] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'victory' && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/50 bg-[#0D1A18] p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Trophy className="w-4 h-4" />
              <span>Cidade Conquistada</span>
            </div>
            <h2 className="font-display mt-1.5 text-2xl font-bold text-white">
              Você derrotou o Leão Apex!
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Todos os 4 chefes das ruínas caíram diante das suas garras. De um pequeno filhote abandonado, você se tornou o guardião absoluto de Nova-Alvorada.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onContinueAfterVictory}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                Continuar no Mundo Aberto
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="rounded-lg border border-white/15 bg-[#152420] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-[#1D312C] transition-colors cursor-pointer"
              >
                Novo Jogo
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'fallen' && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/50 bg-[#141118] p-6 shadow-2xl">
            <div className="text-xs font-semibold text-amber-400">
              Você foi derrubado · Chance preservada
            </div>
            <h2 className="font-display mt-1 text-2xl font-bold text-white">
              Levante-se no mesmo lugar!
            </h2>
            <p className="mt-1.5 text-sm text-slate-300">
              Causa: {hud.causeOfDeath || 'Combate intenso'}
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#1C1622] p-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-300">Chances Restantes</span>
              <span className="font-mono-tabular text-base font-bold text-rose-300">
                {hud.chances} / {hud.maxChances}
              </span>
            </div>
            <button
              type="button"
              onClick={onReviveHere}
              className="mt-5 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              Continuar de Onde Morreu ({hud.chances}/{hud.maxChances} chances)
            </button>
          </div>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-[#120D14] p-6 shadow-2xl">
            <div className="text-xs font-semibold text-red-400">5 Chances Esgotadas</div>
            <h2 className="font-display mt-1 text-2xl font-bold text-white">
              Você perdeu todas as 5 chances
            </h2>
            <p className="mt-1.5 text-sm text-slate-300">
              Causa: {hud.causeOfDeath || 'Exaustão'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg border border-white/10 bg-[#1B1420] p-3">
                <div className="text-slate-400">Nível &amp; Estrelas</div>
                <div className="font-mono-tabular mt-0.5 text-base font-bold text-white">
                  Nv.{hud.level} · ★{hud.stars}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#1B1420] p-3">
                <div className="text-slate-400">Telhados Dominados</div>
                <div className="font-mono-tabular mt-0.5 text-base font-bold text-amber-300">
                  {hud.conqueredTerritories.length}/{hud.totalTerritories}
                </div>
              </div>
            </div>
            {hud.hasBossCheckpoint && (
              <p className="mt-3 rounded-lg border border-emerald-500/35 bg-[#0D1E1A] px-3 py-2 text-xs text-emerald-200">
                Checkpoint salvo na <strong>Fase {hud.checkpointPhase}</strong> após derrotar o chefe!
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2.5">
              {hud.hasBossCheckpoint && (
                <button
                  type="button"
                  onClick={onContinueCheckpoint}
                  className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  Continuar do Checkpoint (Fase {hud.checkpointPhase})
                </button>
              )}
              <button
                type="button"
                onClick={onRestart}
                className={`inline-flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer ${
                  hud.hasBossCheckpoint
                    ? 'border border-white/15 bg-[#1B1420] text-slate-200 hover:bg-[#271D2E]'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recomeçar do Início</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
