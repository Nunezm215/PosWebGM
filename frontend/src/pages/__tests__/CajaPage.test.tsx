import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const state = vi.hoisted(() => ({
  obtener: vi.fn(),
  historial: vi.fn(),
  obtenerPdf: vi.fn(),
  obtenerPdfMensual: vi.fn(),
  crearSimple: vi.fn(),
  obtenerMensual: vi.fn(),
}))

vi.mock('../../api/client', () => ({ api: { cajaDiaria: state, gastos: { crearSimple: state.crearSimple } } }))
vi.mock('../../components/shared', () => ({ PageShell: ({ title, children, error }: { title: string; children: React.ReactNode; error?: string }) => <main><h1>{title}</h1>{error && <p>{error}</p>}{children}</main> }))
vi.mock('../../components/ui/Dialog', () => ({ default: ({ open, title, children, footer }: { open: boolean; title: string; children: React.ReactNode; footer: React.ReactNode }) => open ? <div role="dialog" aria-label={title}><h2>{title}</h2>{children}{footer}</div> : null }))

const caja = {
  fecha: '2026-08-17',
  totalIngresos: 500000,
  totalEgresos: 65000,
  resultado: 435000,
  cantidadEventosRealizados: 1,
  ingresos: [
    {
      fechaRegistro: '2026-08-17T18:00:00',
      nombreCliente: 'Ana',
      tipoEvento: 'Boda',
      medioPago: 'Transferencia',
      monto: 500000,
      tipo: 'Pago de evento',
    },
  ],
  egresos: [
    { fecha: '2026-08-17T19:00:00', detalle: 'Hielo', monto: 65000 },
  ],
  eventosRealizados: [
    { horaInicio: '18:00:00', nombreCliente: 'Ana', tipoEvento: 'Boda', estado: 'Pagado' },
  ],
  desgloseMediosPago: [
    { descripcion: 'Transferencia', total: 500000, cantidadPagos: 1 },
  ],
}

const cajaMensualAgosto = {
  anio: 2026,
  mes: 8,
  desde: '2026-08-01',
  hasta: '2026-08-17',
  totalIngresos: 500000,
  totalEgresos: 65000,
  resultado: 435000,
  eventosRealizados: 1,
  ingresosPorMedio: [
    { medioPagoId: 4, descripcion: 'Transferencia', total: 500000, cantidadPagos: 1 },
  ],
  dias: [
    { fecha: '2026-08-16', totalIngresos: 0, totalEgresos: 0, resultado: 0, cantidadEventosRealizados: 0 },
    { fecha: '2026-08-17', totalIngresos: 500000, totalEgresos: 65000, resultado: 435000, cantidadEventosRealizados: 1 },
  ],
}

const cajaMensualJulio = {
  anio: 2026,
  mes: 7,
  desde: '2026-07-01',
  hasta: '2026-07-31',
  totalIngresos: 350000,
  totalEgresos: 50000,
  resultado: 300000,
  eventosRealizados: 2,
  ingresosPorMedio: [
    { medioPagoId: 1, descripcion: 'Efectivo', total: 100000, cantidadPagos: 1 },
    { medioPagoId: 4, descripcion: 'Transferencia', total: 250000, cantidadPagos: 1 },
  ],
  dias: [
    { fecha: '2026-07-31', totalIngresos: 350000, totalEgresos: 50000, resultado: 300000, cantidadEventosRealizados: 2 },
  ],
}

const cajaMensualVacia = {
  anio: 2026,
  mes: 8,
  desde: '2026-08-01',
  hasta: '2026-08-17',
  totalIngresos: 0,
  totalEgresos: 0,
  resultado: 0,
  eventosRealizados: 0,
  ingresosPorMedio: [],
  dias: [
    { fecha: '2026-08-01', totalIngresos: 0, totalEgresos: 0, resultado: 0, cantidadEventosRealizados: 0 },
  ],
}

