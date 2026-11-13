import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
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
import { LORE_LOGS } from '../game/worldBuilder';

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
  onUpgradeShelter: () => void;
  onClawAttack: () => void;
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

function formatClock(timeOfDay: number): string {
  const totalMinutes = Math.floor(timeOfDay * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function formatDayPeriod(timeOfDay: number): string {
  const hour = timeOfDay * 24;
  if (hour >= 5 && hour < 7) return 'Alvorecer';
  if (hour >= 7 && hour < 11) return 'Manhã';
  if (hour >= 11 && hour < 16) return 'Dia';
  if (hour >= 16 && hour < 18) return 'Tarde';
  if (hour >= 18 && hour < 20) return 'Anoitecer';
  if (hour >= 20) return 'Noite';
  return 'Madrugada';
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
  onUpgradeShelter,
  onClawAttack,
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
  const starPct =
    hud.level >= MAX_CAT_LEVEL
      ? 100
      : Math.min(100, (hud.starProgress / Math.max(1, hud.starNext)) * 100);
  const energyPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const healthPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4">
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
                      <span className="text-amber-400">{hud.scrap}</span>
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
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

      {/* BOTTOM ACTION BAR */}
      <div className="flex flex-col items-center gap-2.5">
        {hud.prompt && phase === 'playing' && (
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

        {isTouchDevice && phase === 'playing' && (
          <div className="pointer-events-auto w-full flex items-end justify-between px-1 pb-1">
            <VirtualJoystick sprint={touchSprint} onMove={onVirtualInput} />

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onClawAttack}
                className="h-10 px-3 rounded-lg bg-rose-500/85 text-white border border-rose-300/40 text-xs font-bold whitespace-nowrap"
              >
                Azunhar
              </button>
              <button
                type="button"
                onClick={onMeow}
                className="h-10 px-3 rounded-lg bg-[#141C2B]/90 text-amber-200 border border-amber-400/35 text-xs font-semibold whitespace-nowrap"
              >
                Miar
              </button>
              <button
                type="button"
                onClick={() => setTouchSprint((s) => !s)}
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
                onClick={onJump}
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
                onClick={onSonar}
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/65 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/65 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/70 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/75 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/75 p-4">
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
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-black/75 p-4">
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
