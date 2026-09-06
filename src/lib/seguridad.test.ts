import { describe, expect, it } from 'vitest'
import { destinoPermitido, referenciaValida, secretoCoincide } from './seguridad'

describe('referenciaValida', () => {
  it('acepta las referencias de plataforma', () => {
    expect(referenciaValida('META_TOKEN_SALEADS')).toBe(true)
    expect(referenciaValida('TIKTOK_TOKEN_JUANADS')).toBe(true)
    expect(referenciaValida('YOUTUBE_TOKEN_SALEADS')).toBe(true)
  })

  it('rechaza los secretos del sistema', () => {
    // Sin esta barrera, el sistema enviaría la llave maestra de la base a Meta.
    expect(referenciaValida('SUPABASE_SERVICE_ROLE_KEY')).toBe(false)
    expect(referenciaValida('CRON_SECRET')).toBe(false)
    expect(referenciaValida('META_APP_SECRET')).toBe(false)
    expect(referenciaValida('GOOGLE_SERVICE_ACCOUNT_KEY')).toBe(false)
  })

  it('rechaza cualquier variable ajena a las plataformas', () => {
    expect(referenciaValida('PATH')).toBe(false)
    expect(referenciaValida('DATABASE_URL')).toBe(false)
    expect(referenciaValida('AWS_SECRET_ACCESS_KEY')).toBe(false)
  })

  it('rechaza lo que no tiene forma de variable', () => {
    expect(referenciaValida('meta_token_saleads')).toBe(false)
    expect(referenciaValida('META TOKEN')).toBe(false)
    expect(referenciaValida('META_TOKEN_$(whoami)')).toBe(false)
    expect(referenciaValida('')).toBe(false)
  })
})

describe('destinoPermitido', () => {
  it('deja pasar el embudo propio', () => {
    expect(destinoPermitido('https://wa.me/573000000000?text=hola')).toBe(true)
    expect(destinoPermitido('https://api.whatsapp.com/send?phone=57300')).toBe(true)
    expect(destinoPermitido('https://bio.saleads.co/recursos/guia')).toBe(true)
  })

  it('deja pasar un subdominio del dominio propio', () => {
    expect(destinoPermitido('https://recursos.saleads.ai/x')).toBe(true)
  })

  it('rechaza cualquier otro destino', () => {
    expect(destinoPermitido('https://sitio-cualquiera.com/phishing')).toBe(false)
    expect(destinoPermitido('https://wa.me.sitio-falso.com/573000')).toBe(false)
  })

  it('rechaza el enlace en claro', () => {
    expect(destinoPermitido('http://wa.me/573000000000')).toBe(false)
  })

  it('rechaza los esquemas que no son web', () => {
    expect(destinoPermitido('javascript:alert(1)')).toBe(false)
    expect(destinoPermitido('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(destinoPermitido('file:///etc/passwd')).toBe(false)
  })

  it('rechaza lo que ni siquiera es una URL', () => {
    expect(destinoPermitido('no soy una url')).toBe(false)
    expect(destinoPermitido('')).toBe(false)
  })
})

describe('secretoCoincide', () => {
  it('reconoce el secreto correcto', () => {
    expect(secretoCoincide('abc123', 'abc123')).toBe(true)
  })

  it('rechaza el equivocado', () => {
    expect(secretoCoincide('abc124', 'abc123')).toBe(false)
  })

  it('rechaza el que solo comparte el principio', () => {
    expect(secretoCoincide('abc', 'abc123')).toBe(false)
  })

  it('rechaza la cabecera ausente', () => {
    expect(secretoCoincide(null, 'abc123')).toBe(false)
  })
})
