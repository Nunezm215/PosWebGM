import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiState = vi.hoisted(() => ({
  proximosCumpleanios: vi.fn(),
  marcarOportunidadCumpleaniosAtendida: vi.fn(),
  oportunidadesCumpleaniosAtendidas: vi.fn(),
  deshacerOportunidadCumpleaniosAtendida: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  api: {
    clientes: {
      proximosCumpleanios: apiState.proximosCumpleanios,
      marcarOportunidadCumpleaniosAtendida: apiState.marcarOportunidadCumpleaniosAtendida,
      oportunidadesCumpleaniosAtendidas: apiState.oportunidadesCumpleaniosAtendidas,
      deshacerOportunidadCumpleaniosAtendida: apiState.deshacerOportunidadCumpleaniosAtendida,
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

const oportunidadAtendida = (personaId: number, nombrePersona: string, tipoPersona = 'Cliente') => ({
  personaId,
  tipoPersona,
  nombrePersona,
  clienteId: tipoPersona === 'Familiar' ? 99 : personaId,
  nombreCliente: tipoPersona === 'Familiar' ? 'Juan Pérez' : nombrePersona,
  telefonoCliente: '5491112345678',
  proximoCumpleanios: '2026-11-14',
  fechaAtendido: '2026-08-16T14:30:00',
})

describe('OportunidadesPage', () => {
  beforeEach(() => {
    apiState.proximosCumpleanios.mockReset()
    apiState.marcarOportunidadCumpleaniosAtendida.mockReset()
    apiState.oportunidadesCumpleaniosAtendidas.mockReset()
    apiState.deshacerOportunidadCumpleaniosAtendida.mockReset()
    apiState.proximosCumpleanios.mockResolvedValue([])
    apiState.marcarOportunidadCumpleaniosAtendida.mockResolvedValue(undefined)
    apiState.oportunidadesCumpleaniosAtendidas.mockResolvedValue([])
    apiState.deshacerOportunidadCumpleaniosAtendida.mockResolvedValue(undefined)
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
    expect(apiState.marcarOportunidadCumpleaniosAtendida).not.toHaveBeenCalled()
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

  it('preserves backend order and renders every opportunity in a scrollable grid', async () => {
    apiState.proximosCumpleanios.mockResolvedValue([
      proximoCumpleanios(1, 'Primero', 0),
      proximoCumpleanios(2, 'Segundo', 1),
      proximoCumpleanios(3, 'Tercero', 2),
      proximoCumpleanios(4, 'Cuarto', 3),
      proximoCumpleanios(5, 'Quinto', 4),
      proximoCumpleanios(6, 'Sexto', 5),
    ])
    render(<OportunidadesPage />)
    await screen.findByText('Primero')

    expect(screen.getAllByTestId(/^cumpleanios-/).map(card => within(card).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto',
    ])
    expect(screen.getAllByTestId(/^cumpleanios-/)).toHaveLength(6)
    expect(within(screen.getByTestId('cumpleanios-6')).getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver todos/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mostrar menos' })).not.toBeInTheDocument()
    expect(screen.getByTestId('lista-oportunidades')).toHaveClass('max-h-[600px]', 'overflow-y-auto')
    expect(screen.getByRole('tab', { name: 'Pendientes (6)' })).toBeInTheDocument()
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

  it('marks client and family opportunities with their exact campaign identity', async () => {
    apiState.proximosCumpleanios.mockResolvedValue([
      proximoCumpleanios(1, 'Ana Cliente', 0, 'Cliente'),
      proximoCumpleanios(2, 'Sofía Familiar', 1, 'Familiar'),
    ])
    const user = userEvent.setup()

    render(<OportunidadesPage />)
    await screen.findByText('Ana Cliente')

    expect(within(screen.getByTestId('cumpleanios-1')).getByRole('button', { name: 'Marcar como atendida la oportunidad de cumpleaños de Ana Cliente' })).toHaveTextContent('Marcar atendido')
    const atenderFamiliar = within(screen.getByTestId('cumpleanios-2')).getByRole('button', { name: 'Marcar como atendida la oportunidad de cumpleaños de Sofía Familiar' })
    await user.click(atenderFamiliar)

    expect(apiState.marcarOportunidadCumpleaniosAtendida).toHaveBeenCalledWith({
      tipoPersona: 'Familiar',
      personaId: 2,
      proximoCumpleanios: '2026-11-14',
    })
    expect(screen.queryByTestId('cumpleanios-2')).not.toBeInTheDocument()
    expect(screen.getByTestId('cumpleanios-1')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pendientes (1)' })).toBeInTheDocument()
  })

  it('disables only the pending card and prevents duplicate requests', async () => {
    let resolveRequest!: () => void
    apiState.marcarOportunidadCumpleaniosAtendida.mockImplementation(() => new Promise<void>(resolve => {
      resolveRequest = resolve
    }))
    apiState.proximosCumpleanios.mockResolvedValue([proximoCumpleanios(1, 'Ana Cliente', 0)])
    const user = userEvent.setup()

    render(<OportunidadesPage />)
    const atender = await screen.findByRole('button', { name: 'Marcar como atendida la oportunidad de cumpleaños de Ana Cliente' })
    await user.dblClick(atender)

    expect(atender).toBeDisabled()
    expect(atender).toHaveTextContent('Marcando...')
    expect(apiState.marcarOportunidadCumpleaniosAtendida).toHaveBeenCalledTimes(1)
    expect(apiState.marcarOportunidadCumpleaniosAtendida).toHaveBeenCalledWith({
      tipoPersona: 'Cliente',
      personaId: 1,
      proximoCumpleanios: '2026-11-14',
    })

    resolveRequest()
    expect(await screen.findByText('No hay oportunidades de cumpleaños en los próximos 90 días.')).toBeInTheDocument()
  })

  it('keeps the card and allows retry when marking attended fails', async () => {
    apiState.proximosCumpleanios.mockResolvedValue([proximoCumpleanios(1, 'Ana Cliente', 0)])
    apiState.marcarOportunidadCumpleaniosAtendida
      .mockRejectedValueOnce(new Error('fallo'))
      .mockResolvedValueOnce(undefined)
    const user = userEvent.setup()

    render(<OportunidadesPage />)
    const atender = await screen.findByRole('button', { name: 'Marcar como atendida la oportunidad de cumpleaños de Ana Cliente' })
    await user.click(atender)

    expect(await screen.findByText('No se pudo marcar como atendido.')).toBeInTheDocument()
    expect(screen.getByTestId('cumpleanios-1')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pendientes (1)' })).toBeInTheDocument()
    expect(atender).not.toBeDisabled()

    await user.click(atender)
    expect(await screen.findByText('No hay oportunidades de cumpleaños en los próximos 90 días.')).toBeInTheDocument()
    expect(apiState.marcarOportunidadCumpleaniosAtendida).toHaveBeenCalledTimes(2)
  })

  it('loads attended opportunities once and renders client and family cards', async () => {
    apiState.oportunidadesCumpleaniosAtendidas.mockResolvedValue([
      oportunidadAtendida(1, 'Ana Cliente'),
      oportunidadAtendida(2, 'Sofía Familiar', 'Familiar'),
    ])
    const user = userEvent.setup()

    render(<OportunidadesPage />)
    expect(screen.getByRole('tab', { name: 'Pendientes (0)' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Atendidas (0)' }))

    expect(await screen.findByText('Ana Cliente')).toBeInTheDocument()
    expect(screen.getByText('Familiar de: Juan Pérez')).toBeInTheDocument()
    expect(screen.getAllByText('Cumple: 14/11/2026')).toHaveLength(2)
    expect(screen.getAllByText('Atendido: 16/08/2026 14:30')).toHaveLength(2)
    expect(screen.getByTestId('lista-atendidas')).toHaveClass('max-h-[600px]', 'overflow-y-auto')
    expect(apiState.oportunidadesCumpleaniosAtendidas).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('tab', { name: 'Pendientes (0)' }))
    await user.click(screen.getByRole('tab', { name: 'Atendidas (2)' }))
    expect(apiState.oportunidadesCumpleaniosAtendidas).toHaveBeenCalledTimes(1)
  })

  it('restores an attended family by reloading pending opportunities from the backend', async () => {
    apiState.proximosCumpleanios
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([proximoCumpleanios(2, 'Sofía Familiar', 1, 'Familiar')])
    apiState.oportunidadesCumpleaniosAtendidas.mockResolvedValue([oportunidadAtendida(2, 'Sofía Familiar', 'Familiar')])
    const user = userEvent.setup()

    render(<OportunidadesPage />)
    await user.click(screen.getByRole('tab', { name: 'Atendidas (0)' }))
    const restaurar = await screen.findByRole('button', { name: 'Volver a pendientes la oportunidad de cumpleaños de Sofía Familiar' })
    await user.click(restaurar)

    expect(apiState.deshacerOportunidadCumpleaniosAtendida).toHaveBeenCalledWith({
      tipoPersona: 'Familiar',
      personaId: 2,
      proximoCumpleanios: '2026-11-14',
    })
    expect(await screen.findByText('No hay oportunidades atendidas.')).toBeInTheDocument()
    expect(apiState.proximosCumpleanios).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('tab', { name: 'Pendientes (1)' }))
    expect(screen.getByTestId('cumpleanios-2')).toBeInTheDocument()
  })

  it('keeps attended cards and allows retry when restoring fails', async () => {
    apiState.oportunidadesCumpleaniosAtendidas.mockResolvedValue([oportunidadAtendida(1, 'Ana Cliente')])
    apiState.deshacerOportunidadCumpleaniosAtendida
      .mockRejectedValueOnce(new Error('fallo'))
      .mockResolvedValueOnce(undefined)
    const user = userEvent.setup()

    render(<OportunidadesPage />)
    await user.click(screen.getByRole('tab', { name: 'Atendidas (0)' }))
    const restaurar = await screen.findByRole('button', { name: 'Volver a pendientes la oportunidad de cumpleaños de Ana Cliente' })
    await user.click(restaurar)

    expect(await screen.findByText('No se pudo volver a pendientes.')).toBeInTheDocument()
    expect(screen.getByTestId('atendida-1')).toBeInTheDocument()
    expect(apiState.deshacerOportunidadCumpleaniosAtendida).toHaveBeenCalledTimes(1)
    await user.click(restaurar)
    expect(await screen.findByText('No hay oportunidades atendidas.')).toBeInTheDocument()
    expect(apiState.deshacerOportunidadCumpleaniosAtendida).toHaveBeenCalledTimes(2)
  })
})
