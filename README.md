# OriginSeal Verifier — 배포 가이드

Sprint 0 스켈레톤. `verify.originseal.io/p/{proof_id}`에서 증명 조회.

## 로컬 실행

```bash
cp .env.example .env.local
# .env.local에 실제 Supabase 키 입력

npm install
npm run dev
# http://localhost:3000
```

## Vercel 배포 (5분)

### 1. GitHub 업로드

```bash
cd originseal-verifier
git init
git add .
git commit -m "feat: Sprint 0 verifier skeleton"
git remote add origin https://github.com/<your-repo>/originseal-verifier.git
git push -u origin main
```

### 2. Vercel 연결

1. https://vercel.com → New Project
2. GitHub 레포 선택
3. Environment Variables 추가:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://cvjxaacjaybyqdjbbbum.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (핸드오프 문서의 Anon Key)
4. Deploy

### 3. 도메인 연결 (선택)

Vercel 대시보드 → Settings → Domains → `verify.originseal.io` 추가  
DNS: CNAME `verify` → `cname.vercel-dns.com`

---

## Supabase RLS 설정

proofs 테이블은 공개 읽기 가능해야 합니다:

```sql
-- Supabase SQL Editor에서 실행
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read proofs"
  ON proofs FOR SELECT
  USING (true);
```

---

## 현재 검증 범위 (Sprint 0)

| 항목 | 상태 | 구현 예정 |
|------|------|-----------|
| Supabase 데이터 조회 | ✅ | — |
| V3 EAS 링크 | ✅ | — |
| V5 철회 상태 | ✅ (status 필드) | — |
| V1 서명 검증 | — | Sprint 4 |
| V2 해시체인 연속성 | — | Sprint 2 |
| V4 ZK 증명 | — | Phase 2 |
| OT 재계산 | — | Sprint 7 |

---

## 검증 URL 예시

```
https://verify.originseal.io/p/ca6ebd74-e3b6-4614-88d3-7f669924e9ec
```
