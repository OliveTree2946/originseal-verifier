'use client'

import { useState, useEffect } from 'react'
import {
  verifySignatureV1, verifyChainV2, verifyOnChainV3, verifyOT,
  normalizeHex, EASSCAN_BASE,
  type VerifyResult, type V2Result, type ChainEvent, type OTPreimage,
} from '@/lib/verify'

// ─── Types ──────────────────────────────────────────────────
interface ServerVerification {
  verification?: {
    v1_signature?: { status: string; detail?: string }
    v2_chain_continuity?: {
      status: string; detail?: string
      session_summary?: {
        started_at?: string; ended_at?: string
        total_events?: number; captures?: number
        continuity_records?: number; gaps?: number; blanks?: number
      }
    }
    v3_eas_anchor?: {
      status: string; detail?: string
      eas_uid?: string; tx_hash?: string; block_number?: number
    }
    v4_zk_proof?: { status: string; detail?: string; reason?: string }
    v5_revocation?: { status: string; detail?: string }
    origin_tag_check?: { status: string; detail?: string }
  }
  overall_result?: string
  trust_grade?: string
  grade_subscores?: Record<string, string>
  captured_at?: string
  device_model?: string
  device_attestation_level?: number
  sensor_count?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ProofRow { [key: string]: any }

interface Props {
  proofId: string
  proof: ProofRow | null
  serverVerification: ServerVerification | null
  chainEvents: ChainEvent[] | null
}

// ─── Helpers ────────────────────────────────────────────────
function formatTime(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }) + ' KST'
  } catch { return ts }
}

function shortHex(h: string | null | undefined, len = 10): string {
  if (!h) return '—'
  const clean = normalizeHex(h)
  if (clean.length <= len * 2) return clean
  return `${clean.slice(0, len)}…${clean.slice(-len)}`
}

