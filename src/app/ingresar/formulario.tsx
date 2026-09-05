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
      <input
        type="email"
        required
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder="tu correo"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        placeholder="tu clave"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {enviando ? 'Entrando' : 'Entrar'}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  )
}
