import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const url = new URL(request.url)
  const companyId = url.searchParams.get('company_id')

  let query = adminClient.from('contacts').select('*').order('created_at', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const body = await request.json()
  const { company_id, first_name, last_name, email, phone, title, is_primary } = body
  if (!company_id) return Response.json({ error: 'company_id is required' }, { status: 400 })
  if (!first_name) return Response.json({ error: 'first_name is required' }, { status: 400 })

  if (is_primary) {
    await adminClient
      .from('contacts')
      .update({ is_primary: false })
      .eq('company_id', company_id)
      .eq('is_primary', true)
  }

  const insertData: Record<string, unknown> = {
    company_id,
    first_name,
    is_primary: is_primary ?? false,
  }
  if (last_name !== undefined && last_name !== '') insertData.last_name = last_name
  if (email !== undefined && email !== '') insertData.email = email
  if (phone !== undefined && phone !== '') insertData.phone = phone
  if (title !== undefined && title !== '') insertData.title = title

  const { data, error: dbErr } = await adminClient
    .from('contacts')
    .insert(insertData)
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}
