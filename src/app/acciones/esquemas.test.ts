import { describe, expect, it } from 'vitest'
import {
  esquemaAutomatizacion,
  esquemaCuenta,
  esquemaMarca,
  esquemaNuevaPieza,
  esquemaPieza,
  esquemaRecurso,
  esquemaRevision,
  esquemaRol,
  partirVariantes,
} from './esquemas'

/**
 * Un uuid de versión 4, que es lo que genera `gen_random_uuid()` en Postgres.
 * Zod comprueba la versión además de la forma, así que un identificador
 * inventado a mano queda fuera.
 */
const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

/** El mensaje que la persona va a leer en pantalla. */
function motivoDe(resultado: { success: boolean; error?: { issues: Array<{ message: string }> } }) {
  return resultado.error?.issues[0]?.message ?? ''
}

describe('esquemaPieza', () => {
  const valida = { piezaId: UUID, tema: 'Meta Ads' }

  it('acepta lo mínimo', () => {
    expect(esquemaPieza.safeParse(valida).success).toBe(true)
  })

  it('acepta la fecha y la hora vacías, porque una pieza puede no tener día aún', () => {
    expect(esquemaPieza.safeParse({ ...valida, fecha: null, hora: null }).success).toBe(true)
  })

  it('rechaza el tema demasiado corto, y lo dice', () => {
    const salida = esquemaPieza.safeParse({ ...valida, tema: 'ab' })
    expect(salida.success).toBe(false)
    expect(motivoDe(salida)).toContain('tres letras')
  })

  it('rechaza la fecha en el formato del día a día', () => {
    // 12/09/2026 se entiende al leer la hoja, y aquí ya viene de un campo date.
    const salida = esquemaPieza.safeParse({ ...valida, fecha: '12/09/2026' })
    expect(motivoDe(salida)).toContain('AAAA-MM-DD')
  })

  it('rechaza la hora con segundos', () => {
    expect(esquemaPieza.safeParse({ ...valida, hora: '18:00:00' }).success).toBe(false)
  })

  it('rechaza un identificador que no es de esta base', () => {
    expect(esquemaPieza.safeParse({ ...valida, piezaId: '123' }).success).toBe(false)
  })
})

describe('esquemaAutomatizacion', () => {
  const valida = {
    piezaId: UUID,
    palabra: 'AUTOMATIZA',
    mensaje: 'Aquí tienes la guía que pediste',
    destinoWhatsapp: 'https://wa.me/573000000000',
  }

  it('acepta la automatización completa', () => {
    expect(esquemaAutomatizacion.safeParse(valida).success).toBe(true)
  })

  it('rechaza el mensaje de una palabra', () => {
    const salida = esquemaAutomatizacion.safeParse({ ...valida, mensaje: 'toma' })
    expect(motivoDe(salida)).toContain('diez letras')
  })

  it('rechaza el destino que no es un enlace', () => {
    const salida = esquemaAutomatizacion.safeParse({ ...valida, destinoWhatsapp: 'wa.me/573000' })
    expect(motivoDe(salida)).toContain('enlace completo')
  })

  it('rechaza la palabra clave demasiado corta', () => {
    // Dos letras coincidirían dentro de medio comentario.
    expect(esquemaAutomatizacion.safeParse({ ...valida, palabra: 'ok' }).success).toBe(false)
  })
})

describe('esquemaRevision', () => {
  it('acepta aprobar y devolver', () => {
    expect(esquemaRevision.safeParse({ piezaId: UUID, accion: 'aprobar' }).success).toBe(true)
    expect(
      esquemaRevision.safeParse({ piezaId: UUID, accion: 'devolver', comentario: 'el hook' }).success,
    ).toBe(true)
  })

  it('rechaza una acción inventada', () => {
    expect(esquemaRevision.safeParse({ piezaId: UUID, accion: 'borrar' }).success).toBe(false)
  })
})

