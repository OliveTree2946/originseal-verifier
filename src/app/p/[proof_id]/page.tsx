import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ProofCard from './ProofCard'

export const revalidate = 0

interface Props {
  params: Promise<{ proof_id: string }>
}

export default async function ProofPage(props: Props) {
  const params = await props.params;
  const { proof_id } = params

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(proof_id)) notFound()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // 1. 서버 proof-verify API 호출
  let serverVerification = null
  try {
    const verifyRes = await fetch(
      `${supabaseUrl}/functions/v1/proof-verify?proof_id=${proof_id}`,
      { headers: { Authorization: `Bearer ${supabaseKey}` }, cache: 'no-store' }
    )
    if (verifyRes.ok) serverVerification = await verifyRes.json()
  } catch { /* 서버 실패해도 클라이언트 독립 검증으로 보완 */ }

  // 2. proofs 테이블 원본 데이터
  const { data: proof } = await supabase
    .from('proofs')
    .select('*')
    .eq('proof_id', proof_id)
    .single()

  if (!proof && !serverVerification) notFound()

  // 3. chain_events (V2 검증용)
  let chainEvents = null
  if (proof?.session_id) {
    const { data } = await supabase
      .from('chain_events_server')
      .select('*')
      .eq('session_id', proof.session_id)
      .order('seq', { ascending: true })
    chainEvents = data
  }

  return (
    <ProofCard
      proofId={proof_id}
      proof={proof}
      serverVerification={serverVerification}
      chainEvents={chainEvents}
    />
  )
}
