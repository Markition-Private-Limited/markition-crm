# Workflow Engine

The CRM now has a reusable workflow layer under `src/lib/workflows`.

What it provides:

- `getWorkflow(module)` to inspect the registry definition.
- `getStatusList(module)` and `getNextStatuses(module, status)` for UI and validation.
- `canTransition(module, from, to)` for transition checks.
- `transition(module, id, from, to, options)` to validate, execute, and emit history/activity hooks.
- `isFinalState(module, status)` and `isEditable(module, status)` for UI gating.

The shared UI layer lives in `components/workflow`:

- `WorkflowStatusBadge`
- `WorkflowTimeline`
- `WorkflowStatusDropdown`
- `WorkflowTransitionConfirmationModal`
- `WorkflowHistoryPanel`

Registry seeds currently cover:

- Companies
- Contacts
- Leads
- Quotations
- Contracts
- Projects
- Tasks
- Invoices
- Support Tickets
- Custom modules

The engine is intentionally additive. Existing CRM modules continue to work unchanged until they are migrated one by one.
