'use client'

interface Proof {
  id: string
  content_hash: string | null
  anchor_record: string | null
  eas_uid: string | null
  tx_hash: string | null
  status: string | null
  created_at: string
}

export default function ProofCard({ proof }: { proof: Proof }) {
  const isAnchored = !!proof.eas_uid
  const createdAt = new Date(proof.created_at)
  const dateStr = createdAt.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const shortHash = (h: string | null) =>
    h ? `${h.slice(0, 8)}...${h.slice(-8)}` : '—'

  const easLink = proof.eas_uid
    ? `https://sepolia.easscan.org/attestation/view/${proof.eas_uid}`
    : null

  const overallStatus = isAnchored ? 'VERIFIED' : 'PENDING_ANCHOR'

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '2rem',
      fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
      background: '#0a0a0a'
    }}>
      <div style={{ maxWidth: 560, width: '100%' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', color: '#444',
            marginBottom: 16, textTransform: 'uppercase'
          }}>
            OriginSeal · Digital Origin Verifier
          </div>

          <StatusBadge status={overallStatus} />

          <div style={{ marginTop: 16, fontSize: 12, color: '#555' }}>
            {dateStr} KST
          </div>
        </div>

        {/* 메인 카드 */}
        <div style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, overflow: 'hidden', marginBottom: 12
        }}>
          <Row label="PROOF ID" value={proof.id} mono />
          <Row label="CONTENT HASH" value={shortHash(proof.content_hash)} mono dim />
          <Row label="ANCHOR RECORD" value={shortHash(proof.anchor_record)} mono dim />
          <Row label="STATUS" value={proof.status?.toUpperCase() ?? '—'} />
        </div>

        {/* 검증 항목 */}
        <div style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, overflow: 'hidden', marginBottom: 12
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            fontSize: 10, letterSpacing: '0.15em', color: '#444'
          }}>
            VERIFICATION CHECKS
          </div>
          <CheckRow label="V1  서명 검증" status="skip" note="Sprint 4 (키스토어 통합 후)" />
          <CheckRow label="V2  해시체인 연속성" status="skip" note="Sprint 2 (해시체인 엔진 후)" />
          <CheckRow
            label="V3  EAS 온체인 앵커"
            status={isAnchored ? 'pass' : 'pending'}
            note={isAnchored ? proof.eas_uid!.slice(0, 20) + '...' : '앵커링 대기 중'}
            link={easLink}
          />
          <CheckRow label="V4  ZK 증명" status="na" note="Phase 2" />
          <CheckRow label="V5  철회 상태" status={proof.status === 'active' || !proof.status ? 'pass' : 'fail'} note="revocation_status = 0" />
        </div>

        {/* EAS 링크 */}
        {easLink && (
          <div style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 12
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#444', marginBottom: 8 }}>
              BLOCKCHAIN ANCHOR
            </div>
            <a
              href={easLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11, color: '#3b82f6',
                wordBreak: 'break-all', lineHeight: 1.6
              }}
            >
              {proof.eas_uid}
            </a>
            {proof.tx_hash && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 6, wordBreak: 'break-all' }}>
                tx: {proof.tx_hash}
              </div>
            )}
          </div>
        )}

        {/* 푸터 */}
        <div style={{ fontSize: 11, color: '#333', textAlign: 'center', paddingTop: 8 }}>
          Sprint 0 · Sepolia Testnet · GRANARY Works
        </div>
      </div>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    VERIFIED:       { label: '✓  원본 확인됨', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    PENDING_ANCHOR: { label: '◎  앵커링 대기 중', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    FAILED:         { label: '✗  검증 실패', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
  const c = cfg[status] ?? cfg.PENDING_ANCHOR
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: c.bg, border: `1px solid ${c.color}33`,
      borderRadius: 6, padding: '8px 14px',
      fontSize: 13, color: c.color, letterSpacing: '-0.01em'
    }}>
      {c.label}
    </div>
  )
}

function Row({ label, value, mono, dim }: {
  label: string; value: string; mono?: boolean; dim?: boolean
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
      gap: 16, flexWrap: 'wrap'
    }}>
      <span style={{ fontSize: 10, letterSpacing: '0.12em', color: '#444', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, color: dim ? '#555' : '#c0c0c0',
        fontFamily: mono ? 'inherit' : 'inherit',
        wordBreak: 'break-all', textAlign: 'right'
      }}>
        {value}
      </span>
    </div>
  )
}

function CheckRow({ label, status, note, link }: {
  label: string; status: 'pass' | 'fail' | 'pending' | 'skip' | 'na'; note?: string; link?: string | null
}) {
  const cfg = {
    pass:    { symbol: '✓', color: '#22c55e' },
    fail:    { symbol: '✗', color: '#ef4444' },
    pending: { symbol: '◎', color: '#f59e0b' },
    skip:    { symbol: '—', color: '#333' },
    na:      { symbol: 'N/A', color: '#333' },
  }
  const c = cfg[status]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)'
    }}>
      <span style={{ fontSize: 11, color: c.color, minWidth: 28 }}>{c.symbol}</span>
      <span style={{ fontSize: 11, color: status === 'skip' || status === 'na' ? '#444' : '#999', flex: 1 }}>
        {label}
      </span>
      {note && (
        link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 10, color: '#3b82f6', textAlign: 'right', maxWidth: 180, wordBreak: 'break-all' }}>
            {note}
          </a>
        ) : (
          <span style={{ fontSize: 10, color: '#333', textAlign: 'right', maxWidth: 180 }}>{note}</span>
        )
      )}
    </div>
  )
}
