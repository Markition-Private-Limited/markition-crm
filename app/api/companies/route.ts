import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'
import { logActivity } from '@/lib/activity'

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager', 'sales'])
  if (error) return error

  const url = new URL(request.url)
  const search = url.searchParams.get('search')

  let query = adminClient
    .from('companies')
    .select(`*, company_service_categories(service_category_id, service_categories(id, name))`)
    .order('name')

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error: dbErr } = await query
  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager'])
  if (error) return error

  const body = await request.json()
  const { name, industry, website, phone, address } = body
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })

  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const slug = `${baseSlug}-${Date.now()}`

  const { data, error: dbErr } = await adminClient
    .from('companies')
    .insert({ name, industry, website, phone, address, slug })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  await logActivity({ entityType: 'company', entityId: data.id, actorId: ctx.userId, action: 'created', newValue: data.name })
  return Response.json(data, { status: 201 })
}
