// ─── OriginSeal Client-Side Verification Utilities ──────────
// Sprint 7: 브라우저에서 독립 검증 수행 (서버를 신뢰하지 않아도 됨)
// ADR-018: SHA256(UTF8(hexString)) 공식 준수
// ADR-021: 클라이언트=온체인 독립 검증

const EAS_CONTRACT = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
export const EASSCAN_BASE = 'https://sepolia.easscan.org/attestation/view'

// ─── Types ──────────────────────────────────────────────────
export interface VerifyResult {
  status: 'pass' | 'fail' | 'pending' | 'error' | 'skip' | 'na'
  detail: string
  easscan_url?: string
}

export interface V2Result extends VerifyResult {
  summary?: {
    total_events: number
    captures: number
    continuity_records: number
    gaps: number
    blanks: number
    started_at: string | null
    ended_at: string | null
  }
}

export interface ChainEvent {
  seq: number
  event_type: string
  ts_utc: string
  ts_utc_raw?: string | null
  payload_hash: string
  prev_hash: string
  chain_hash: string
  [key: string]: unknown
}

// ─── Hex / Byte Utilities ───────────────────────────────────
export function normalizeHex(val: unknown): string {
  if (!val || typeof val !== 'string') return ''
  return val.replace(/^(0x|\\\\x|\\x)/, '').toLowerCase()
}

