import { useEffect, useRef, useCallback, useState } from 'react'
import { api } from '../api/client'
import { useNotification } from '../context/NotificationContext'
import type { ClienteDto, FamiliarClienteDto } from '../types'
import Button from '../components/ui/Button'
import Dialog from '../components/ui/Dialog'
import PageShell from '../components/shared/PageShell'
import EntityToolbar from '../components/shared/EntityToolbar'
import EntityEmptyState from '../components/shared/EntityEmptyState'
import { useEntityList } from '../hooks/useEntityList'
import { useEntitySearch } from '../hooks/useEntitySearch'
import { useEntityForm } from '../hooks/useEntityForm'
import { useEntityPagination } from '../hooks/useEntityPagination'
import { DEFAULT_PHONE_CODE, PHONE_CODE_OPTIONS, buildArgentinaPhone, getArgentinaPhoneLocalDigits, getArgentinaPhoneLocalError, getArgentinaPhoneLocalLabel, getArgentinaPhoneLocalPlaceholder, limitArgentinaPhoneLocalDigits, parseArgentinaPhone, sanitizePhoneDigits } from '../utils/phone'

const TIPOS_DOCUMENTO = ['DNI', 'CUIT', 'CUIL', 'ConsumidorFinal']
const createEmptyFamiliar = (): FamiliarClienteDto => ({
  id: null,
  nombre: '',
  fechaNacimiento: '',
})

const emptyForm: ClienteDto = {
  nombre: '',
  fechaNacimiento: '',
  tipoDocumento: 'DNI',
  numeroDocumento: '',
  ivaCondicion: 'ConsumidorFinal',
  telefono: '',
  mail: '',
  domicilio: '',
  familiares: [],
}

type ClientePhoneForm = {
  code: string
  local: string
  raw: string
  custom: boolean
}

function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function todayLocalDateInputValue() {
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10)
}

function normalizeFamiliars(familiares?: FamiliarClienteDto[] | null): FamiliarClienteDto[] {
  return (familiares ?? []).map((familiar, index) => ({
    id: familiar.id ?? index,
    nombre: familiar.nombre ?? '',
    fechaNacimiento: familiar.fechaNacimiento ?? '',
  }))
}

