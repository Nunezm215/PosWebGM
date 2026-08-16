import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiState = vi.hoisted(() => ({
  proximosCumpleanios: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  api: {
    clientes: {
      proximosCumpleanios: apiState.proximosCumpleanios,
    },
  },
}))

import OportunidadesPage from '../OportunidadesPage'

const proximoCumpleanios = (personaId: number, nombrePersona: string, diasFaltantes: number, tipoPersona = 'Cliente', telefonoCliente: string | null = '5491112345678') => ({
  personaId,
  tipoPersona,
  nombrePersona,
  fechaNacimiento: '1990-01-01',
  proximoCumpleanios: '2026-11-14',
  diasFaltantes,
  clienteId: tipoPersona === 'Familiar' ? 99 : personaId,
  nombreCliente: tipoPersona === 'Familiar' ? 'Juan Pérez' : nombrePersona,
  telefonoCliente,
})

describe('OportunidadesPage', () => {
  beforeEach(() => {
    apiState.proximosCumpleanios.mockReset()
    apiState.proximosCumpleanios.mockResolvedValue([])
  })

  it('renders the page and loads birthday opportunities once', async () => {
    apiState.proximosCumpleanios.mockReturnValue(new Promise(() => {}))

    render(<OportunidadesPage />)

    expect(screen.getByRole('heading', { name: 'Oportunidades' })).toBeInTheDocument()
    expect(screen.getByText('Cargando oportunidades...')).toBeInTheDocument()
    await waitFor(() => expect(apiState.proximosCumpleanios).toHaveBeenCalledWith(90))
    expect(apiState.proximosCumpleanios).toHaveBeenCalledTimes(1)
  })

  it('renders client and family opportunities with the correct WhatsApp recipient and promotion', async () => {
    apiState.proximosCumpleanios.mockResolvedValue([
      proximoCumpleanios(1, 'Ana Cliente', 0, 'Cliente', '+54 9 (11) 1234-5678'),
      proximoCumpleanios(2, 'Sofía Familiar', 1, 'Familiar'),
      proximoCumpleanios(3, 'Pedro Cliente', 12),
    ])
    const user = userEvent.setup()

    render(<OportunidadesPage />)

    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument()
    expect(within(screen.getByTestId('cumpleanios-1')).queryByText(/Familiar de:/)).not.toBeInTheDocument()
    expect(within(screen.getByTestId('cumpleanios-2')).getByText('Familiar de: Juan Pérez')).toBeInTheDocument()
    expect(within(screen.getByTestId('cumpleanios-1')).getByText('Cumple: 14/11/2026')).toBeInTheDocument()
    expect(screen.getByText('Cumple hoy')).toBeInTheDocument()
    expect(screen.getByText('Cumple mañana')).toBeInTheDocument()
    expect(screen.getByText('Faltan 12 días')).toBeInTheDocument()
    expect(screen.queryByText('5491112345678')).not.toBeInTheDocument()

    const clienteWhatsapp = within(screen.getByTestId('cumpleanios-1')).getByRole('link', { name: 'Enviar promoción por WhatsApp a Ana Cliente' })
    const familiarWhatsapp = within(screen.getByTestId('cumpleanios-2')).getByRole('link', { name: 'Enviar promoción por WhatsApp a Juan Pérez por el cumpleaños de Sofía Familiar' })
    const clienteUrl = new URL(clienteWhatsapp.getAttribute('href')!)
    const familiarUrl = new URL(familiarWhatsapp.getAttribute('href')!)

    expect(clienteWhatsapp).toHaveTextContent('WhatsApp')
    expect(clienteWhatsapp).toHaveAttribute('target', '_blank')
    expect(clienteWhatsapp).toHaveAttribute('rel', 'noopener noreferrer')
    expect(clienteUrl.origin).toBe('https://wa.me')
    expect(clienteUrl.pathname).toBe('/5491112345678')
    expect(clienteUrl.searchParams.get('text')).toBe('🎉 ¡Hola, Ana Cliente! Se acerca tu cumpleaños 🎂\n\nQueremos ofrecerte un 10% de descuento reservando tu evento con nosotros.\n\nPara aprovechar la promoción, respondé este mensaje y coordinamos tu fecha.')
    expect(familiarUrl.pathname).toBe('/5491112345678')
    expect(familiarUrl.searchParams.get('text')).toBe('🎉 ¡Hola, Juan Pérez! Se acerca el cumpleaños de Sofía Familiar 🎂\n\nQueremos ofrecerte un 10% de descuento reservando su evento con nosotros.\n\nPara aprovechar la promoción, respondé este mensaje y coordinamos la fecha.')
    expect(clienteWhatsapp.getAttribute('href')).toContain('%C3%A9')

    await user.click(clienteWhatsapp)
    expect(screen.getByTestId('cumpleanios-1')).toBeInTheDocument()
    expect(apiState.proximosCumpleanios).toHaveBeenCalledTimes(1)
  })

  it('keeps opportunities visible and disables WhatsApp when the phone has no valid digits', async () => {
    apiState.proximosCumpleanios.mockResolvedValue([
      proximoCumpleanios(1, 'Sin Teléfono', 0, 'Cliente', null),
      proximoCumpleanios(2, 'Familiar Sin Teléfono', 1, 'Familiar', ' + - () '),
    ])

    render(<OportunidadesPage />)

    expect(await screen.findByText('Sin Teléfono')).toBeInTheDocument()
    expect(within(screen.getByTestId('cumpleanios-1')).getByRole('button', { name: 'WhatsApp no disponible para Sin Teléfono' })).toBeDisabled()
    expect(within(screen.getByTestId('cumpleanios-2')).getByRole('button', { name: 'WhatsApp no disponible para Juan Pérez' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
  })

  it('preserves backend order, initially limits results, and expands locally', async () => {
    apiState.proximosCumpleanios.mockResolvedValue([
      proximoCumpleanios(1, 'Primero', 0),
      proximoCumpleanios(2, 'Segundo', 1),
      proximoCumpleanios(3, 'Tercero', 2),
      proximoCumpleanios(4, 'Cuarto', 3),
      proximoCumpleanios(5, 'Quinto', 4),
      proximoCumpleanios(6, 'Sexto', 5),
    ])
    const user = userEvent.setup()

    render(<OportunidadesPage />)
    await screen.findByText('Primero')

    expect(screen.getAllByTestId(/^cumpleanios-/).map(card => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto',
    ])
    expect(screen.queryByText('Sexto')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver todos (6)' }))
    expect(screen.getAllByTestId(/^cumpleanios-/)).toHaveLength(6)
    expect(within(screen.getByTestId('cumpleanios-6')).getByText('WhatsApp')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mostrar menos' }))
    expect(screen.getAllByTestId(/^cumpleanios-/)).toHaveLength(5)
  })

  it('shows a dedicated empty state', async () => {
    render(<OportunidadesPage />)

    expect(await screen.findByText('No hay oportunidades de cumpleaños en los próximos 90 días.')).toBeInTheDocument()
  })

  it('shows a discrete error when the request fails', async () => {
    apiState.proximosCumpleanios.mockRejectedValue(new Error('fallo'))

    render(<OportunidadesPage />)

    expect(await screen.findByText('No se pudieron cargar las oportunidades.')).toBeInTheDocument()
  })
})