function hexToBytes(hex: string): Uint8Array {
  const clean = normalizeHex(hex)
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isBase64(str: string): boolean {
  if (!str || str.length < 4) return false
  try { return /^[A-Za-z0-9+/]+=*$/.test(str) && btoa(atob(str)) === str }
  catch { return false }
}

// ─── SHA-256 (ADR-018 공식: SHA256(UTF8(hexString))) ────────
async function sha256Hex(hexString: string): Promise<string> {
  const bytes = new TextEncoder().encode(hexString)
  const hash = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
  return bytesToHex(new Uint8Array(hash))
}

// ─── V1: EC P-256 Signature Verification ────────────────────
function derToP1363(derSig: Uint8Array): Uint8Array | null {
  let offset = 0
  if (derSig[offset++] !== 0x30) return null
  const totalLen = derSig[offset++]
  if (totalLen & 0x80) offset += (totalLen & 0x7f)

  if (derSig[offset++] !== 0x02) return null
  const rLen = derSig[offset++]
  let r = derSig.slice(offset, offset + rLen)
  offset += rLen

  if (derSig[offset++] !== 0x02) return null
  const sLen = derSig[offset++]
  let s = derSig.slice(offset, offset + sLen)

  // Trim leading zeros, pad to 32 bytes
  while (r.length > 32 && r[0] === 0) r = r.slice(1)
  while (s.length > 32 && s[0] === 0) s = s.slice(1)
  const rPad = new Uint8Array(32); rPad.set(r, 32 - r.length)
  const sPad = new Uint8Array(32); sPad.set(s, 32 - s.length)

  const p1363 = new Uint8Array(64)
  p1363.set(rPad, 0)
  p1363.set(sPad, 32)
  return p1363
}

export async function verifySignatureV1(
  anchorRecordHex: string,
  signatureInput: string,
  publicKeyB64: string
): Promise<VerifyResult> {
  try {
    const pubKeyDer = base64ToBytes(publicKeyB64)
    const key = await crypto.subtle.importKey(
      'spki', pubKeyDer.buffer as ArrayBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['verify']
    )

    // Detect signature format: base64 or hex
    let sigBytes: Uint8Array
    if (isBase64(signatureInput)) {
      sigBytes = base64ToBytes(signatureInput)
    } else {
      sigBytes = hexToBytes(signatureInput)
    }

    // Convert DER to P1363 if needed (Web Crypto requires P1363 = 64 bytes)
    if (sigBytes.length !== 64) {
      const converted = derToP1363(sigBytes)
      if (converted) sigBytes = converted
      else return { status: 'error', detail: '서명 형식 변환 실패 (DER→P1363)' }
    }

    // Sign target = UTF-8 encoded hex string of anchor_record
    const messageBytes = new TextEncoder().encode(anchorRecordHex)
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key, sigBytes.buffer as ArrayBuffer, messageBytes.buffer as ArrayBuffer
    )

    return {
      status: valid ? 'pass' : 'fail',
      detail: valid ? 'EC P-256 서명 검증 통과' : '서명 불일치 — 변조 또는 다른 키로 서명됨',
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', detail: `서명 검증 오류: ${msg}` }
  }
}

// ─── V2: Hash Chain Continuity Verification ─────────────────
export async function verifyChainV2(events: ChainEvent[]): Promise<V2Result> {
  if (!events || events.length === 0) {
    return { status: 'fail', detail: '체인 이벤트 없음' }
  }

  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  let gaps = 0, captures = 0, continuityCount = 0, blanks = 0
  let firstTs: string | null = null
  let lastTs: string | null = null

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]
    const evType = ev.event_type

    if (evType === 'capture') captures++
    else if (evType === 'continuity') continuityCount++
    else if (evType === 'blank') blanks++
    else if (evType === 'gap') gaps++

    const ts = ev.ts_utc_raw || ev.ts_utc
    if (i === 0) firstTs = ts
    lastTs = ts

    // Genesis: prev_hash must be all zeros
    if (i === 0 && evType === 'genesis') {
      const prevHash = normalizeHex(ev.prev_hash)
      if (prevHash !== '0'.repeat(64)) {
        return { status: 'fail', detail: `genesis prev_hash가 영이 아님 (seq=${ev.seq})` }
      }
    }

    // Chain link: prev_hash must equal previous event's chain_hash
    if (i > 0) {
      const expectedPrev = normalizeHex(sorted[i - 1].chain_hash)
      const actualPrev = normalizeHex(ev.prev_hash)
      if (expectedPrev !== actualPrev) {
        return { status: 'fail', detail: `해시체인 끊김 — seq=${ev.seq}의 prev_hash 불일치` }
      }
    }

    // Verify chain_hash = SHA256(prev || payload || seq || ts)
    const prevHash = normalizeHex(ev.prev_hash)
    const payloadHash = normalizeHex(ev.payload_hash)
    const tsForHash = ev.ts_utc_raw || ev.ts_utc
    const preimage = `${prevHash}${payloadHash}${ev.seq}${tsForHash}`
    const expectedChainHash = await sha256Hex(preimage)
    const actualChainHash = normalizeHex(ev.chain_hash)

    if (expectedChainHash !== actualChainHash) {
      return { status: 'fail', detail: `chain_hash 불일치 — seq=${ev.seq} (${evType})` }
    }
  }

  return {
    status: 'pass',
    detail: `${sorted.length}개 이벤트, ${gaps}개 갭, 체인 무결성 통과`,
    summary: {
      total_events: sorted.length,
      captures,
      continuity_records: continuityCount,
      gaps,
      blanks,
      started_at: firstTs,
      ended_at: lastTs,
    },
  }
}

// ─── V3: EAS On-Chain Verification (ethers.js 없이 JSON-RPC 직접 호출) ──
export async function verifyOnChainV3(easUid: string): Promise<VerifyResult> {
  if (!easUid) return { status: 'pending', detail: '앵커링 대기 중' }

  try {
    // getAttestation(bytes32) selector = 0xa3112a64
    const uidClean = easUid.startsWith('0x') ? easUid.slice(2) : easUid
    const calldata = '0xa3112a64' + uidClean.padStart(64, '0')

    const response = await fetch(SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: EAS_CONTRACT, data: calldata }, 'latest'],
      }),
    })

    const result = await response.json()
    if (result.error) {
      return { status: 'error', detail: `RPC 오류: ${result.error.message}` }
    }

    const data = result.result
    if (!data || data === '0x' || /^0x0+$/.test(data)) {
      return { status: 'fail', detail: '온체인 어테스테이션 미존재' }
    }

    return {
      status: 'pass',
      detail: '온체인 어테스테이션 확인됨 (Sepolia)',
      easscan_url: `${EASSCAN_BASE}/${easUid}`,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', detail: `온체인 조회 실패: ${msg}` }
  }
}

