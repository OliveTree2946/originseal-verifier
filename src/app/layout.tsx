import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OriginSeal Verifier',
  description: 'Verify the authenticity of digital content',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