describe('CajaPage', () => {
  beforeEach(() => {
    state.obtener.mockReset().mockResolvedValue(caja)
    state.historial.mockReset().mockResolvedValue([{ fecha: '2026-08-16', totalIngresos: 0, totalEgresos: 0, resultado: 0, cantidadEventosRealizados: 0 }])
    state.obtenerPdf.mockReset().mockResolvedValue({ blob: new Blob(['pdf']) })
    state.obtenerPdfMensual.mockReset().mockResolvedValue({ blob: new Blob(['pdf-mensual']) })
    state.crearSimple.mockReset().mockResolvedValue({})
    state.obtenerMensual.mockReset().mockImplementation(async (_anio: number, mes: number) => (mes === 7 ? cajaMensualJulio : cajaMensualAgosto))
    vi.stubGlobal('open', vi.fn().mockReturnValue({ location: { href: '' }, close: vi.fn() }))
    URL.createObjectURL = vi.fn().mockReturnValue('blob:pdf')
    URL.revokeObjectURL = vi.fn()
  })

  async function renderPage() {
    const { default: CajaPage } = await import('../../pages/CajaPage')
    return render(<CajaPage />)
  }

  it('muestra el boton, abre el modal mensual y filtra dias vacios', async () => {
    await renderPage()

    expect(screen.getByText('Ver resumen mensual')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Resumen mensual de Caja' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Ver resumen mensual'))

    const modal = await screen.findByRole('dialog', { name: 'Resumen mensual de Caja' })
    const withinModal = within(modal)

    expect(await withinModal.findByText('Agosto 2026')).toBeInTheDocument()
    expect(withinModal.getByText('01/08/2026 al 17/08/2026')).toBeInTheDocument()
    expect(withinModal.getAllByText(/\$500\.000,00/).length).toBeGreaterThanOrEqual(2)
    expect(withinModal.getAllByText(/\$65\.000,00/).length).toBeGreaterThanOrEqual(2)
    expect(withinModal.getAllByText(/\$435\.000,00/).length).toBeGreaterThanOrEqual(2)
    expect(withinModal.getAllByText('Transferencia').length).toBeGreaterThanOrEqual(2)
    expect(withinModal.getAllByText('17/8/2026').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('16/8/2026')).not.toBeInTheDocument()
  })

  it('cambia el mes y consulta el anio y mes correctos', async () => {
    await renderPage()

    fireEvent.click(screen.getByText('Ver resumen mensual'))
    await screen.findByRole('dialog', { name: 'Resumen mensual de Caja' })

    fireEvent.change(screen.getByLabelText('Mes y año'), { target: { value: '2026-07' } })

    await waitFor(() => expect(state.obtenerMensual).toHaveBeenCalledWith(2026, 7))
    expect(await screen.findByText('Julio 2026')).toBeInTheDocument()
    expect(screen.getByText('01/07/2026 al 31/07/2026')).toBeInTheDocument()
    expect(screen.getAllByText('31/7/2026').length).toBeGreaterThanOrEqual(2)
  })

  it('muestra estado vacio cuando no hay actividad en el mes', async () => {
    state.obtenerMensual.mockResolvedValueOnce(cajaMensualVacia)

    await renderPage()
    fireEvent.click(screen.getByText('Ver resumen mensual'))

    const modal = await screen.findByRole('dialog', { name: 'Resumen mensual de Caja' })
    const withinModal = within(modal)

    expect(await withinModal.findByText('Sin actividad registrada en este mes.')).toBeInTheDocument()
    expect(withinModal.getByText('01/08/2026 al 17/08/2026')).toBeInTheDocument()
    expect(screen.queryByText('16/8/2026')).not.toBeInTheDocument()
  })

  it('no solicita pdf mensual al cargar, abrir modal o cambiar mes', async () => {
    await renderPage()

    expect(state.obtenerPdfMensual).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Ver resumen mensual'))
    await screen.findByRole('dialog', { name: 'Resumen mensual de Caja' })
    expect(state.obtenerPdfMensual).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Mes y año'), { target: { value: '2026-07' } })
    await waitFor(() => expect(state.obtenerMensual).toHaveBeenCalledWith(2026, 7))
    expect(state.obtenerPdfMensual).not.toHaveBeenCalled()
  })

  it('abre el pdf mensual del mes seleccionado usando blob, popup seguro y loading', async () => {
    const popup = { location: { href: '' }, close: vi.fn() }
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const deferred = (() => {
      let resolve!: (value: { blob: Blob }) => void
      const promise = new Promise<{ blob: Blob }>(r => { resolve = r })
      return { promise, resolve }
    })()
    state.obtenerPdfMensual.mockReturnValueOnce(deferred.promise)
    const open = vi.fn().mockReturnValue(popup)
    vi.stubGlobal('open', open)

    await renderPage()
    fireEvent.click(screen.getByText('Ver resumen mensual'))
    await screen.findByRole('dialog', { name: 'Resumen mensual de Caja' })

    fireEvent.click(screen.getByRole('button', { name: 'Abrir PDF mensual' }))

    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(screen.getByRole('button', { name: 'Abriendo PDF...' })).toBeDisabled()
    expect(state.obtenerPdfMensual).toHaveBeenCalledWith(2026, 8)

    deferred.resolve({ blob: new Blob(['pdf-mensual']) })
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
    expect(popup.location.href).toBe('blob:pdf')
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000)
  })

  it('cambia a julio y abre el pdf mensual de julio', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('Ver resumen mensual'))
    await screen.findByRole('dialog', { name: 'Resumen mensual de Caja' })

    fireEvent.change(screen.getByLabelText('Mes y año'), { target: { value: '2026-07' } })
    await waitFor(() => expect(state.obtenerMensual).toHaveBeenCalledWith(2026, 7))

    fireEvent.click(screen.getByRole('button', { name: 'Abrir PDF mensual' }))

    await waitFor(() => expect(state.obtenerPdfMensual).toHaveBeenCalledWith(2026, 7))
  })

  it('cierra la pestaña temporal y conserva el modal ante error del pdf mensual', async () => {
    const popup = { location: { href: '' }, close: vi.fn() }
    vi.stubGlobal('open', vi.fn().mockReturnValue(popup))
    state.obtenerPdfMensual.mockRejectedValueOnce(new Error('PDF mensual falló'))

    await renderPage()
    fireEvent.click(screen.getByText('Ver resumen mensual'))
    await screen.findByRole('dialog', { name: 'Resumen mensual de Caja' })

    fireEvent.click(screen.getByRole('button', { name: 'Abrir PDF mensual' }))

    await waitFor(() => expect(popup.close).toHaveBeenCalled())
    expect(await screen.findByText('PDF mensual falló')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Resumen mensual de Caja' })).toBeInTheDocument()
  })

  it('muestra error del resumen mensual sin romper la caja', async () => {
    state.obtenerMensual.mockRejectedValueOnce(new Error('Mes no disponible'))

    await renderPage()
    fireEvent.click(screen.getByText('Ver resumen mensual'))

    expect(await screen.findByText('Mes no disponible')).toBeInTheDocument()
    expect(screen.getByText('Caja diaria')).toBeInTheDocument()
    expect(screen.getByText('Ver historial')).toBeInTheDocument()
  })

  it('carga resumen y movimientos diarios, y mantiene el historial cerrado hasta solicitarlo', async () => {
    await renderPage()

    expect((await screen.findAllByText('Ingresos')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Hielo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transferencia').length).toBeGreaterThan(0)
    expect(screen.queryByText(/16\/8\/2026/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Ver historial'))

    expect(await screen.findByRole('dialog', { name: 'Historial de Caja' })).toBeInTheDocument()
    expect(screen.getAllByText(/16\/8\/2026/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Abrir caja')).not.toBeInTheDocument()
    expect(screen.queryByText('Cerrar caja')).not.toBeInTheDocument()
  })

  it('consulta el detalle al cambiar fecha', async () => {
    await renderPage()

    fireEvent.change(await screen.findByLabelText('Fecha de caja'), { target: { value: '2026-08-16' } })

    await waitFor(() => expect(state.obtener).toHaveBeenCalledWith('2026-08-16'))
  })

  it('mantiene la fecha previa si el selector nativo intenta limpiarla', async () => {
    await renderPage()

    const input = await screen.findByLabelText('Fecha de caja') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })

    expect(input.value).toBe('2026-08-17')
  })

  it('registra gasto solo con detalle y monto y refresca', async () => {
    await renderPage()

    fireEvent.click(await screen.findByText('Registrar gasto'))
    fireEvent.change(screen.getByLabelText('Detalle gasto'), { target: { value: 'Hielo' } })
    fireEvent.change(screen.getByLabelText('Monto gasto'), { target: { value: '35000' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Registrar gasto' })).getByRole('button', { name: 'Registrar gasto' }))

    await waitFor(() => expect(state.crearSimple).toHaveBeenCalledWith({ detalle: 'Hielo', monto: 35000 }))
    await waitFor(() => expect(state.obtener.mock.calls.length).toBeGreaterThan(1))
  })

  it('muestra un error de carga', async () => {
    state.obtener.mockRejectedValueOnce(new Error('Sin conexión'))

    await renderPage()

    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
  })

  it('solicita y abre el PDF solo al pulsar usando la fecha seleccionada', async () => {
    await renderPage()

    expect(state.obtenerPdf).not.toHaveBeenCalled()
    fireEvent.change(await screen.findByLabelText('Fecha de caja'), { target: { value: '2026-08-16' } })

    await waitFor(() => expect(state.obtener).toHaveBeenCalledWith('2026-08-16'))
    fireEvent.click(screen.getByText('Abrir PDF del día'))

    expect(screen.getByText('Abriendo PDF...')).toBeDisabled()
    await waitFor(() => expect(state.obtenerPdf).toHaveBeenCalledWith('2026-08-16'))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('cierra la pestaña temporal y muestra error al fallar el PDF', async () => {
    const popup = { location: { href: '' }, close: vi.fn() }
    vi.stubGlobal('open', vi.fn().mockReturnValue(popup))
    state.obtenerPdf.mockRejectedValueOnce(new Error('PDF falló'))

    await renderPage()
    fireEvent.click(await screen.findByText('Abrir PDF del día'))

    await waitFor(() => expect(popup.close).toHaveBeenCalled())
    expect(await screen.findByText('PDF falló')).toBeInTheDocument()
  })

  it('selecciona una fecha desde historial y cierra el modal', async () => {
    await renderPage()

    fireEvent.click(await screen.findByText('Ver historial'))
    fireEvent.click((await screen.findAllByText(/16\/8\/2026/))[0])

    await waitFor(() => expect(state.obtener).toHaveBeenCalledWith('2026-08-16'))
    expect(screen.queryByRole('dialog', { name: 'Historial de Caja' })).not.toBeInTheDocument()
  })

  it('permite cerrar manualmente el historial', async () => {
    await renderPage()

    fireEvent.click(await screen.findByText('Ver historial'))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog', { name: 'Historial de Caja' })).not.toBeInTheDocument()
  })
})
