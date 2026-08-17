import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ENGINE_CRASH_WINDOW_MS,
  ENGINE_MAX_CRASHES,
  recordEngineCrash
} from './engineRestart'

describe('recordEngineCrash', () => {
  it('allows restarts up to the cap inside the window', () => {
    let stamps: number[] = []
    const t0 = 1_000_000
    for (let i = 0; i < ENGINE_MAX_CRASHES; i++) {
      const result = recordEngineCrash(stamps, t0 + i * 10)
      stamps = result.timestamps
      assert.equal(result.restart, true)
    }
    const over = recordEngineCrash(stamps, t0 + ENGINE_MAX_CRASHES * 10)
    assert.equal(over.restart, false)
    assert.equal(over.timestamps.length, ENGINE_MAX_CRASHES + 1)
  })

  it('forgets crashes outside the window', () => {
    const first = recordEngineCrash([], 0)
    assert.equal(first.restart, true)
    const later = recordEngineCrash(first.timestamps, ENGINE_CRASH_WINDOW_MS + 1)
    assert.equal(later.restart, true)
    assert.equal(later.timestamps.length, 1)
  })
})
