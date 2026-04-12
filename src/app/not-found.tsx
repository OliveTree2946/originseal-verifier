export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem',
      fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
      background: '#0a0a0a'
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#333', marginBottom: 20 }}>
        ORIGINSEAL
      </div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>증명을 찾을 수 없습니다</div>
      <div style={{ fontSize: 11, color: '#333', marginBottom: 28 }}>
        proof_id가 존재하지 않거나 삭제되었습니다
      </div>
      <a href="/" style={{
        fontSize: 11, color: '#555', border: '1px solid #222',
        borderRadius: 6, padding: '8px 16px'
      }}>
        홈으로
      </a>
    </main>
  )
}
