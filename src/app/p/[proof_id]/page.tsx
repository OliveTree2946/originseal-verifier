import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ProofCard from './ProofCard'

export const revalidate = 30

interface Props {
  params: { proof_id: string }
}

export default async function ProofPage({ params }: Props) {
  const { proof_id } = params

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(proof_id)) notFound()

  const { data, error } = await supabase
    .from('proofs')
    .select('id, content_hash, anchor_record, eas_uid, tx_hash, status, created_at')
    .eq('id', proof_id)
    .single()

  if (error || !data) notFound()

  return <ProofCard proof={data} />
}
