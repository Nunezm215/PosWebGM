export default function InicioPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center select-none">
        <h1 className="text-[clamp(3rem,10vw,7rem)] font-black text-slate-900 tracking-tight leading-none">
          Gestor de Eventos
        </h1>
        <button type="button" onClick={() => window.open('/manual-usuario.pdf', '_blank', 'noopener,noreferrer')} className="mt-6 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600">
          Manual de usuario
        </button>
      </div>
    </div>
  )
}
