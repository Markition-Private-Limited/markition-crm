import { adminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/require-role'

export async function GET(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin', 'project_manager', 'sales'])
  if (error) return error

  const { data, error: dbErr } = await adminClient
    .from('service_categories')
    .select('*')
    .order('name')

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const { ctx, error } = await requireRole(request, ['admin'])
  if (error) return error

  const body = await request.json()
  const { name, description } = body
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })

  const { data, error: dbErr } = await adminClient
    .from('service_categories')
    .insert({ name, description, created_by: ctx.userId })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}
