import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiState = vi.hoisted(() => ({
  listar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  api: {
    clientes: {
      listar: apiState.listar,
      crear: apiState.crear,
      actualizar: apiState.actualizar,
      desactivar: apiState.desactivar,
    },
  },
}))

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    current: null,
    hasNext: false,
    notifyError: vi.fn(),
    notifySuccess: vi.fn(),
    notifyInfo: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

describe('ClientesPage', () => {
  beforeEach(() => {
    apiState.listar.mockReset()
    apiState.crear.mockReset()
    apiState.actualizar.mockReset()
    apiState.desactivar.mockReset()
    apiState.listar.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 })
    apiState.crear.mockResolvedValue({})
    apiState.actualizar.mockResolvedValue({})
    apiState.desactivar.mockResolvedValue({})
  })

  function renderPage() {
    return import('../../pages/ClientesPage').then(({ default: ClientesPage }) => render(<ClientesPage />))
  }

  async function abrirFormulario(user = userEvent.setup()) {
    await renderPage()
    await screen.findByText('Clientes')
    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }))
    return { user, dialog: await screen.findByRole('dialog', { name: 'Nuevo cliente' }) }
  }

  it('shows the basic form and hides IVA', async () => {
    const { dialog } = await abrirFormulario()

    expect(within(dialog).getByLabelText(/Nombre \*/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Fecha de nacimiento \*/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Celular \/ Teléfono \*/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Email \*/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Tipo documento/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/DNI \/ número de documento/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Domicilio/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Condición IVA/)).not.toBeInTheDocument()
  })

  it('rejects missing name', async () => {
    const { user, dialog } = await abrirFormulario()

    fireEvent.change(within(dialog).getByLabelText(/Fecha de nacimiento/), { target: { value: '1990-01-01' } })
    fireEvent.change(within(dialog).getByLabelText(/Celular \/ Teléfono/), { target: { value: '11111111' } })
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'cliente@correo.com' } })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('rejects missing birth date', async () => {
    const { user, dialog } = await abrirFormulario()

    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'Cliente' } })
    fireEvent.change(within(dialog).getByLabelText(/Celular \/ Teléfono/), { target: { value: '11111111' } })
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'cliente@correo.com' } })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText('La fecha de nacimiento es obligatoria')).toBeInTheDocument()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('rejects future birth dates', async () => {
    const { user, dialog } = await abrirFormulario()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'Cliente' } })
    fireEvent.change(within(dialog).getByLabelText(/Fecha de nacimiento/), { target: { value } })
    fireEvent.change(within(dialog).getByLabelText(/Celular \/ Teléfono/), { target: { value: '11111111' } })
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'cliente@correo.com' } })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText('La fecha de nacimiento no puede ser futura')).toBeInTheDocument()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('rejects missing phone and email and invalid email', async () => {
    const { user, dialog } = await abrirFormulario()

    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'Cliente' } })
    fireEvent.change(within(dialog).getByLabelText(/Fecha de nacimiento/), { target: { value: '1990-01-01' } })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText('El celular/teléfono es obligatorio')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/Celular \/ Teléfono/), { target: { value: '11111111' } })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText('El email es obligatorio')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'mail-invalido' } })
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(await within(dialog).findByText('El email no es válido')).toBeInTheDocument()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('allows optional DNI and domicilio and sends the payload', async () => {
    const { user, dialog } = await abrirFormulario()

    fireEvent.change(within(dialog).getByLabelText(/Nombre/), { target: { value: 'Cliente' } })
    fireEvent.change(within(dialog).getByLabelText(/Fecha de nacimiento/), { target: { value: '1990-01-01' } })
    fireEvent.change(within(dialog).getByLabelText(/Celular \/ Teléfono/), { target: { value: '11111111' } })
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'cliente@correo.com' } })
    fireEvent.change(within(dialog).getByLabelText(/DNI \/ número de documento/), { target: { value: '' } })
    fireEvent.change(within(dialog).getByLabelText(/Domicilio/), { target: { value: '' } })

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(apiState.crear).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Cliente',
      fechaNacimiento: '1990-01-01',
      telefono: '11111111',
      mail: 'cliente@correo.com',
      numeroDocumento: null,
      domicilio: null,
      ivaCondicion: 'ConsumidorFinal',
    })))
  })
})
