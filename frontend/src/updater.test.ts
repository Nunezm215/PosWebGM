import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdaterStatus } from './updater'

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriMocks.invoke,
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: tauriMocks.check,
}))

describe('updater', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    tauriMocks.invoke.mockReset()
    tauriMocks.check.mockReset()
    tauriMocks.downloadAndInstall.mockReset()
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    delete (window as typeof window & { __TAURI__?: unknown }).__TAURI__
  })

  it('does not call invoke in browser mode', async () => {
    const { runUpdateCheck, onUpdaterChange } = await import('./updater')
    let state: { status: UpdaterStatus } = { status: 'idle' }
    onUpdaterChange(next => { state = next })

    await expect(runUpdateCheck('1.0.0')).resolves.toBeUndefined()

    expect(tauriMocks.invoke).not.toHaveBeenCalled()
    expect(tauriMocks.check).not.toHaveBeenCalled()
    expect(state.status).toBe('idle')
  })

  it('keeps updater path available when tauri globals exist', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    })

    tauriMocks.invoke.mockRejectedValue(new Error('sidecar not available'))

    tauriMocks.check.mockResolvedValue({
      version: '2.0.0',
      downloadAndInstall: tauriMocks.downloadAndInstall.mockResolvedValue(undefined),
    })

    const { runUpdateCheck } = await import('./updater')
    await expect(runUpdateCheck('1.0.0')).resolves.toBeUndefined()

    expect(tauriMocks.check).toHaveBeenCalled()
    expect(tauriMocks.invoke).toHaveBeenCalled()
    expect(tauriMocks.downloadAndInstall).toHaveBeenCalled()
  })
})
