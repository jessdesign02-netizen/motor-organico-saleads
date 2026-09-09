'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { clienteNavegador } from '@/lib/supabase/client'
import { errorDeEntrada } from '@/lib/auth-errores'

export function PedirEnlace() {
  const parametros = useSearchParams()
  // Se llega aquí rebotado desde /auth/entrada cuando el enlace ya no sirve.
  const vencido = parametros.get('problema') === 'enlace-vencido'
  const [correo, setCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pedir(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)

    try {
      const { error: fallo } = await clienteNavegador().auth.resetPasswordForEmail(correo.trim(), {
        redirectTo: `${window.location.origin}/auth/entrada?destino=/clave-nueva`,
      })
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

    setListo(true)
    setEnviando(false)
  }

  /**
   * Se confirma igual exista o no ese correo. Decir "esa cuenta no existe"
   * convierte el formulario en una forma de averiguar quién tiene cuenta.
   */
  if (listo) {
    return (
      <div className="rounded-silk shadow-alzado bg-arcilla p-5 shadow-alzado">
        <p className="text-sm font-medium text-tinta">Revisa tu correo</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-tinta-2">
          Si <span className="font-medium text-tinta">{correo}</span> tiene cuenta, le acaba de llegar un
          enlace para poner una clave nueva. Vence en una hora.
        </p>
        <p className="mt-3 text-[13px] text-tinta-3">
          ¿No aparece? Mira en el correo no deseado antes de volver a pedirlo.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={pedir} className="space-y-4" noValidate>
      {vencido ? (
        <p role="status" className="rounded-silk bg-arcilla px-3 py-2.5 text-[13px] text-aviso">
          Ese enlace ya venció o se usó. Pide uno nuevo.
        </p>
      ) : null}
      <label className="block">
        <span className="text-[13px] font-medium text-tinta-2">Correo</span>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="tu@saleads.co"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="mt-1.5 w-full rounded-silk shadow-alzado bg-arcilla px-3.5 py-2.5 text-sm text-tinta placeholder:text-tinta-3 focus:shadow-pulsado"
        />
      </label>

      {error ? (
        <p role="alert" className="rounded-silk bg-arcilla px-3 py-2.5 text-[13px] text-critico">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        aria-busy={enviando}
        className="w-full rounded-silk bg-tinta px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primario disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? 'Enviando' : 'Enviar el enlace'}
      </button>
    </form>
  )
}