describe('esquemaCuenta · la barrera de la credencial', () => {
  const valida = {
    marcaId: UUID,
    red: 'instagram',
    handle: '@saleads.ai',
    externalAccountId: 'IG_1',
    credentialRef: 'META_TOKEN_SALEADS',
    tokenExpiraAt: null,
  }

  it('acepta la referencia con prefijo de plataforma', () => {
    expect(esquemaCuenta.safeParse(valida).success).toBe(true)
  })

  it('rechaza el secreto del sistema, y explica por qué', () => {
    const salida = esquemaCuenta.safeParse({ ...valida, credentialRef: 'SUPABASE_SERVICE_ROLE_KEY' })
    expect(salida.success).toBe(false)
    expect(motivoDe(salida)).toContain('secreto del sistema')
  })

  it('rechaza una variable cualquiera, y dice cómo debe empezar', () => {
    const salida = esquemaCuenta.safeParse({ ...valida, credentialRef: 'MI_TOKEN' })
    expect(motivoDe(salida)).toContain('META_TOKEN_')
  })

  it('rechaza el token pegado en lugar de su nombre', () => {
    // El error más probable: pegar el token donde va el nombre de la variable.
    const salida = esquemaCuenta.safeParse({ ...valida, credentialRef: 'EAAGm0PX4ZCpsBO1234abcd' })
    expect(salida.success).toBe(false)
  })

  it('rechaza una red que no existe', () => {
    expect(esquemaCuenta.safeParse({ ...valida, red: 'twitter' }).success).toBe(false)
  })
})

describe('esquemaMarca', () => {
  const valida = { nombre: 'SaleADS', slug: 'saleads' }

  it('acepta la marca mínima', () => {
    expect(esquemaMarca.safeParse(valida).success).toBe(true)
  })

  it('acepta el WhatsApp vacío, porque se llena después', () => {
    expect(esquemaMarca.safeParse({ ...valida, whatsappUrl: '' }).success).toBe(true)
  })

  it('rechaza el slug con mayúsculas o espacios', () => {
    expect(motivoDe(esquemaMarca.safeParse({ ...valida, slug: 'SaleADS' }))).toContain('minúsculas')
    expect(esquemaMarca.safeParse({ ...valida, slug: 'sale ads' }).success).toBe(false)
  })
})

describe('esquemaRecurso y esquemaNuevaPieza', () => {
  it('acepta el recurso completo', () => {
    expect(
      esquemaRecurso.safeParse({
        marcaId: UUID,
        titulo: 'Guía de anuncios',
        tipo: 'pdf',
        url: 'https://bio.saleads.co/recursos/guia',
      }).success,
    ).toBe(true)
  })

  it('rechaza un tipo de recurso que no está en la lista', () => {
    expect(
      esquemaRecurso.safeParse({ marcaId: UUID, titulo: 'Guía', tipo: 'audio', url: 'https://x.co' })
        .success,
    ).toBe(false)
  })

  it('acepta la pieza nueva sin fecha', () => {
    expect(esquemaNuevaPieza.safeParse({ marcaId: UUID, tema: 'Meta Ads', fecha: null }).success).toBe(
      true,
    )
  })
})

describe('esquemaRol', () => {
  it('acepta los cuatro roles', () => {
    for (const rol of ['editora', 'aprobadora', 'audiovisual', 'observador']) {
      expect(esquemaRol.safeParse({ personaId: UUID, rol }).success).toBe(true)
    }
  })

  it('rechaza un rol inventado', () => {
    expect(esquemaRol.safeParse({ personaId: UUID, rol: 'administradora' }).success).toBe(false)
  })
})

describe('partirVariantes', () => {
  it('parte por coma y por salto de línea', () => {
    expect(partirVariantes('automatizas, automatiz\notomatiza')).toEqual([
      'automatizas',
      'automatiz',
      'otomatiza',
    ])
  })

  it('descarta lo vacío y los espacios de sobra', () => {
    expect(partirVariantes('  uno  , , dos ,')).toEqual(['uno', 'dos'])
  })

  it('devuelve vacío cuando no hay nada escrito', () => {
    expect(partirVariantes(undefined)).toEqual([])
    expect(partirVariantes('   ')).toEqual([])
  })
})
