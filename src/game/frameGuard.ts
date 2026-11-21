/**
 * Proteção do laço de quadros. O `tick` do motor termina com `render` + `requestAnimationFrame`;
 * uma exceção em qualquer atualização anterior interrompia os dois e deixava o jogo congelado
 * (na batalha, com o clarão branco de abertura preso em tela cheia = "tela branca").
 */
export interface FrameFailure {
  /** Quantos quadros seguidos falharam, contando este. */
  consecutive: number;
  /** Registrar no console (limitado, para não inundar quando falha a cada quadro). */
  shouldLog: boolean;
  /** Falhas seguidas demais: o chamador deve sair do modo que está falhando (ex.: encerrar a batalha). */
  shouldRecover: boolean;
}

export class FrameFailureTracker {
  private consecutive = 0;
  private lastLoggedAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly recoverAfter = 3, private readonly logEveryMs = 2000) {}

  public success(): void {
    this.consecutive = 0;
  }

  public failure(nowMs: number): FrameFailure {
    this.consecutive += 1;
    const shouldLog = nowMs - this.lastLoggedAt >= this.logEveryMs;
    if (shouldLog) this.lastLoggedAt = nowMs;
    return { consecutive: this.consecutive, shouldLog, shouldRecover: this.consecutive >= this.recoverAfter };
  }

  public reset(): void {
    this.consecutive = 0;
  }
}

/**
 * Executa uma etapa do quadro sem deixar a exceção escapar.
 * Retorna o erro capturado ou `null` se a etapa terminou normalmente.
 */
export function runFrameStep(step: () => void): unknown | null {
  try {
    step();
    return null;
  } catch (error) {
    return error ?? new Error('Falha desconhecida no quadro');
  }
}
