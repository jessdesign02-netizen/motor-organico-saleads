import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

/**
 * Plus Jakarta Sans, la del sistema Silk. Se sirve desde el propio dominio
 * —next/font la descarga en la compilación— así que no hay petición a Google
 * en tiempo de carga ni salto de tipografía al entrar.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--fuente-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ClaveChat · SaleADS',
  description: 'Publicación y respuesta automática del contenido orgánico de SaleADS y Juanads',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body className="min-h-screen bg-arcilla font-sans text-tinta antialiased">{children}</body>
    </html>
  )
}
