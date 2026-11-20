import { MOVE_UNLOCKS } from '../progression/unlocks';
import { getShop, isShopOpen } from './catalog';

export type TechniquePurchaseFailure = 'unknown_shop' | 'not_sold' | 'closed' | 'level_too_low' | 'no_coins' | 'already_known';

export interface TechniquePurchaseInput {
  shopId: string;
  moveId: string;
  coins: number;
  level: number;
  timeOfDay: number;
  /** IDs de técnicas já liberados (nível ou compra). */
  unlockedMoves: readonly string[];
}
export type TechniquePurchaseResult =
  | { ok: true; coins: number; unlockedMoves: string[]; price: number }
  | { ok: false; reason: TechniquePurchaseFailure; message: string };

const MESSAGES: Record<TechniquePurchaseFailure, string> = {
  unknown_shop: 'Loja desconhecida.',
  not_sold: 'Esta loja não ensina essa técnica.',
  closed: 'A loja está fechada neste horário.',
  level_too_low: 'Seu nível ainda é baixo para aprender esta técnica.',
  no_coins: 'Moedas insuficientes.',
  already_known: 'Você já conhece esta técnica.',
};

function fail(reason: TechniquePurchaseFailure): TechniquePurchaseResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/** Compra determinística: valida loja, horário, nível, moedas e se a técnica já é conhecida antes de cobrar. */
export function purchaseTechnique(input: TechniquePurchaseInput): TechniquePurchaseResult {
  const shop = getShop(input.shopId);
  if (!shop) return fail('unknown_shop');
  const offer = shop.techniques?.find((entry) => entry.moveId === input.moveId);
  if (!offer || !MOVE_UNLOCKS.some((move) => move.id === offer.moveId)) return fail('not_sold');
  if (!isShopOpen(shop, input.timeOfDay)) return fail('closed');
  if (input.unlockedMoves.includes(input.moveId)) return fail('already_known');
  if (input.level < offer.levelRequired) return fail('level_too_low');
  if (!Number.isFinite(input.coins) || input.coins < offer.price) return fail('no_coins');
  return { ok: true, coins: input.coins - offer.price, unlockedMoves: [...input.unlockedMoves, input.moveId], price: offer.price };
}
