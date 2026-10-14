import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager', 'sales'])
  if (error) return error

  const url = new URL(request.url)
  const companyId = url.searchParams.get('company_id')
  const prospectId = url.searchParams.get('prospect_id')
  const status = url.searchParams.get('status')

  let query = adminClient
    .from('clients')
    .select('*, companies(id, name), prospects:source_prospect_id(id, name, notes)')
    .order('created_at', { ascending: false })

  if (companyId) query = query.eq('company_id', companyId)
  if (prospectId) query = query.eq('source_prospect_id', prospectId)
  if (status) query = query.eq('status', status)

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}
