import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { portsCompatible } from '../shared/graph/ports'

describe('portsCompatible', () => {
  it('allows matching types', () => {
    assert.equal(portsCompatible('float', 'float'), true)
    assert.equal(portsCompatible('trigger', 'trigger'), true)
  })

  it('allows trigger to float for Ramp/Hold', () => {
    assert.equal(portsCompatible('trigger', 'float'), true)
  })

  it('rejects incompatible types', () => {
    assert.equal(portsCompatible('pixels', 'float'), false)
    assert.equal(portsCompatible('float', 'trigger'), false)
  })
})
