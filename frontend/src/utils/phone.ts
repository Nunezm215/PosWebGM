export type ArgentinaPhoneCode = {
  value: string
  label: string
}

export const PHONE_CODE_OPTIONS: ArgentinaPhoneCode[] = [
  { value: '54911', label: '+54 9 11' },
  { value: '549221', label: '+54 9 221' },
  { value: '549223', label: '+54 9 223' },
  { value: '549261', label: '+54 9 261' },
  { value: '549264', label: '+54 9 264' },
  { value: '549299', label: '+54 9 299' },
  { value: '549341', label: '+54 9 341' },
  { value: '549342', label: '+54 9 342' },
  { value: '549343', label: '+54 9 343' },
  { value: '549351', label: '+54 9 351' },
  { value: '549362', label: '+54 9 362' },
  { value: '549376', label: '+54 9 376' },
  { value: '549379', label: '+54 9 379' },
  { value: '549381', label: '+54 9 381' },
  { value: '549387', label: '+54 9 387' },
  { value: '549388', label: '+54 9 388' },
]

export const DEFAULT_PHONE_CODE = PHONE_CODE_OPTIONS[0].value

const KNOWN_PHONE_CODES = [...PHONE_CODE_OPTIONS.map(option => option.value)].sort((a, b) => b.length - a.length)
const KNOWN_AREAS = PHONE_CODE_OPTIONS.map(option => option.value.slice(3)).sort((a, b) => b.length - a.length)
const DEFAULT_PHONE_LOCAL_DIGITS = 7

export function sanitizePhoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function getArgentinaPhoneLocalDigits(code: string) {
  return code === DEFAULT_PHONE_CODE ? 8 : DEFAULT_PHONE_LOCAL_DIGITS
}

export function getArgentinaPhoneLocalPlaceholder(code: string) {
  return '12345678'.slice(0, getArgentinaPhoneLocalDigits(code))
}

export function getArgentinaPhoneLocalLabel(code: string) {
  return `Número (${getArgentinaPhoneLocalDigits(code)} dígitos)`
}

export function getArgentinaPhoneLocalError(code: string) {
  return `El número debe tener ${getArgentinaPhoneLocalDigits(code)} dígitos`
}

export function limitArgentinaPhoneLocalDigits(code: string, value: string) {
  return sanitizePhoneDigits(value).slice(0, getArgentinaPhoneLocalDigits(code))
}

export function parseArgentinaPhone(value?: string | null) {
  const digits = sanitizePhoneDigits(value ?? '')
  if (!digits) {
    return { code: DEFAULT_PHONE_CODE, local: '', recognized: false }
  }

  for (const code of KNOWN_PHONE_CODES) {
    if (digits.startsWith(code)) {
      return { code, local: digits.slice(code.length), recognized: true }
    }
  }

  const candidates = [digits, digits.startsWith('54') ? digits.slice(2) : digits, digits.startsWith('549') ? digits.slice(3) : digits]
  for (const candidate of candidates) {
    for (const area of KNOWN_AREAS) {
      if (candidate.startsWith(area) && candidate.length > area.length) {
        return { code: `549${area}`, local: candidate.slice(area.length), recognized: true }
      }
    }
  }

  return { code: DEFAULT_PHONE_CODE, local: digits, recognized: false }
}

export function buildArgentinaPhone(code: string, local: string) {
  const localDigits = sanitizePhoneDigits(local)
  if (!localDigits) return ''
  if (localDigits.startsWith(code)) return localDigits
  return `${code}${localDigits}`
}

export function buildTelHref(phone: string) {
  const digits = sanitizePhoneDigits(phone)
  return digits ? `tel:+${digits}` : ''
}

function normalizeArgentinaWhatsAppDigits(phone: string) {
  const digits = sanitizePhoneDigits(phone).replace(/^0+/, '')
  if (!digits) return ''

  const parsed = parseArgentinaPhone(digits)
  if (parsed.recognized && parsed.local.length === getArgentinaPhoneLocalDigits(parsed.code)) {
    return buildArgentinaPhone(parsed.code, parsed.local)
  }

  return ''
}

export function buildWhatsAppHref(phone: string) {
  const digits = normalizeArgentinaWhatsAppDigits(phone)
  return digits ? `https://wa.me/${digits}` : ''
}
