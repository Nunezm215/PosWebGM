import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const state = vi.hoisted(() => ({ user: { rol: 'Admin' }, listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), desactivar: vi.fn(), navigate: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('../../api/client', () => ({ api: { usuarios: { listar: state.listar, crear: state.crear, actualizar: state.actualizar, desactivar: state.desactivar } } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('../../context/NotificationContext', () => ({ useNotification: () => ({ notifyError: state.notifyError, notifySuccess: state.notifySuccess }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }))
vi.mock('../../components/ui/Dialog', () => ({ default: ({ open, title, children, footer }: { open: boolean; title: string; children: React.ReactNode; footer: React.ReactNode }) => open ? <div role="dialog" aria-label={title}><h2>{title}</h2>{children}{footer}</div> : null }))

const usuarios = [{ id: 1, nombreUsuario: 'admin', mail: 'admin@test.com', rol: 'Admin', activo: true, pinConfigurado: true, suscripcionActiva: true, accesoHabilitado: true }]
describe('AltaUsuarioPage', () => {
  beforeEach(() => { state.user = { rol: 'Admin' }; state.listar.mockReset().mockResolvedValue(usuarios); state.crear.mockReset().mockResolvedValue({}); state.actualizar.mockReset().mockResolvedValue({}); state.desactivar.mockReset().mockResolvedValue({}); state.navigate.mockReset(); state.notifyError.mockReset(); state.notifySuccess.mockReset(); vi.stubGlobal('confirm', vi.fn().mockReturnValue(true)) })
  async function renderPage() { const { default: Page } = await import('../AltaUsuarioPage'); return render(<Page />) }
  it('Admin lista usuarios y abre el modal de creación', async () => { await renderPage(); expect(await screen.findByText('admin')).toBeInTheDocument(); fireEvent.click(screen.getByText('Crear usuario')); expect(screen.getByRole('dialog', { name: 'Crear usuario' })).toBeInTheDocument() })
  it('crea y edita usuarios', async () => { await renderPage(); fireEvent.click(await screen.findByText('Crear usuario')); const dialog = screen.getByRole('dialog', { name: 'Crear usuario' }); const inputs = within(dialog).getAllByRole('textbox'); fireEvent.change(inputs[0], { target: { value: 'nuevo' } }); fireEvent.change(within(dialog).getByLabelText('Contraseña'), { target: { value: '123456' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Crear usuario' })); await waitFor(() => expect(state.crear).toHaveBeenCalled()); fireEvent.click(screen.getByText('Editar')); fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' })); await waitFor(() => expect(state.actualizar).toHaveBeenCalledWith(1, expect.anything())) })
  it('UsuarioComun es redirigido', async () => { state.user = { rol: 'UsuarioComun' }; await renderPage(); await waitFor(() => expect(state.navigate).toHaveBeenCalledWith('/ventas', { replace: true })) })
})
