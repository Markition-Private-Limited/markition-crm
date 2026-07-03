# Workflow Migration Notes

This repository currently keeps the live module screens unchanged.

Recommended migration order for future work:

1. Route any new module status mutations through `transition(module, id, from, to)`.
2. Use `WorkflowStatusBadge` and `WorkflowTimeline` instead of duplicating status chips and history layouts.
3. For modules with existing `status` or `stage` fields, keep the field name in the registry and let the engine validate transitions.
4. When the `workflow_history` and `workflow_events` tables are available in Supabase, the persistence hooks can begin recording transition history automatically.

Important constraints:

- Do not hardcode new transition rules inside module screens.
- Keep module-specific UI intact until a workflow migration is explicitly requested.
- Treat `Companies` and `Contacts` as open workflows for now; they may use freeform status strings.
