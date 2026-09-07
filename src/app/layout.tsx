import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Motor Orgánico · SaleADS',
  description: 'Publicación y respuesta automática del contenido orgánico de SaleADS y Juanads',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-plano font-sans text-tinta antialiased">{children}</body>
    </html>
  )
}
