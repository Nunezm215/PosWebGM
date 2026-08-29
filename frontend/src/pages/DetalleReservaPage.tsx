import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CircleAlert, FileText, Loader2 } from 'lucide-react'
import { api } from '../api/client'

export default function DetalleReservaPage() {
  const { token = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')

  useEffect(() => {
    let active = true

    if (!token) {
      setLoading(false)
      setError('El enlace no es válido.')
      return () => { active = false }
    }

    setLoading(true)
    setError('')
    setPdfUrl('')

    api.eventos.obtenerDetalleCompartidoPdf(token)
      .then(result => {
        if (!active) return
        const url = URL.createObjectURL(result.blob)
        setPdfUrl(url)
      })
      .catch(() => {
        if (!active) return
        setError('El enlace no es válido o venció.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="flex items-center gap-3 rounded-3xl border border-white bg-white px-4 py-3 shadow-sm">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-600 text-white">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Gestor Multieventos</p>
            <h1 className="text-xl font-bold text-slate-950">Detalle de reserva</h1>
          </div>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-600">Cargando detalle...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{error}</p>
                <p className="mt-1 text-sm text-red-700">Pedí un nuevo enlace si es necesario.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <iframe title="Detalle de reserva" src={pdfUrl} className="h-[82vh] w-full" />
          </div>
        )}
      </div>
    </div>
  )
}
