import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';

interface Offset { x: number; y: number }

// Quem foi movido por último fica por cima dos demais.
let topZ = 40;
const storageKey = (id: string) => `tomas_hud_pos_v1_${id}`;
const VISIBLE_MARGIN = 48;

function loadOffset(id: string): Offset {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Offset>;
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) return { x: parsed.x as number, y: parsed.y as number };
    }
  } catch { /* armazenamento indisponível */ }
  return { x: 0, y: 0 };
}

function saveOffset(id: string, offset: Offset): void {
  try {
    if (offset.x === 0 && offset.y === 0) localStorage.removeItem(storageKey(id));
    else localStorage.setItem(storageKey(id), JSON.stringify(offset));
  } catch { /* ignore */ }
}

interface DraggablePanelProps {
  id: string;
  className?: string;
  /** Posição da alça de arrasto dentro do cartão (classes Tailwind). */
  handleClassName?: string;
  children: ReactNode;
}

/**
 * Cartão da HUD que pode ser arrastado pela alça (⠿) para fora de cima de outros.
 * Duplo toque na alça devolve o cartão à posição original. A posição é lembrada.
 */
export function DraggablePanel({ id, className = '', handleClassName = 'left-1/2 -translate-x-1/2', children }: DraggablePanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<Offset>(() => loadOffset(id));
  const offsetRef = useRef(offset);
  const [z, setZ] = useState<number | undefined>(undefined);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null);

  const clamp = useCallback((next: Offset): Offset => {
    const el = ref.current;
    if (!el) return next;
    const rect = el.getBoundingClientRect();
    const baseLeft = rect.left - offsetRef.current.x;
    const baseTop = rect.top - offsetRef.current.y;
    const minX = -(baseLeft + rect.width - VISIBLE_MARGIN);
    const maxX = window.innerWidth - VISIBLE_MARGIN - baseLeft;
    const minY = -baseTop;
    const maxY = window.innerHeight - VISIBLE_MARGIN - baseTop;
    return {
      x: Math.min(maxX, Math.max(minX, next.x)),
      y: Math.min(maxY, Math.max(minY, next.y)),
    };
  }, []);

  const apply = useCallback((next: Offset) => {
    offsetRef.current = next;
    setOffset(next);
  }, []);

  // Mantém o cartão visível após girar a tela ou redimensionar a janela.
  useEffect(() => {
    const reclamp = () => apply(clamp(offsetRef.current));
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [apply, clamp]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin: offsetRef.current };
    topZ += 1;
    setZ(topZ);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    apply(clamp({ x: drag.origin.x + e.clientX - drag.startX, y: drag.origin.y + e.clientY - drag.startY }));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    saveOffset(id, offsetRef.current);
  };

  const reset = () => {
    apply({ x: 0, y: 0 });
    saveOffset(id, { x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, zIndex: z }}
    >
      {children}
      <div
        role="button"
        aria-label="Mover cartão (duplo toque para voltar ao lugar)"
        title="Arraste para mover · duplo toque volta ao lugar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={reset}
        className={`pointer-events-auto absolute -top-2.5 z-10 flex h-5 w-12 cursor-grab touch-none select-none items-center justify-center rounded-full border border-white/20 bg-[#1b2740]/95 text-slate-300 shadow active:cursor-grabbing ${handleClassName}`}
      >
        <GripHorizontal className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
