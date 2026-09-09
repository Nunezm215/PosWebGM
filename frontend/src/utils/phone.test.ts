import { describe, expect, it } from 'vitest'
import { buildArgentinaPhone, buildTelHref, buildWhatsAppHref, getArgentinaPhoneLocalDigits, getArgentinaPhoneLocalError, getArgentinaPhoneLocalLabel, getArgentinaPhoneLocalPlaceholder, limitArgentinaPhoneLocalDigits, parseArgentinaPhone } from './phone'

describe('phone helpers', () => {
  it('parses recognized argentina numbers', () => {
    expect(parseArgentinaPhone('5491112345678')).toEqual({ code: '54911', local: '12345678', recognized: true })
  })

  it('preserves unrecognized historical numbers as custom', () => {
    expect(parseArgentinaPhone('541234567890')).toEqual({ code: '54911', local: '541234567890', recognized: false })
  })

  it('builds normalized argentina numbers', () => {
    expect(buildArgentinaPhone('54911', '12345678')).toBe('5491112345678')
  })

  it('builds whatsapp and tel links', () => {
    expect(buildWhatsAppHref('5491112345678')).toBe('https://wa.me/5491112345678')
    expect(buildTelHref('5491112345678')).toBe('tel:+5491112345678')
  })

  it('normalizes common argentine whatsapp formats', () => {
    expect(buildWhatsAppHref('11 1234-5678')).toBe('https://wa.me/5491112345678')
    expect(buildWhatsAppHref('01112345678')).toBe('https://wa.me/5491112345678')
    expect(buildWhatsAppHref('+54 9 11 1234-5678')).toBe('https://wa.me/5491112345678')
    expect(buildWhatsAppHref('5491112345678')).toBe('https://wa.me/5491112345678')
  })

  it('returns no whatsapp link for empty or invalid numbers', () => {
    expect(buildWhatsAppHref('')).toBe('')
    expect(buildWhatsAppHref('abc')).toBe('')
  })

  it('derives local digit counts, labels and placeholders', () => {
    expect(getArgentinaPhoneLocalDigits('54911')).toBe(8)
    expect(getArgentinaPhoneLocalDigits('549221')).toBe(7)
    expect(getArgentinaPhoneLocalDigits('549351')).toBe(7)
    expect(getArgentinaPhoneLocalLabel('54911')).toBe('Número (8 dígitos)')
    expect(getArgentinaPhoneLocalPlaceholder('54911')).toBe('12345678')
    expect(getArgentinaPhoneLocalPlaceholder('549221')).toBe('1234567')
    expect(getArgentinaPhoneLocalError('549221')).toBe('El número debe tener 7 dígitos')
  })

  it('limits pasted digits to the expected local length', () => {
    expect(limitArgentinaPhoneLocalDigits('54911', '12 34-567890')).toBe('12345678')
    expect(limitArgentinaPhoneLocalDigits('549221', '123456789')).toBe('1234567')
  })
})
