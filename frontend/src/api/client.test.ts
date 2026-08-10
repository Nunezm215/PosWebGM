import { afterEach, expect, test, vi } from 'vitest'
import { resolveApiBaseUrl } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('resolveApiBaseUrl uses relative api path in web mode', () => {
  expect(resolveApiBaseUrl()).toBe('/api')
})

test('resolveApiBaseUrl uses localhost in tauri mode', () => {
  vi.stubGlobal('__TAURI__', {})
  expect(resolveApiBaseUrl()).toBe('http://localhost:5196/api')
})
