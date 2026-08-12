import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const apiState = vi.hoisted(() => ({
  listar: vi.fn(),
  obtener: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn(),
  reactivar: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  api: {
    clientes: {
      listar: apiState.listar,
      obtener: apiState.obtener,
      crear: apiState.crear,
      actualizar: apiState.actualizar,
      desactivar: apiState.desactivar,
      reactivar: apiState.reactivar,
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
    apiState.obtener.mockReset()
    apiState.crear.mockReset()
    apiState.actualizar.mockReset()
    apiState.desactivar.mockReset()
    apiState.reactivar.mockReset()
    apiState.listar.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 })
    apiState.obtener.mockResolvedValue({})
    apiState.crear.mockResolvedValue({})
    apiState.actualizar.mockResolvedValue({})
    apiState.desactivar.mockResolvedValue({})
    apiState.reactivar.mockResolvedValue({})
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

  async function cargarFormularioConClienteEditado(cliente: any) {
    apiState.listar.mockResolvedValueOnce({
      items: [cliente],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })
    apiState.obtener.mockResolvedValueOnce(cliente)

    await renderPage()
    await screen.findByText('Clientes')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Editar' }))
    return { dialog: await screen.findByRole('dialog') }
  }

  function completarClienteBase(dialog: HTMLElement) {
    fireEvent.change(within(dialog).getByLabelText(/Nombre \*/), { target: { value: 'Cliente' } })
    fireEvent.change(within(dialog).getByLabelText(/Fecha de nacimiento \*/), { target: { value: '1990-01-01' } })
    fireEvent.change(within(dialog).getByLabelText(/Celular \/ Teléfono \*/), { target: { value: '11111111' } })
    fireEvent.change(within(dialog).getByLabelText(/Email \*/), { target: { value: 'cliente@correo.com' } })
  }

  it('muestra la seccion Familiares y el boton Agregar familiar', async () => {
    const { dialog } = await abrirFormulario()

    expect(within(dialog).getByText('Familiares (opcional)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Agregar familiar' })).toBeInTheDocument()
  })

  it('renderiza el contenedor de lista con scroll', async () => {
    apiState.listar.mockResolvedValueOnce({
      items: [{
        id: 1,
        nombre: 'Cliente',
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        ivaCondicion: 'ConsumidorFinal',
        telefono: '11111111',
        domicilio: 'Calle 123',
        mail: 'cliente@correo.com',
        familiares: [],
        activo: true,
      }],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })

    await renderPage()

    expect(await screen.findByTestId('clientes-lista-scroll')).toHaveClass('overflow-y-auto')
  })

  it('cliente activo muestra Desactivar', async () => {
    apiState.listar.mockResolvedValueOnce({
      items: [{
        id: 1,
        nombre: 'Cliente',
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        ivaCondicion: 'ConsumidorFinal',
        telefono: '11111111',
        domicilio: 'Calle 123',
        mail: 'cliente@correo.com',
        familiares: [],
        activo: true,
      }],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })

    await renderPage()

    expect(await screen.findByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
  })

  it('cliente inactivo muestra Reactivar', async () => {
    apiState.listar.mockResolvedValueOnce({
      items: [{
        id: 1,
        nombre: 'Cliente',
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        ivaCondicion: 'ConsumidorFinal',
        telefono: '11111111',
        domicilio: 'Calle 123',
        mail: 'cliente@correo.com',
        familiares: [],
        activo: false,
      }],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })

    await renderPage()

    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument()
  })

  it('cliente inactivo sigue visible en administracion', async () => {
    apiState.listar.mockResolvedValueOnce({
      items: [{
        id: 1,
        nombre: 'Cliente Inactivo',
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        ivaCondicion: 'ConsumidorFinal',
        telefono: '11111111',
        domicilio: 'Calle 123',
        mail: 'cliente@correo.com',
        familiares: [],
        activo: false,
      }],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })

    await renderPage()

    expect(await screen.findByText('Cliente Inactivo')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument()
  })

  it('reactivar cambia activo y refresca la lista', async () => {
    apiState.listar
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          nombre: 'Cliente',
          fechaNacimiento: '1990-01-01',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          telefono: '11111111',
          domicilio: 'Calle 123',
          mail: 'cliente@correo.com',
          familiares: [{ id: 7, nombre: 'Hijo', fechaNacimiento: '2015-01-01' }],
          activo: false,
        }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          nombre: 'Cliente',
          fechaNacimiento: '1990-01-01',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          telefono: '11111111',
          domicilio: 'Calle 123',
          mail: 'cliente@correo.com',
          familiares: [{ id: 7, nombre: 'Hijo', fechaNacimiento: '2015-01-01' }],
          activo: true,
        }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })

    await renderPage()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Reactivar' }))

    await waitFor(() => expect(apiState.reactivar).toHaveBeenCalledWith(1))
  })

  it('reactivar vuelve a mostrar al cliente como activo', async () => {
    apiState.listar
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          nombre: 'Cliente',
          fechaNacimiento: '1990-01-01',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          telefono: '11111111',
          domicilio: 'Calle 123',
          mail: 'cliente@correo.com',
          familiares: [],
          activo: false,
        }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          nombre: 'Cliente',
          fechaNacimiento: '1990-01-01',
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          ivaCondicion: 'ConsumidorFinal',
          telefono: '11111111',
          domicilio: 'Calle 123',
          mail: 'cliente@correo.com',
          familiares: [],
          activo: true,
        }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })

    await renderPage()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Reactivar' }))

    await waitFor(() => expect(apiState.reactivar).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
  })

  it('desactivar sigue funcionando', async () => {
    apiState.listar.mockResolvedValueOnce({
      items: [{
        id: 1,
        nombre: 'Cliente',
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        ivaCondicion: 'ConsumidorFinal',
        telefono: '11111111',
        domicilio: 'Calle 123',
        mail: 'cliente@correo.com',
        familiares: [{ id: 7, nombre: 'Hijo', fechaNacimiento: '2015-01-01' }],
        activo: true,
      }],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })

    await renderPage()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Desactivar' }))

    await waitFor(() => expect(apiState.desactivar).toHaveBeenCalledWith(1))
  })

  it('familiares no se pierden en el payload de edicion', async () => {
    const cliente = {
      id: 1,
      nombre: 'Cliente',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '11111111',
      domicilio: 'Calle 123',
      mail: 'cliente@correo.com',
      familiares: [{ id: 7, nombre: 'Hijo', fechaNacimiento: '2015-01-01' }],
      activo: false,
    }

    const { dialog } = await cargarFormularioConClienteEditado(cliente)

    expect(within(dialog).getByDisplayValue('Hijo')).toBeInTheDocument()
  })

  it('permite alta de cliente sin familiares', async () => {
    const { user, dialog } = await abrirFormulario()

    completarClienteBase(dialog)

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(apiState.crear).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Cliente',
      fechaNacimiento: '1990-01-01',
      telefono: '11111111',
      mail: 'cliente@correo.com',
      familiares: [],
    })))
  })

  it('permite agregar un familiar', async () => {
    const { user, dialog } = await abrirFormulario()

    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))

    expect(within(dialog).getByLabelText('Nombre')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Fecha de nacimiento')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('permite agregar varios familiares', async () => {
    const { user, dialog } = await abrirFormulario()

    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))

    expect(within(dialog).getAllByLabelText('Nombre')).toHaveLength(2)
    expect(within(dialog).getAllByLabelText('Fecha de nacimiento')).toHaveLength(2)
  })

  it('eliminar familiar nuevo quita la fila', async () => {
    const { user, dialog } = await abrirFormulario()

    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    expect(within(dialog).queryByLabelText('Nombre')).not.toBeInTheDocument()
  })

  it('bloquea guardar si el nombre del familiar esta vacio', async () => {
    const { user, dialog } = await abrirFormulario()

    completarClienteBase(dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: '   ' } })
    fireEvent.change(within(dialog).getByLabelText('Fecha de nacimiento'), { target: { value: '2015-01-01' } })

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText('El nombre del familiar es obligatorio')).toBeInTheDocument()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('bloquea guardar si la fecha del familiar esta vacia', async () => {
    const { user, dialog } = await abrirFormulario()

    completarClienteBase(dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Juan' } })

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText('La fecha de nacimiento del familiar es obligatoria')).toBeInTheDocument()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('bloquea guardar si la fecha del familiar es futura', async () => {
    const { user, dialog } = await abrirFormulario()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    completarClienteBase(dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Juan' } })
    fireEvent.change(within(dialog).getByLabelText('Fecha de nacimiento'), { target: { value } })

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialog).findByText('La fecha de nacimiento del familiar no puede ser futura')).toBeInTheDocument()
    expect(apiState.crear).not.toHaveBeenCalled()
  })

  it('el input fecha del familiar tiene max hoy', async () => {
    const { user, dialog } = await abrirFormulario()

    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    const input = within(dialog).getByLabelText('Fecha de nacimiento') as HTMLInputElement
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    expect(input.max).toBe(expected)
  })

  it('envia payload con un familiar', async () => {
    const { user, dialog } = await abrirFormulario()

    completarClienteBase(dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Juan' } })
    fireEvent.change(within(dialog).getByLabelText('Fecha de nacimiento'), { target: { value: '2015-01-01' } })

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(apiState.crear).toHaveBeenCalledWith(expect.objectContaining({
      familiares: [expect.objectContaining({
        id: 0,
        nombre: 'Juan',
        fechaNacimiento: '2015-01-01',
      })],
    })))
  })

  it('envia payload con varios familiares', async () => {
    const { user, dialog } = await abrirFormulario()

    completarClienteBase(dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    await user.click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))
    const nombres = within(dialog).getAllByLabelText('Nombre') as HTMLInputElement[]
    const fechas = within(dialog).getAllByLabelText('Fecha de nacimiento') as HTMLInputElement[]
    fireEvent.change(nombres[0], { target: { value: 'Juan' } })
    fireEvent.change(fechas[0], { target: { value: '2015-01-01' } })
    fireEvent.change(nombres[1], { target: { value: 'Ana' } })
    fireEvent.change(fechas[1], { target: { value: '2016-02-02' } })

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(apiState.crear).toHaveBeenCalledWith(expect.objectContaining({
      familiares: [
        expect.objectContaining({ nombre: 'Juan', fechaNacimiento: '2015-01-01' }),
        expect.objectContaining({ nombre: 'Ana', fechaNacimiento: '2016-02-02' }),
      ],
    })))
  })

  it('carga familiares existentes en edicion', async () => {
    const cliente = {
      id: 1,
      nombre: 'Cliente',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '11111111',
      domicilio: 'Calle 123',
      mail: 'cliente@correo.com',
      familiares: [
        { id: 10, nombre: 'Juan', fechaNacimiento: '2015-01-01' },
      ],
      activo: true,
    }

    const { dialog } = await cargarFormularioConClienteEditado(cliente)

    expect(within(dialog).getByDisplayValue('Juan')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('2015-01-01')).toBeInTheDocument()
  })

  it('permite editar un familiar existente', async () => {
    const cliente = {
      id: 1,
      nombre: 'Cliente',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '11111111',
      domicilio: 'Calle 123',
      mail: 'cliente@correo.com',
      familiares: [
        { id: 10, nombre: 'Juan', fechaNacimiento: '2015-01-01' },
      ],
      activo: true,
    }

    const { dialog } = await cargarFormularioConClienteEditado(cliente)
    fireEvent.change(within(dialog).getByDisplayValue('Juan'), { target: { value: 'Juan Editado' } })

    expect(within(dialog).getByDisplayValue('Juan Editado')).toBeInTheDocument()
  })

  it('permite agregar familiar en edicion', async () => {
    const cliente = {
      id: 1,
      nombre: 'Cliente',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '11111111',
      domicilio: 'Calle 123',
      mail: 'cliente@correo.com',
      familiares: [],
      activo: true,
    }

    const { dialog } = await cargarFormularioConClienteEditado(cliente)
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Agregar familiar' }))

    expect(within(dialog).getAllByLabelText('Nombre')).toHaveLength(1)
  })

  it('permite eliminar familiar en edicion y omitirlo del payload', async () => {
    const cliente = {
      id: 1,
      nombre: 'Cliente',
      fechaNacimiento: '1990-01-01',
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      ivaCondicion: 'ConsumidorFinal',
      telefono: '11111111',
      domicilio: 'Calle 123',
      mail: 'cliente@correo.com',
      familiares: [
        { id: 10, nombre: 'Juan', fechaNacimiento: '2015-01-01' },
      ],
      activo: true,
    }

    const { dialog } = await cargarFormularioConClienteEditado(cliente)
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    expect(within(dialog).queryByDisplayValue('Juan')).not.toBeInTheDocument()
  })

  it('labels asociados correctamente', async () => {
    const { dialog } = await abrirFormulario()

    expect(within(dialog).getByLabelText(/Nombre \*/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Fecha de nacimiento \*/)).toBeInTheDocument()
  })
})
