/**
 * The mint concurrency limiter (ADR 0104 D5): "queueing" is a ~3-permit
 * in-process semaphore with a BRIEF wait — never a job pipeline, never a disk
 * queue. Over capacity, callers wait up to {@link ACQUIRE_TIMEOUT_MS} and then
 * fail with the pt-BR "tente novamente" (Gotenberg's own internal queue sits
 * behind these permits).
 */

export const MINT_CONCURRENCY = 3
export const ACQUIRE_TIMEOUT_MS = 5_000

/** pt-BR error thrown when no permit frees up within the brief wait. */
export const MINT_BUSY_MESSAGE =
  'O serviço de emissão está ocupado no momento. Tente novamente em instantes.'

class Semaphore {
  private available: number
  private waiters: Array<(acquired: boolean) => void> = []

  constructor(permits: number) {
    this.available = permits
  }

  async run<T>(fn: () => Promise<T>, timeoutMs = ACQUIRE_TIMEOUT_MS): Promise<T> {
    await this.acquire(timeoutMs)
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(timeoutMs: number): Promise<void> {
    if (this.available > 0) {
      this.available -= 1
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = (acquired: boolean) => {
        clearTimeout(timer)
        if (acquired) resolve()
        else reject(new Error(MINT_BUSY_MESSAGE))
      }
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(waiter)
        if (idx >= 0) this.waiters.splice(idx, 1)
        waiter(false)
      }, timeoutMs)
      this.waiters.push(waiter)
    })
  }

  private release(): void {
    const next = this.waiters.shift()
    if (next) next(true)
    else this.available += 1
  }
}

/** The process-wide mint semaphore. */
export const mintSemaphore = new Semaphore(MINT_CONCURRENCY)

/** Test hook: a fresh, independently sized semaphore. */
export function __createSemaphoreForTests(permits: number): {
  run<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T>
} {
  return new Semaphore(permits)
}
