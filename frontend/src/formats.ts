export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function parseIsoLikeDate(value: string): Date {
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

export function formatDateInput(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function formatCurrency(n: number | undefined | null): string {
  const val = n ?? 0
  return '$' + val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatTime(iso: string): string {
  return parseIsoLikeDate(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: ARGENTINA_TIME_ZONE })
}

export function formatDate(iso: string): string {
  const d = parseIsoLikeDate(iso)
  if (DATE_ONLY_RE.test(iso)) {
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ARGENTINA_TIME_ZONE,
  })
}

export function formatDateTime(iso: string): string {
  return parseIsoLikeDate(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ARGENTINA_TIME_ZONE,
  })
}
