'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clienteNavegador } from '@/lib/supabase/client'
import { destinoTrasEntrar, errorDeEntrada } from '@/lib/auth-errores'

export function Formulario() {
  const router = useRouter()
  const parametros = useSearchParams()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [conGoogle, setConGoogle] = useState(false)

  // Lo que trae la URL: de dónde viene la persona y por qué. Sin esto, salir de
  // la sesión y que se caiga sola se veían exactamente igual.
  const salio = parametros.get('salio') === '1'
  const problema = parametros.get('problema')
  const volviaA = parametros.get('volver')

  const nota = problema === 'sin-invitacion'
    ? 'Ese correo no está en la lista. Pídele a una editora que te invite desde Configuración.'
    : problema === 'enlace-incompleto'
    ? 'Ese enlace llegó incompleto. Pide uno nuevo desde "La olvidé".'
    : salio
      ? 'Cerraste la sesión.'
      : volviaA
        ? 'Entra para seguir donde estabas.'
        : null

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)

    let fallo
    try {
      ;({ error: fallo } = await clienteNavegador().auth.signInWithPassword({
        email: correo.trim(),
        password: clave,
      }))
    } catch (e) {
      // Sin red el cliente lanza antes de contestar, y eso también hay que decirlo.
      fallo = { message: e instanceof Error ? e.message : 'network' }
    }

    if (fallo) {
      setError(errorDeEntrada(fallo))
      setEnviando(false)
      return
    }

    // El proxy guardó aquí la ruta que se intentaba abrir. Antes se descartaba
    // y todo el mundo aterrizaba en la parrilla.
    router.push(destinoTrasEntrar(parametros.get('volver')))
    router.refresh()
  }

  async function entrarConGoogle() {
    setConGoogle(true)
    setError(null)
    const destino = destinoTrasEntrar(parametros.get('volver'))
    const { error: fallo } = await clienteNavegador().auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Vuelve a la misma ruta que canjea el código del correo: el flujo es
        // el mismo, PKCE, y así solo hay un sitio donde se crea la sesión.
        redirectTo: `${window.location.origin}/auth/entrada?destino=${encodeURIComponent(destino)}`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (fallo) {
      setError(errorDeEntrada(fallo))
      setConGoogle(false)
    }
    // Si no falló, el navegador ya se está yendo a Google.
  }

  return (
    <form onSubmit={entrar} className="space-y-4" noValidate>
      <button
        type="button"
        onClick={entrarConGoogle}
        disabled={conGoogle || enviando}
        aria-busy={conGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-linea-fuerte bg-superficie px-4 py-2.5 text-sm font-medium text-tinta transition-colors hover:bg-hundido disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden>
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
        </svg>
        {conGoogle ? 'Abriendo Google' : 'Continuar con Google'}
      </button>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-linea" />
        <span className="text-xs text-tinta-3">o con tu clave</span>
        <span className="h-px flex-1 bg-linea" />
      </div>

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
          aria-invalid={error ? true : undefined}
          className="mt-1.5 w-full rounded-lg border border-linea-fuerte bg-superficie px-3.5 py-2.5 text-sm text-tinta placeholder:text-tinta-3 focus:border-acento-1"
        />
      </label>

      <label className="block">
        <span className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-tinta-2">Clave</span>
          <Link
            href="/recuperar"
            className="text-xs text-tinta-3 underline underline-offset-2 hover:text-tinta"
          >
            La olvidé
          </Link>
        </span>
        <span className="relative mt-1.5 block">
          <input
            type={verClave ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="w-full rounded-lg border border-linea-fuerte bg-superficie px-3.5 py-2.5 pr-16 text-sm text-tinta focus:border-acento-1"
          />
          {/* Escribir una clave a ciegas es de donde salen la mitad de los fallos. */}
          <button
            type="button"
            onClick={() => setVerClave(!verClave)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-tinta-3 hover:text-tinta"
          >
            {verClave ? 'Ocultar' : 'Ver'}
          </button>
        </span>
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-critico-tinte px-3 py-2.5 text-[13px] text-critico"
        >
          {error}
        </p>
      ) : nota ? (
        <p role="status" className="rounded-lg bg-hundido px-3 py-2.5 text-[13px] text-tinta-2">
          {nota}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        aria-busy={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-tinta px-4 py-2.5 text-sm font-semibold text-superficie transition-colors hover:bg-acento-1 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? (
          <>
            <svg className="size-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
              <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Entrando
          </>
        ) : (
          'Entrar'
        )}
      </button>
    </form>
  )
}
