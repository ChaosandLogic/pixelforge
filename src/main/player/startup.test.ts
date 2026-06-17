import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parsePlayerArgs } from './args'
import { resolveStartupPlan } from './startupPlan'
import {
  DEFAULT_PLAYER_STARTUP_CONFIG,
  isStartupConfigReadyForLogin,
  type PlayerStartupConfig
} from '../../shared/playerStartup'

describe('parsePlayerArgs', () => {
  it('parses project and headless flags', () => {
    const args = parsePlayerArgs(['--headless', '--project', '/shows/demo.pxf', '--interface', 'en0'])
    assert.equal(args.headless, true)
    assert.equal(args.headlessExplicit, true)
    assert.equal(args.project, '/shows/demo.pxf')
    assert.equal(args.iface, 'en0')
  })

  it('parses show-dir and auto-output', () => {
    const args = parsePlayerArgs(['--show-dir', '/shows/bundle', '--auto-output'])
    assert.equal(args.showDir, '/shows/bundle')
    assert.equal(args.autoOutput, true)
    assert.equal(args.autoOutputExplicit, true)
  })

  it('treats positional pxf as project path', () => {
    const args = parsePlayerArgs(['/shows/night.pxf'])
    assert.equal(args.project, '/shows/night.pxf')
  })

  it('parses --no-output', () => {
    const args = parsePlayerArgs(['--no-output', '--project', '/a.pxf'])
    assert.equal(args.noOutput, true)
  })
})

describe('resolveStartupPlan', () => {
  const emptyCli = parsePlayerArgs([])

  it('uses CLI show path over saved config', () => {
    const saved: PlayerStartupConfig = {
      ...DEFAULT_PLAYER_STARTUP_CONFIG,
      showPath: '/saved/show.pxf',
      showPathKind: 'project',
      headless: false,
      autoOutput: false
    }
    const cli = parsePlayerArgs(['--project', '/cli/show.pxf', '--auto-output'])
    const plan = resolveStartupPlan({ cli, saved })
    assert.equal(plan.showPath, '/cli/show.pxf')
    assert.equal(plan.autoOutput, true)
  })

  it('uses saved headless when CLI does not specify', () => {
    const saved: PlayerStartupConfig = {
      ...DEFAULT_PLAYER_STARTUP_CONFIG,
      showPath: '/saved/show.pxf',
      showPathKind: 'project',
      headless: true,
      autoOutput: true
    }
    const plan = resolveStartupPlan({ cli: emptyCli, saved })
    assert.equal(plan.headless, true)
    assert.equal(plan.autoOutput, true)
  })

  it('defaults to windowed with output off when nothing configured', () => {
    const plan = resolveStartupPlan({ cli: emptyCli, saved: { ...DEFAULT_PLAYER_STARTUP_CONFIG } })
    assert.equal(plan.headless, false)
    assert.equal(plan.autoOutput, false)
    assert.equal(plan.projectPath, null)
  })

  it('applies show hints when saved has no values', () => {
    const saved = { ...DEFAULT_PLAYER_STARTUP_CONFIG }
    const cli = parsePlayerArgs(['--show-dir', '/bundle'])
    const plan = resolveStartupPlan({
      cli,
      saved,
      showHints: { interface: '192.168.1.5', autoOutput: true, headless: true }
    })
    assert.equal(plan.interface, '192.168.1.5')
    assert.equal(plan.autoOutput, true)
    assert.equal(plan.headless, true)
  })
})

describe('isStartupConfigReadyForLogin', () => {
  it('requires show path and explicit headless choice', () => {
    assert.equal(isStartupConfigReadyForLogin(DEFAULT_PLAYER_STARTUP_CONFIG), false)
    assert.equal(
      isStartupConfigReadyForLogin({
        ...DEFAULT_PLAYER_STARTUP_CONFIG,
        showPath: '/show.pxf',
        headless: null
      }),
      false
    )
    assert.equal(
      isStartupConfigReadyForLogin({
        ...DEFAULT_PLAYER_STARTUP_CONFIG,
        showPath: '/show.pxf',
        headless: true
      }),
      true
    )
  })
})
