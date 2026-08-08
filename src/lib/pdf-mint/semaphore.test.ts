import { describe, expect, it } from 'vitest'

import { __createSemaphoreForTests, MINT_BUSY_MESSAGE } from './semaphore'

/** D5: bounded concurrency — brief wait, then the pt-BR "tente novamente". */
describe('mint semaphore (ADR 0104 D5)', () => {
  it('runs up to N concurrently and queues the rest', async () => {
    const sem = __createSemaphoreForTests(2)
    let running = 0
    let peak = 0
    const job = () =>
      sem.run(async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 20))
        running -= 1
      })
    await Promise.all([job(), job(), job(), job(), job()])
    expect(peak).toBe(2)
  })

  it('over capacity beyond the brief wait fails with the pt-BR busy message — never queues to disk', async () => {
    const sem = __createSemaphoreForTests(1)
    let release!: () => void
    const held = sem.run(
      () => new Promise<void>((r) => (release = r)),
      10_000,
    )
    await new Promise((r) => setTimeout(r, 5)) // the permit is genuinely held
    await expect(
      sem.run(async () => 'never', 30), // 30 ms budget, permit stays held
    ).rejects.toThrow(MINT_BUSY_MESSAGE)
    release()
    await held
  })

  it('a released permit unblocks a waiter within its budget', async () => {
    const sem = __createSemaphoreForTests(1)
    let release!: () => void
    const held = sem.run(() => new Promise<void>((r) => (release = r)))
    await new Promise((r) => setTimeout(r, 5))
    const waiter = sem.run(async () => 'ran', 1_000)
    release()
    await held
    await expect(waiter).resolves.toBe('ran')
  })
})
