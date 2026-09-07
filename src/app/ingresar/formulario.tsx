'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/client'

export function Formulario() {
  const router = useRouter()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)

    const { error: fallo } = await clienteNavegador().auth.signInWithPassword({
      email: correo,
      password: clave,
    })

    if (fallo) {
      setError('El correo o la clave no coinciden')
      setEnviando(false)
      return
    }

    router.push('/parrilla')
    router.refresh()
  }

  return (
    <form onSubmit={entrar} className="mt-8 space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-tinta-2">Correo</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="mt-1 w-full rounded-md border border-linea-fuerte px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-tinta-2">Clave</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="mt-1 w-full rounded-md border border-linea-fuerte px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={enviando}
        aria-busy={enviando}
        className="w-full rounded-md bg-tinta px-3 py-2 text-sm font-medium text-superficie disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? 'Entrando' : 'Entrar'}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-critico">
          {error}
        </p>
      ) : null}
    </form>
  )
}