// ─── OT: Origin Tag + Anchor Record Recalculation ───────────
function tlvEncode(tag: number, value: Uint8Array): Uint8Array {
  const result = new Uint8Array(3 + value.length)
  result[0] = tag
  result[1] = (value.length >> 8) & 0xff
  result[2] = value.length & 0xff
  result.set(value, 3)
  return result
}

function uint64Bytes(val: number | bigint): Uint8Array {
  const buf = new Uint8Array(8)
  let n = BigInt(val)
  const MASK = BigInt(0xff)
  const SHIFT = BigInt(8)
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(n & MASK)
    n >>= SHIFT
  }
  return buf
}

export interface OTPreimage {
  eh: string
  f: string
  sh: string
  fpid: string
  pv: string
  ts: number
  ctr: number
  lh_prev: string
  sid: string
}

export async function verifyOT(
  originTag: string,
  anchorRecord: string,
  chainContinuityHash: string,
  preimage: OTPreimage
): Promise<VerifyResult> {
  try {
    const eh = hexToBytes(normalizeHex(preimage.eh))

    let fBytes: Uint8Array
    if (typeof preimage.f === 'string' && preimage.f.length > 0) {
      fBytes = isBase64(preimage.f) ? base64ToBytes(preimage.f) : hexToBytes(normalizeHex(preimage.f))
    } else {
      fBytes = new Uint8Array(32)
    }

    const sh = hexToBytes(normalizeHex(preimage.sh))
    const fpid = hexToBytes(normalizeHex(preimage.fpid))
    const pv = new TextEncoder().encode(preimage.pv || 'v1.0')
    const ts = uint64Bytes(preimage.ts)
    const ctr = uint64Bytes(preimage.ctr)
    const lh = hexToBytes(normalizeHex(preimage.lh_prev))
    const sid = hexToBytes(normalizeHex(preimage.sid))

    const tlvParts = [
      tlvEncode(0x01, eh), tlvEncode(0x02, fBytes), tlvEncode(0x03, sh),
      tlvEncode(0x04, fpid), tlvEncode(0x05, pv), tlvEncode(0x06, ts),
      tlvEncode(0x07, ctr), tlvEncode(0x08, lh), tlvEncode(0x09, sid),
    ]

    const totalLen = tlvParts.reduce((sum, p) => sum + p.length, 0)
    const tlvBytes = new Uint8Array(totalLen)
    let offset = 0
    for (const part of tlvParts) { tlvBytes.set(part, offset); offset += part.length }

    // OT = SHA256(hex(tlvBytes)) — ADR-018 공식
    const otRecalc = await sha256Hex(bytesToHex(tlvBytes))
    const storedOT = normalizeHex(originTag)

    if (otRecalc !== storedOT) {
      return { status: 'fail', detail: 'Origin Tag 불일치 — 데이터 변조 의심' }
    }

    // anchor_record = SHA256(hex('OS_V1') || OT || CCH)
    const prefix = bytesToHex(new TextEncoder().encode('OS_V1'))
    const arPreimage = prefix + storedOT + normalizeHex(chainContinuityHash)
    const arRecalc = await sha256Hex(arPreimage)
    const storedAR = normalizeHex(anchorRecord)

    if (arRecalc !== storedAR) {
      return { status: 'fail', detail: 'Anchor Record 불일치 — 앵커 변조 의심' }
    }

    return { status: 'pass', detail: 'Origin Tag + Anchor Record 재계산 일치' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', detail: `OT 검증 오류: ${msg}` }
  }
}