export default function ClientesPage() {
  const { notifyError } = useNotification()
  const searchRef = useRef<HTMLInputElement>(null!)

  // ── Hooks ──────────────────────────────────────────────────────────
  const list = useEntityList<ClienteDto, { q?: string; page?: number }>({
    fetchFn: async (params) => {
      const result = await api.clientes.listar(params.q || undefined, params.page || 1, 20, true)
      return result
    },
  })

  const search = useEntitySearch()

  const pagination = useEntityPagination(list.totalPages)

  const form = useEntityForm<ClienteDto, ClienteDto>({ emptyForm })
  const [formError, setFormError] = useState('')
  const [familiarErrors, setFamiliarErrors] = useState<Record<number, { nombre?: string; fechaNacimiento?: string }>>({})
  const [telefonoForm, setTelefonoForm] = useState<ClientePhoneForm>({ code: DEFAULT_PHONE_CODE, local: '', raw: '', custom: false })

  useEffect(() => {
    if (!form.showForm) {
      setFormError('')
      setFamiliarErrors({})
      setTelefonoForm({ code: DEFAULT_PHONE_CODE, local: '', raw: '', custom: false })
    }
  }, [form.showForm])

  useEffect(() => {
    if (!form.showForm) return
    const parsed = parseArgentinaPhone(form.form.telefono)
    setTelefonoForm(parsed.recognized
      ? { code: parsed.code, local: parsed.local, raw: '', custom: false }
      : { code: DEFAULT_PHONE_CODE, local: parsed.local, raw: sanitizePhoneDigits(form.form.telefono || ''), custom: true }
    )
  }, [form.showForm, form.form.telefono])

  const updateFamiliares = useCallback((nextFamiliares: FamiliarClienteDto[]) => {
    form.setForm({ ...form.form, familiares: nextFamiliares })
  }, [form])

  const validateFamiliares = useCallback((familiares: FamiliarClienteDto[]) => {
    const today = todayLocalDateInputValue()
    const nextErrors: Record<number, { nombre?: string; fechaNacimiento?: string }> = {}

    for (let index = 0; index < familiares.length; index += 1) {
      const familiar = familiares[index]
      const nombre = familiar.nombre?.trim() || ''
      const fechaNacimiento = toDateInputValue(familiar.fechaNacimiento)
      const errors: { nombre?: string; fechaNacimiento?: string } = {}

      if (!nombre) errors.nombre = 'El nombre del familiar es obligatorio'
      if (!fechaNacimiento) errors.fechaNacimiento = 'La fecha de nacimiento del familiar es obligatoria'
      else if (fechaNacimiento > today) errors.fechaNacimiento = 'La fecha de nacimiento del familiar no puede ser futura'

      if (Object.keys(errors).length > 0) nextErrors[index] = errors
    }

    setFamiliarErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }, [])

  // ── Workflow ───────────────────────────────────────────────────────
  // LOAD on mount, search, or page change
  useEffect(() => {
    list.load({ q: search.debouncedSearch || undefined, page: pagination.page })
  }, [search.debouncedSearch, pagination.page])

  // SAVING → DONE → REFRESH
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const nombre = form.form.nombre.trim()
    const fechaNacimiento = form.form.fechaNacimiento?.slice(0, 10) || ''
    const telefono = telefonoForm.custom
      ? telefonoForm.raw || telefonoForm.local
      : buildArgentinaPhone(telefonoForm.code, telefonoForm.local)
    const expectedTelefonoDigits = getArgentinaPhoneLocalDigits(telefonoForm.code)
    const mail = form.form.mail?.trim() || ''
    const familiares = normalizeFamiliars(form.form.familiares)
    const hoyDate = new Date()
    const hoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')}`

    if (!nombre) { setFormError('El nombre es obligatorio'); return }
    if (!fechaNacimiento) { setFormError('La fecha de nacimiento es obligatoria'); return }
    if (fechaNacimiento > hoy) { setFormError('La fecha de nacimiento no puede ser futura'); return }
    if (!telefono) { setFormError('El celular/teléfono es obligatorio'); return }
    if (!telefonoForm.custom && telefonoForm.local.length !== expectedTelefonoDigits) { setFormError(getArgentinaPhoneLocalError(telefonoForm.code)); return }
    if (!mail) { setFormError('El email es obligatorio'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setFormError('El email no es válido'); return }
    if (!validateFamiliares(familiares)) { setFormError('Revisá los familiares'); return }

    setFormError('')
    form.setSaving(true)
    try {
      const payload: ClienteDto = {
        ...form.form,
        nombre,
        fechaNacimiento,
        telefono,
        mail,
        numeroDocumento: form.form.numeroDocumento?.trim() || null,
        domicilio: form.form.domicilio?.trim() || null,
        ivaCondicion: 'ConsumidorFinal',
        familiares,
      }

      if (form.editingId) {
        await api.clientes.actualizar(form.editingId, payload)
      } else {
        await api.clientes.crear(payload)
      }
      form.closeForm(() => searchRef.current?.focus())
      setFormError('')
      list.load({ q: search.debouncedSearch || undefined, page: pagination.page })
    } catch (err: any) {
      notifyError(err.message || 'Error al guardar cliente')
    } finally {
      form.setSaving(false)
    }
  }, [form, list, search.debouncedSearch, pagination.page, notifyError, validateFamiliares, telefonoForm.code, telefonoForm.local])

  const handleAddFamiliar = () => {
    updateFamiliares([...(form.form.familiares ?? []), createEmptyFamiliar()])
  }

  const handleRemoveFamiliar = (index: number) => {
    const next = (form.form.familiares ?? []).filter((_, i) => i !== index)
    updateFamiliares(next)
    setFamiliarErrors(prev => {
      const nextErrors: Record<number, { nombre?: string; fechaNacimiento?: string }> = {}
      next.forEach((_, idx) => {
        const sourceIndex = idx >= index ? idx + 1 : idx
        if (prev[sourceIndex]) nextErrors[idx] = prev[sourceIndex]
      })
      return nextErrors
    })
  }

  const handleFamiliarChange = (index: number, field: 'nombre' | 'fechaNacimiento', value: string) => {
    const next = [...(form.form.familiares ?? [])]
    next[index] = { ...next[index], [field]: value }
    updateFamiliares(next)
  }

  const handleTelefonoCodeChange = (code: string) => {
    setTelefonoForm(prev => ({ ...prev, code, local: limitArgentinaPhoneLocalDigits(code, prev.local), custom: false }))
  }

  const handleTelefonoLocalChange = (value: string) => {
    setTelefonoForm(prev => ({ ...prev, local: limitArgentinaPhoneLocalDigits(prev.code, value), custom: false }))
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <PageShell
      title="Clientes"
      subtitle={`${list.totalCount} clientes`}
      loading={list.loading && list.data.length === 0}
      error={list.error}
      onErrorClose={list.clearError}
    >
      <EntityToolbar
        search={search.search}
        onSearchChange={v => { search.setSearch(v); pagination.setPage(1) }}
        searchRef={searchRef}
        searchPlaceholder="Buscar por nombre o documento..."
        createLabel="Nuevo cliente"
        onCreate={form.openCreate}
      />

      {list.data.length === 0 ? (
        <EntityEmptyState hasSearch={!!search.debouncedSearch} emptyMessage="No hay clientes" />
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col max-h-[calc(100vh-19rem)] overflow-hidden">
            <div className="overflow-y-auto min-h-0" data-testid="clientes-lista-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 bg-gray-50">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 bg-gray-50">Documento</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 bg-gray-50">Teléfono</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 bg-gray-50">Mail</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 bg-gray-50">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 bg-gray-50">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{c.numeroDocumento?.trim() ? `${c.tipoDocumento} ${c.numeroDocumento}` : 'Sin documento'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.telefono || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.mail || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.activo !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {c.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={async () => {
                          try {
                            const item = await api.clientes.obtener(c.id!)
                            form.openEdit(item, dto => ({
                              ...dto,
                              fechaNacimiento: dto.fechaNacimiento || '',
                              telefono: dto.telefono || '',
                              mail: dto.mail || '',
                              numeroDocumento: dto.numeroDocumento || '',
                              domicilio: dto.domicilio || '',
                              familiares: normalizeFamiliars(dto.familiares),
                            }))
                          } catch (err: any) {
                            notifyError(err.message || 'Error')
                          }
                        }}>Editar</Button>
                        {c.activo !== false ? (
                          <Button variant="ghost" size="sm" onClick={async () => {
                            try { await api.clientes.desactivar(c.id!); list.load({ q: search.debouncedSearch || undefined, page: pagination.page }) }
                            catch (err: any) { notifyError(err.message || 'Error') }
                          }}>Desactivar</Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={async () => {
                            try { await api.clientes.reactivar(c.id!); list.load({ q: search.debouncedSearch || undefined, page: pagination.page }) }
                            catch (err: any) { notifyError(err.message || 'Error') }
                          }}>Reactivar</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>{list.totalCount} cliente(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={pagination.prevPage} disabled={pagination.page <= 1}>Anterior</Button>
                <span className="px-2 text-gray-500">Pág. {pagination.page} / {pagination.totalPages}</span>
                <Button variant="secondary" size="sm" onClick={pagination.nextPage} disabled={pagination.page >= pagination.totalPages}>Siguiente</Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog
        open={form.showForm}
        onClose={() => form.closeForm(() => searchRef.current?.focus())}
        title={form.editingId ? 'Editar cliente' : 'Nuevo cliente'}
        width="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => form.closeForm(() => searchRef.current?.focus())}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={form.saving}>
              {form.saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="cliente-form" onSubmit={handleSubmit} className="space-y-3">
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div>
            <label htmlFor="cliente-nombre" className="text-xs font-semibold text-gray-700">Nombre *</label>
            <input id="cliente-nombre" type="text" value={form.form.nombre} onChange={e => form.setForm({ ...form.form, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" required />
          </div>
          <div>
            <label htmlFor="cliente-fecha-nacimiento" className="text-xs font-semibold text-gray-700">Fecha de nacimiento *</label>
            <input id="cliente-fecha-nacimiento" type="date" value={form.form.fechaNacimiento || ''} onChange={e => form.setForm({ ...form.form, fechaNacimiento: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <label htmlFor="cliente-telefono-codigo" className="text-xs font-semibold text-gray-700">Código</label>
              <select
                id="cliente-telefono-codigo"
                value={telefonoForm.code}
                onChange={e => handleTelefonoCodeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              >
                {PHONE_CODE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cliente-telefono" className="text-xs font-semibold text-gray-700">Celular / Teléfono *</label>
              <p className="mt-1 text-[11px] text-gray-500">{getArgentinaPhoneLocalLabel(telefonoForm.code)}</p>
              <input
                id="cliente-telefono"
                type="tel"
                inputMode="numeric"
                value={telefonoForm.local}
                onChange={e => handleTelefonoLocalChange(e.target.value)}
                placeholder={getArgentinaPhoneLocalPlaceholder(telefonoForm.code)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cliente-mail" className="text-xs font-semibold text-gray-700">Email *</label>
              <input id="cliente-mail" type="email" value={form.form.mail || ''} onChange={e => form.setForm({ ...form.form, mail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cliente-tipo-documento" className="text-xs font-semibold text-gray-700">Tipo documento</label>
              <select id="cliente-tipo-documento" value={form.form.tipoDocumento} onChange={e => form.setForm({ ...form.form, tipoDocumento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cliente-numero-documento" className="text-xs font-semibold text-gray-700">DNI / número de documento</label>
              <input id="cliente-numero-documento" type="text" value={form.form.numeroDocumento || ''} onChange={e => form.setForm({ ...form.form, numeroDocumento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="cliente-domicilio" className="text-xs font-semibold text-gray-700">Domicilio</label>
            <input id="cliente-domicilio" type="text" value={form.form.domicilio || ''} onChange={e => form.setForm({ ...form.form, domicilio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
          </div>
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Familiares (opcional)</p>
                <p className="text-xs text-gray-500">Podés agregar uno, varios o ninguno.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddFamiliar}>Agregar familiar</Button>
            </div>

            {(form.form.familiares ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">Sin familiares cargados.</p>
            ) : (
              <div className="space-y-3">
                {(form.form.familiares ?? []).map((familiar, index) => {
                  const errors = familiarErrors[index] ?? {}
                  const idBase = `familiar-${index}`
                  return (
                    <div key={familiar.id ?? index} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700">Familiar {index + 1}</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveFamiliar(index)}>Eliminar</Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`${idBase}-nombre`} className="text-xs font-semibold text-gray-700">Nombre</label>
                          <input
                            id={`${idBase}-nombre`}
                            type="text"
                            value={familiar.nombre}
                            onChange={e => handleFamiliarChange(index, 'nombre', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          />
                          {errors.nombre && <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>}
                        </div>
                        <div>
                          <label htmlFor={`${idBase}-fecha`} className="text-xs font-semibold text-gray-700">Fecha de nacimiento</label>
                          <input
                            id={`${idBase}-fecha`}
                            type="date"
                            max={todayLocalDateInputValue()}
                            value={toDateInputValue(familiar.fechaNacimiento)}
                            onChange={e => handleFamiliarChange(index, 'fechaNacimiento', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          />
                          {errors.fechaNacimiento && <p className="mt-1 text-xs text-red-600">{errors.fechaNacimiento}</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </form>
      </Dialog>
    </PageShell>
  )
}
