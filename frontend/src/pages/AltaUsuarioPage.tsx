import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import type { CrearUsuarioRequest, EditarUsuarioRequest, UsuarioListadoDto } from '../types'
import Dialog from '../components/ui/Dialog'

const roles = ['SuperAdmin', 'Admin', 'UsuarioComun'] as const
const emptyForm = (): CrearUsuarioRequest => ({ usuario: '', password: '', pin: '', mail: '', rol: 'UsuarioComun' })

export default function AltaUsuarioPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notifyError, notifySuccess } = useNotification()
  const [usuarios, setUsuarios] = useState<UsuarioListadoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UsuarioListadoDto | null>(null)
  const [form, setForm] = useState<CrearUsuarioRequest>(emptyForm)

  const autorizado = user?.rol === 'Admin' || user?.rol === 'SuperAdmin'
  const cargar = async () => { setLoading(true); try { setUsuarios(await api.usuarios.listar()) } catch (error) { notifyError(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.') } finally { setLoading(false) } }
  useEffect(() => { if (!autorizado) { navigate('/ventas', { replace: true }); return }; void cargar() }, [autorizado, navigate])
  const cerrar = () => { if (!saving) { setCreating(false); setEditing(null); setForm(emptyForm()) } }
  const abrirCrear = () => { setForm(emptyForm()); setCreating(true) }
  const abrirEditar = (usuario: UsuarioListadoDto) => { setForm({ usuario: usuario.nombreUsuario, password: '', pin: '', mail: usuario.mail ?? '', rol: usuario.rol as CrearUsuarioRequest['rol'] }); setEditing(usuario) }
  const guardar = async () => {
    if (!form.usuario.trim() || (!editing && !form.password)) { notifyError('Usuario y contraseña son requeridos.'); return }
    setSaving(true)
    try {
      if (editing) {
        const request: EditarUsuarioRequest = { ...form, usuario: form.usuario.trim(), password: form.password || undefined, pin: form.pin || undefined }
        await api.usuarios.actualizar(editing.id, request)
        notifySuccess('Usuario actualizado correctamente.')
      } else {
        await api.usuarios.crear({ ...form, usuario: form.usuario.trim(), pin: form.pin || undefined })
        notifySuccess('Usuario creado correctamente.')
      }
      cerrar(); await cargar()
    } catch (error) { notifyError(error instanceof Error ? error.message : 'No se pudo guardar el usuario.') } finally { setSaving(false) }
  }
  const desactivar = async (usuario: UsuarioListadoDto) => {
    if (!window.confirm(`¿Desactivar a ${usuario.nombreUsuario}?`)) return
    try { await api.usuarios.desactivar(usuario.id); notifySuccess('Usuario desactivado correctamente.'); await cargar() } catch (error) { notifyError(error instanceof Error ? error.message : 'No se pudo desactivar el usuario.') }
  }
  if (!autorizado) return null

  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Usuarios</h1><p className="mt-1 text-sm text-slate-500">Administrá accesos, roles y credenciales del equipo.</p></div><button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={abrirCrear}>Crear usuario</button></div><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Usuarios registrados</h2><button className="text-sm font-medium text-indigo-600" onClick={cargar} disabled={loading}>{loading ? 'Actualizando...' : 'Refrescar'}</button></div>{loading ? <p className="text-sm text-slate-500">Cargando usuarios...</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="border-b bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr>{['Usuario', 'Mail', 'Rol', 'Estado', 'PIN', 'Acciones'].map(header => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead><tbody>{usuarios.map(usuario => <tr key={usuario.id} className="border-b border-slate-100"><td className="px-3 py-3 font-medium text-slate-900">{usuario.nombreUsuario}</td><td className="px-3 py-3 text-slate-600">{usuario.mail || '-'}</td><td className="px-3 py-3">{usuario.rol}</td><td className="px-3 py-3">{usuario.activo ? 'Activo' : 'Inactivo'}</td><td className="px-3 py-3 text-slate-600">{usuario.pinConfigurado ? 'Configurado' : 'No configurado'}</td><td className="px-3 py-3"><div className="flex gap-2"><button className="text-indigo-600" onClick={() => abrirEditar(usuario)}>Editar</button>{usuario.activo && <button className="text-red-700" onClick={() => desactivar(usuario)}>Desactivar</button>}</div></td></tr>)}</tbody></table></div>}</section><Dialog open={creating || !!editing} onClose={cerrar} title={editing ? 'Editar usuario' : 'Crear usuario'} width="sm" footer={<><button className="rounded-lg border px-3 py-2" onClick={cerrar} disabled={saving}>Cancelar</button><button className="rounded-lg bg-indigo-600 px-3 py-2 text-white" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}</button></>}><div className="space-y-3"><Field label="Usuario" value={form.usuario} onChange={usuario => setForm({ ...form, usuario })} /><Field label={editing ? 'Contraseña (dejar vacío para conservar)' : 'Contraseña'} type="password" value={form.password} onChange={password => setForm({ ...form, password })} /><Field label={editing ? 'PIN (dejar vacío para conservar)' : 'PIN (opcional)'} type="password" value={form.pin ?? ''} onChange={pin => setForm({ ...form, pin })} /><Field label="Mail" type="email" value={form.mail ?? ''} onChange={mail => setForm({ ...form, mail })} /><label className="block text-sm font-medium text-slate-700">Rol<select className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value as CrearUsuarioRequest['rol'] })}>{roles.map(rol => <option key={rol} value={rol}>{rol}</option>)}</select></label></div></Dialog></div>
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-lg border border-slate-300 p-2" type={type} value={value} onChange={e => onChange(e.target.value)} /></label> }
