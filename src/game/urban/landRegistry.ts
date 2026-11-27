import type { Lot, LotStatus } from './types';
import { rectsOverlap } from './urbanPlanning';

export interface LandTransaction {
  seq: number;
  tick: number;
  lotId: string;
  kind: 'registered' | 'transfer' | 'status';
  fromOwnerId: string | null;
  toOwnerId: string | null;
  price: number;
  contractId: string;
}

export interface TransferRequest {
  lotId: string;
  fromOwnerId: string | null;
  toOwnerId: string;
  price: number;
  contractId: string;
  tick: number;
}

export type RegistryResult = { ok: true } | { ok: false; reason: string };

/**
 * Matrícula simulada dos terrenos: propriedade, histórico e transações.
 * Nenhuma transferência sem proprietário atual correto, preço válido e contrato único.
 */
export class LandRegistry {
  private readonly lots = new Map<string, Lot>();
  private readonly history: LandTransaction[] = [];
  private readonly contracts = new Set<string>();

  public register(lot: Lot, tick = 0): RegistryResult {
    if (!lot.id.trim() || !lot.worldId.trim() || !lot.sectorId.trim()) return { ok: false, reason: 'Lote sem identidade.' };
    if (![lot.x, lot.z, lot.width, lot.depth, lot.slope].every(Number.isFinite) || lot.width <= 0 || lot.depth <= 0) {
      return { ok: false, reason: 'Dimensões do lote inválidas.' };
    }
    if (this.lots.has(lot.id)) return { ok: false, reason: 'Lote já registrado.' };
    for (const other of this.lots.values()) {
      if (other.worldId === lot.worldId && rectsOverlap(other, lot)) return { ok: false, reason: `Lote sobrepõe ${other.id}.` };
    }
    this.lots.set(lot.id, { ...lot });
    this.log({ tick, lotId: lot.id, kind: 'registered', fromOwnerId: null, toOwnerId: lot.ownerId, price: 0, contractId: `registro:${lot.id}` });
    return { ok: true };
  }

  public transfer(request: TransferRequest): RegistryResult {
    const lot = this.lots.get(request.lotId);
    if (!lot) return { ok: false, reason: 'Lote desconhecido.' };
    if (lot.ownerId !== request.fromOwnerId) return { ok: false, reason: 'O vendedor não é o proprietário registrado.' };
    if (!request.toOwnerId.trim() || request.toOwnerId === request.fromOwnerId) return { ok: false, reason: 'Comprador inválido.' };
    if (!Number.isFinite(request.price) || request.price < 0) return { ok: false, reason: 'Preço inválido.' };
    if (!request.contractId.trim() || this.contracts.has(request.contractId)) return { ok: false, reason: 'Contrato ausente ou já utilizado.' };
    if (lot.status === 'under_construction') return { ok: false, reason: 'Lote em obra não pode ser transferido.' };
    this.contracts.add(request.contractId);
    lot.ownerId = request.toOwnerId;
    this.log({ tick: request.tick, lotId: lot.id, kind: 'transfer', fromOwnerId: request.fromOwnerId, toOwnerId: request.toOwnerId, price: request.price, contractId: request.contractId });
    return { ok: true };
  }

  public setStatus(lotId: string, status: LotStatus, tick: number): RegistryResult {
    const lot = this.lots.get(lotId);
    if (!lot) return { ok: false, reason: 'Lote desconhecido.' };
    const allowed: Record<LotStatus, LotStatus[]> = { free: ['under_construction'], under_construction: ['built', 'free'], built: [] };
    if (!allowed[lot.status].includes(status)) return { ok: false, reason: `Transição ${lot.status} → ${status} inválida.` };
    lot.status = status;
    this.log({ tick, lotId, kind: 'status', fromOwnerId: lot.ownerId, toOwnerId: lot.ownerId, price: 0, contractId: `status:${lotId}:${status}:${tick}` });
    return { ok: true };
  }

  public get(lotId: string): Lot | undefined {
    const lot = this.lots.get(lotId);
    return lot ? { ...lot } : undefined;
  }

  /** Visão somente leitura para o motor de urbanismo. */
  public asMap(): ReadonlyMap<string, Lot> { return this.lots; }

  public lotsInWorld(worldId: string): Lot[] {
    return [...this.lots.values()].filter((l) => l.worldId === worldId).sort((a, b) => a.id.localeCompare(b.id)).map((l) => ({ ...l }));
  }

  public transactionsOf(lotId: string): LandTransaction[] { return this.history.filter((t) => t.lotId === lotId); }

  private log(entry: Omit<LandTransaction, 'seq'>): void { this.history.push({ seq: this.history.length + 1, ...entry }); }
}
