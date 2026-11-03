import { adminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/require-role'

/** GET /api/admin/document-templates — list all templates */
export async function GET(request: Request) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'admin' && ctx.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error: dbErr } = await adminClient
    .from('document_requirement_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data ?? [])
}

/** POST /api/admin/document-templates — create a template */
export async function POST(request: Request) {
  const { ctx, error } = await requireAuth(request)
  if (error) return error
  if (ctx.role !== 'admin' && ctx.role !== 'super_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, customer_type, jurisdiction, is_mandatory, sort_order } = body as Record<string, unknown>

  if (!name || typeof name !== 'string' || !name.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error: dbErr } = await adminClient
    .from('document_requirement_templates')
    .insert({
      name: (name as string).trim(),
      description: description ?? null,
      customer_type: customer_type || null,
      jurisdiction: jurisdiction || null,
      is_mandatory: is_mandatory !== false,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
      created_by: ctx.userId,
    })
    .select()
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
