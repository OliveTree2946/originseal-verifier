'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [id, setId] = useState('')
  const router = useRouter()

  const handleVerify = () => {
    const trimmed = id.trim()
    if (trimmed) router.push(`/p/${trimmed}`)
  }

  return (
    <main style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '2rem',
      fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
      background: '#0a0a0a'
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#555', marginBottom: 24 }}>
          ORIGINSEAL
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 400, color: '#f0f0f0', marginBottom: 12, letterSpacing: '-0.02em' }}>
          Digital Origin Verifier
        </h1>
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 32 }}>
          증명 링크를 통해 접속하거나,<br />
          아래에 proof_id를 직접 입력하세요.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder="proof_id (UUID)"
            style={{
              flex: 1, background: '#111', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, padding: '10px 14px', color: '#f0f0f0',
              fontSize: 12, fontFamily: 'inherit', outline: 'none'
            }}
          />
          <button
            onClick={handleVerify}
            style={{
              background: '#f0f0f0', color: '#0a0a0a', border: 'none',
              borderRadius: 6, padding: '10px 18px', fontSize: 12,
              fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500
            }}
          >
            검증
          </button>
        </div>
      </div>
    </main>
  )
}
