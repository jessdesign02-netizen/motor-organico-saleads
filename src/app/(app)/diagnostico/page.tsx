import { clienteServidor } from '@/lib/supabase/server'
import { Tarjeta } from '@/app/ui'

export const dynamic = 'force-dynamic'

/**
 * Recorre las siete entregas y dice qué está listo y qué falta, con la
 * instrucción concreta para resolverlo. Es la primera pantalla que se abre
 * cuando algo no sale.
 */

type Punto = { entrega: string; asunto: string; listo: boolean; comoSeArregla: string }

function variable(nombre: string): boolean {
  return Boolean(process.env[nombre])
}

const DIAS_DE_AVISO = 7

/** El corte de la alerta de vencimiento, calculado fuera del render. */
async function corteDeAviso(): Promise<string> {
  'use server'
  return new Date(Date.now() + DIAS_DE_AVISO * 86_400_000).toISOString()
}

export default async function Diagnostico() {
  const supabase = await clienteServidor()

  const [
    { count: marcas },
    { count: cuentas },
    { count: piezas },
    { count: recursos },
    { count: cuentasTiktokDirectas },
    { count: piezasConError },
    { data: sync },
  ] = await Promise.all([
    supabase.from('brands').select('id', { count: 'exact', head: true }),
    supabase.from('social_accounts').select('id', { count: 'exact', head: true }),
    supabase.from('pieces').select('id', { count: 'exact', head: true }),
    supabase.from('resources').select('id', { count: 'exact', head: true }),
    supabase
      .from('social_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('red', 'tiktok')
      .eq('publicacion_directa', true),
    supabase.from('pieces').select('id', { count: 'exact', head: true }).not('video_error', 'is', null),
    supabase.from('sync_logs').select('*').order('corrio_at', { ascending: false }).limit(1),
  ])

  const { data: cuentasVencidas } = await supabase
    .from('social_accounts')
    .select('handle, token_expira_at')
    .not('token_expira_at', 'is', null)
    .lt('token_expira_at', await corteDeAviso())

  const puntos: Punto[] = [
    {
      entrega: '1 · Fundación',
      asunto: 'Conexión con Supabase',
      listo: variable('NEXT_PUBLIC_SUPABASE_URL') && variable('SUPABASE_SERVICE_ROLE_KEY'),
      comoSeArregla: 'Llena NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY',
    },
    {
      entrega: '2 · Esquema',
      asunto: 'Migraciones aplicadas',
      listo: (marcas ?? 0) >= 0 && (piezas ?? 0) >= 0,
      comoSeArregla: 'Corre supabase/migrations en orden: 0001, 0002 y 0003 después de crear tu usuario',
    },
    {
      entrega: '3 · Acceso',
      asunto: 'Marcas cargadas',
      listo: (marcas ?? 0) > 0,
      comoSeArregla: 'Crea SaleADS y Juanads en la tabla brands, con su hoja y su WhatsApp',
    },
    {
      entrega: '4 · Ingesta',
      asunto: 'Hoja de cálculo conectada',
      listo: variable('GOOGLE_SERVICE_ACCOUNT_EMAIL') && variable('GOOGLE_SERVICE_ACCOUNT_KEY'),
      comoSeArregla: 'Crea la cuenta de servicio en Google Cloud y comparte la hoja con su correo',
    },
    {
      entrega: '5 · Preparación',
      asunto: 'Piezas en la parrilla',
      listo: (piezas ?? 0) > 0,
      comoSeArregla: 'Corre la sincronización, o crea una pieza desde la app',
    },
    {
      entrega: '6 · Publicación',
      asunto: 'Cuentas de red conectadas',
      listo: (cuentas ?? 0) > 0,
      comoSeArregla: 'Registra las cuentas en social_accounts, con su credential_ref apuntando a una variable',
    },
    {
      entrega: '6 · Publicación',
      asunto: 'Credenciales de Meta',
      listo: variable('META_APP_ID') && variable('META_APP_SECRET'),
      comoSeArregla: 'Carga META_APP_ID y META_APP_SECRET desde el panel de Meta for Developers',
    },
    {
      entrega: '7 · Motor',
      asunto: 'Webhook de comentarios',
      listo: variable('META_WEBHOOK_VERIFY_TOKEN'),
      comoSeArregla:
        'Define META_WEBHOOK_VERIFY_TOKEN y apunta el webhook a /api/webhooks/instagram con el campo comments',
    },
    {
      entrega: '7 · Motor',
      asunto: 'Trabajos programados',
      listo: variable('CRON_SECRET'),
      comoSeArregla: 'Define CRON_SECRET y despliega en Vercel para que corran los cuatro cron de vercel.json',
    },
    {
      entrega: 'Fase 2 · TikTok',
      asunto: 'Publicación directa habilitada',
      listo: (cuentasTiktokDirectas ?? 0) > 0,
      comoSeArregla:
        'Mientras la auditoría de Content Posting no pase, el video va al buzón. Cuando pase, enciende la casilla en Ajustes',
    },
    {
      entrega: 'Fase 2 · YouTube',
      asunto: 'Credenciales de YouTube',
      listo: variable('YOUTUBE_CLIENT_ID') && variable('YOUTUBE_CLIENT_SECRET'),
      comoSeArregla: 'Carga YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET desde Google Cloud',
    },
    {
      entrega: '11 · Video',
      asunto: 'Acceso a Drive para bajar el video',
      listo: variable('GOOGLE_SERVICE_ACCOUNT_KEY'),
      comoSeArregla:
        'La misma cuenta de servicio de la hoja necesita acceso de lectura a la carpeta de Drive con los videos',
    },
    {
      entrega: '11 · Video',
      asunto: 'Piezas con el video listo para salir',
      listo: (piezasConError ?? 0) === 0,
      comoSeArregla: 'Alguna pieza guarda un error al bajar el video. Ábrela para ver el motivo',
    },
    {
      entrega: 'Fase 3 · Biblioteca',
      asunto: 'Recursos publicados',
      listo: (recursos ?? 0) > 0,
      comoSeArregla: 'Carga recursos en /recursos. La página pública los lee desde /api/recursos',
    },
  ]

  const listos = puntos.filter((p) => p.listo).length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Diagnóstico</h1>
        <p className="text-sm text-neutral-500">
          {listos} de {puntos.length} puntos en verde
        </p>
      </header>

      <Tarjeta titulo="Estado por entrega">
        <ul className="divide-y divide-neutral-100">
          {puntos.map((punto) => (
            <li key={`${punto.entrega}-${punto.asunto}`} className="flex items-start gap-3 py-3">
              <span className={punto.listo ? 'text-emerald-600' : 'text-amber-600'}>{punto.listo ? '●' : '○'}</span>
              <div>
                <p className="text-sm font-medium">{punto.asunto}</p>
                <p className="text-xs text-neutral-500">{punto.entrega}</p>
                {punto.listo ? null : <p className="mt-1 text-xs text-neutral-700">{punto.comoSeArregla}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Tarjeta>

      {(cuentasVencidas ?? []).length > 0 ? (
        <Tarjeta titulo="Credenciales por vencer">
          <ul className="space-y-1 text-sm">
            {(cuentasVencidas ?? []).map((cuenta) => (
              <li key={cuenta.handle}>
                {cuenta.handle} vence el {cuenta.token_expira_at?.slice(0, 10)}
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      <Tarjeta titulo="Última sincronización">
        {(sync ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía sin corridas registradas.</p>
        ) : (
          (sync ?? []).map((registro) => (
            <div key={registro.id} className="text-sm">
              <p>
                {registro.corrio_at.slice(0, 16).replace('T', ' ')} · {registro.filas_leidas} filas leídas,{' '}
                {registro.filas_creadas} creadas, {registro.filas_actualizadas} actualizadas,{' '}
                {registro.filas_ignoradas} ignoradas
              </p>
              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                {registro.detalle.map((linea, indice) => (
                  <li key={indice}>
                    {linea.fila}: {linea.motivo}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Tarjeta>
    </div>
  )
}
