'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/client'
import { errorDeEntrada } from '@/lib/auth-errores'

/** Supabase rechaza por debajo de seis; se dice antes de gastar un viaje. */
const MINIMO = 6

export function ClaveNueva() {
  const router = useRouter()
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const corta = clave.length > 0 && clave.length < MINIMO

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault()
    if (corta) return
    setEnviando(true)
    setError(null)

    try {
      const { error: fallo } = await clienteNavegador().auth.updateUser({ password: clave })
      if (fallo) {
        setError(errorDeEntrada(fallo))
        setEnviando(false)
        return
      }
    } catch (e) {
      setError(errorDeEntrada({ message: e instanceof Error ? e.message : 'network' }))
      setEnviando(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={guardar} className="space-y-4" noValidate>
      <label className="block">
        <span className="text-[13px] font-medium text-tinta-2">Clave nueva</span>
        <span className="relative mt-1.5 block">
          <input
            type={ver ? 'text' : 'password'}
            required
            autoFocus
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            aria-describedby="pista-clave"
            className="w-full rounded-lg border border-linea-fuerte bg-superficie px-3.5 py-2.5 pr-16 text-sm text-tinta focus:border-acento-1"
          />
          <button
            type="button"
            onClick={() => setVer(!ver)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-tinta-3 hover:text-tinta"
          >
            {ver ? 'Ocultar' : 'Ver'}
          </button>
        </span>
        <span
          id="pista-clave"
          className={`mt-1.5 block text-xs ${corta ? 'text-critico' : 'text-tinta-3'}`}
        >
          {corta ? `Le faltan ${MINIMO - clave.length} caracteres` : `Mínimo ${MINIMO} caracteres`}
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-lg bg-critico-tinte px-3 py-2.5 text-[13px] text-critico">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando || clave.length < MINIMO}
        aria-busy={enviando}
        className="w-full rounded-lg bg-tinta px-4 py-2.5 text-sm font-semibold text-superficie transition-colors hover:bg-acento-1 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? 'Guardando' : 'Guardar y entrar'}
      </button>
    </form>
  )
}
