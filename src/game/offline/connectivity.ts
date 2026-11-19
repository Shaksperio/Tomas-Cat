const CONNECTIVITY_ERROR_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'network-request-failed',
]);

/**
 * Só falhas de transporte/indisponibilidade permitem entrar no modo de
 * contingência. Erros de autorização, regras ou dados inválidos continuam
 * bloqueando o acesso remoto e precisam ser corrigidos.
 */
export function isRecoverableConnectivityFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === 'string' ? candidate.code.split('/').pop() ?? '' : '';
  if (CONNECTIVITY_ERROR_CODES.has(code)) return true;
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return /tempo esgotado ao consultar o firestore/i.test(message);
}