// ─── Main Component ─────────────────────────────────────────
export default function ProofCard({ proofId, proof, serverVerification, chainEvents }: Props) {
  const [clientV1, setClientV1] = useState<VerifyResult | null>(null)
  const [clientV2, setClientV2] = useState<V2Result | null>(null)
  const [clientV3, setClientV3] = useState<VerifyResult | null>(null)
  const [clientOT, setClientOT] = useState<VerifyResult | null>(null)
  const [clientRunning, setClientRunning] = useState(true)

  // Client-side independent verification
  useEffect(() => {
    if (!proof) { setClientRunning(false); return }

    const run = async () => {
      // V1: Signature
      if (proof.anchor_record && proof.signature && proof.public_key) {
        const r = await verifySignatureV1(
          normalizeHex(proof.anchor_record),
          proof.signature,
          proof.public_key
        )
        setClientV1(r)
      }

      // V2: Chain continuity
      if (chainEvents && chainEvents.length > 0) {
        const r = await verifyChainV2(chainEvents)
        setClientV2(r)
      }

      // V3: On-chain
      if (proof.eas_uid) {
        const r = await verifyOnChainV3(proof.eas_uid)
        setClientV3(r)
      } else {
        setClientV3({ status: 'pending', detail: '앵커링 대기 중' })
      }

      // OT: Recalculation
      if (proof.origin_tag_preimage && proof.origin_tag) {
        const pre: OTPreimage = typeof proof.origin_tag_preimage === 'string'
          ? JSON.parse(proof.origin_tag_preimage)
          : proof.origin_tag_preimage
        const r = await verifyOT(
          proof.origin_tag,
          proof.anchor_record,
          proof.chain_continuity_hash,
          pre
        )
        setClientOT(r)
      }

      setClientRunning(false)
    }

    run()
  }, [proof, chainEvents])

  const sv = serverVerification?.verification
  const overall = serverVerification?.overall_result
  const isVerified = overall === 'VERIFIED'
  const isPending = overall === 'PENDING_ANCHOR'

  const capturedAt = serverVerification?.captured_at || proof?.captured_at
  const deviceModel = serverVerification?.device_model || proof?.device_model
  const sensorCount = serverVerification?.sensor_count ?? proof?.sensor_count
  const attestLevel = serverVerification?.device_attestation_level ?? proof?.device_attestation_level
  const grade = serverVerification?.trust_grade || proof?.trust_grade

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#444', marginBottom: 20 }}>
        ORIGINSEAL · PROOF VERIFIER
      </div>

      {/* Overall Status */}
      {overall && (
        <div style={{
          padding: '18px 20px', borderRadius: 10, marginBottom: 20,
          background: isVerified ? 'var(--green-dim)' : isPending ? 'var(--amber-dim)' : 'var(--red-dim)',
          border: `1px solid ${isVerified ? 'var(--green)' : isPending ? 'var(--amber)' : 'var(--red)'}22`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 24 }}>
              {isVerified ? '✓' : isPending ? '◎' : '✗'}
            </span>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 500,
                color: isVerified ? 'var(--green)' : isPending ? 'var(--amber)' : 'var(--red)',
              }}>
                {isVerified ? '원본 확인됨' : isPending ? '앵커링 대기 중' : '검증 실패'}
              </div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2, letterSpacing: '0.05em' }}>
                {overall}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10, marginTop: 14,
          }}>
            <MetaItem label="촬영 시각" value={formatTime(capturedAt)} />
            <MetaItem label="디바이스" value={
              `${deviceModel || '—'}${attestLevel === 0 ? ' · HW' : ''}`
            } />
            <MetaItem label="센서" value={sensorCount ? `${sensorCount}종` : '—'} />
            <MetaItem label="등급" value={grade || '—'} highlight />
          </div>
        </div>
      )}

      {/* Server Verification */}
      <SectionLabel>서버 검증 결과</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <CheckRow
          label="V1  서명 검증"
          status={sv?.v1_signature?.status || 'skip'}
          note={sv?.v1_signature?.detail}
        />
        <CheckRow
          label="V2  해시체인 연속성"
          status={sv?.v2_chain_continuity?.status || 'skip'}
          note={sv?.v2_chain_continuity?.detail}
        />
        {sv?.v2_chain_continuity?.session_summary && (
          <SessionSummary summary={sv.v2_chain_continuity.session_summary} />
        )}
        <CheckRow
          label="V3  EAS 블록체인 앵커"
          status={sv?.v3_eas_anchor?.status || 'skip'}
          note={sv?.v3_eas_anchor?.eas_uid ? shortHex(sv.v3_eas_anchor.eas_uid, 12) : sv?.v3_eas_anchor?.detail}
          link={sv?.v3_eas_anchor?.eas_uid ? `${EASSCAN_BASE}/${sv.v3_eas_anchor.eas_uid}` : undefined}
        />
        <CheckRow
          label="V4  영지식 증명"
          status={sv?.v4_zk_proof?.status || 'na'}
          note="Phase 2"
        />
        <CheckRow
          label="V5  철회 상태"
          status={sv?.v5_revocation?.status || 'skip'}
          note={sv?.v5_revocation?.detail}
        />
        <CheckRow
          label="OT  Origin Tag"
          status={sv?.origin_tag_check?.status || 'skip'}
          note={sv?.origin_tag_check?.detail}
          last
        />
      </div>

      {/* Client Independent Verification */}
      <SectionLabel>
        클라이언트 독립 검증
        <span style={{ fontWeight: 400, fontSize: 9, color: '#333', marginLeft: 8 }}>
          서버를 신뢰하지 않는 독립 재검증
        </span>
      </SectionLabel>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        {clientRunning ? (
          <div style={{ padding: '14px 16px', fontSize: 11, color: '#444' }}>
            <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>●</span>
            {' '}독립 검증 수행 중...
          </div>
        ) : (
          <>
            <CheckRow
              label="V1  브라우저 서명 검증"
              status={clientV1?.status || 'skip'}
              note={clientV1?.detail}
            />
            <CheckRow
              label="V2  해시체인 재계산"
              status={clientV2?.status || 'skip'}
              note={clientV2?.detail}
            />
            {clientV2?.status === 'pass' && clientV2?.summary && (
              <SessionSummary summary={clientV2.summary} />
            )}
            <CheckRow
              label="V3  온체인 직접 조회"
              status={clientV3?.status || 'skip'}
              note={clientV3?.detail}
              link={clientV3?.easscan_url}
            />
            <CheckRow
              label="OT  브라우저 재계산"
              status={clientOT?.status || 'skip'}
              note={clientOT?.detail}
              last
            />
          </>
        )}
      </div>

      {/* Proof Details */}
      <SectionLabel>증명 상세</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <DetailRow label="PROOF ID" value={proofId} />
        <DetailRow label="CONTENT HASH" value={shortHex(proof?.content_hash)} />
        <DetailRow label="ANCHOR RECORD" value={shortHex(proof?.anchor_record)} />
        {proof?.eas_uid && (
          <DetailRow label="EAS UID" value={shortHex(proof.eas_uid, 14)} link={`${EASSCAN_BASE}/${proof.eas_uid}`} />
        )}
        {proof?.tx_hash && (
          <DetailRow label="TX HASH" value={shortHex(proof.tx_hash, 14)} last />
        )}
      </div>

      {/* Grade Subscores */}
      {serverVerification?.grade_subscores && (
        <>
          <SectionLabel>신뢰 등급 상세</SectionLabel>
          <div style={{ ...cardStyle, marginBottom: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(serverVerification.grade_subscores).map(([k, v]) => (
                <span key={k} style={{
                  padding: '4px 10px', borderRadius: 5, fontSize: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ color: '#555' }}>{k.replace(/_/g, ' ')}</span>
                  {' '}
                  <span style={{
                    fontWeight: 600,
                    color: v === 'A' ? 'var(--green)' : v === 'D' ? 'var(--amber)' : '#888',
                  }}>{v}</span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ fontSize: 10, color: '#222', textAlign: 'center', paddingTop: 12 }}>
        Sprint 7 · Sepolia Testnet · GRANARY Works
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }
      `}</style>
    </main>
  )
}

// ─── Sub-components ─────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 10, overflow: 'hidden',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: '0.18em', color: '#444',
      marginBottom: 8, textTransform: 'uppercase',
    }}>
      {children}
    </div>
  )
}

function MetaItem({ label, value, highlight }: {
  label: string; value: string; highlight?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? 18 : 11, marginTop: 3,
        color: highlight ? 'var(--accent)' : '#999',
        fontWeight: highlight ? 600 : 400,
      }}>
        {value}
      </div>
    </div>
  )
}

function CheckRow({ label, status, note, link, last }: {
  label: string
  status: string
  note?: string
  link?: string
  last?: boolean
}) {
  const cfg: Record<string, { symbol: string; color: string }> = {
    pass:    { symbol: '✓', color: 'var(--green)' },
    fail:    { symbol: '✗', color: 'var(--red)' },
    pending: { symbol: '◎', color: 'var(--amber)' },
    error:   { symbol: '⚠', color: 'var(--amber)' },
    skip:    { symbol: '—', color: '#333' },
    na:      { symbol: 'N/A', color: '#333' },
  }
  const c = cfg[status] || cfg.skip

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 16px',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 11, color: c.color, minWidth: 28, textAlign: 'center' }}>
        {c.symbol}
      </span>
      <span style={{
        fontSize: 11, flex: 1,
        color: status === 'skip' || status === 'na' ? '#444' : '#999',
      }}>
        {label}
      </span>
      {note && (
        link ? (
          <a href={link} target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 10, color: 'var(--blue)', textAlign: 'right',
              maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
            {note}
          </a>
        ) : (
          <span style={{
            fontSize: 10, color: '#444', textAlign: 'right',
            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {note}
          </span>
        )
      )}
    </div>
  )
}

function SessionSummary({ summary }: {
  summary: {
    started_at?: string | null; ended_at?: string | null
    total_events?: number; captures?: number
    continuity_records?: number; gaps?: number; blanks?: number
  }
}) {
  return (
    <div style={{
      padding: '8px 16px 10px 56px', fontSize: 10, color: '#444',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
    }}>
      <span>시작: {formatTimeSub(summary.started_at)}</span>
      <span>종료: {formatTimeSub(summary.ended_at)}</span>
      <span>이벤트 {summary.total_events ?? '—'}건</span>
      <span>캡처 {summary.captures ?? '—'}건</span>
      <span>연속성 {summary.continuity_records ?? '—'}건</span>
      <span>갭 {summary.gaps ?? 0}건</span>
    </div>
  )
}

function DetailRow({ label, value, link, last }: {
  label: string; value: string; link?: string; last?: boolean
}) {
  const content = link ? (
    <a href={link} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--blue)', wordBreak: 'break-all', textAlign: 'right' }}>
      {value}
    </a>
  ) : (
    <span style={{ color: '#666', wordBreak: 'break-all', textAlign: 'right' }}>{value}</span>
  )

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 16px', gap: 16, flexWrap: 'wrap',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 9, letterSpacing: '0.12em', color: '#444', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 11 }}>{content}</span>
    </div>
  )
}

function formatTimeSub(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit',
    })
  } catch { return ts }
}
