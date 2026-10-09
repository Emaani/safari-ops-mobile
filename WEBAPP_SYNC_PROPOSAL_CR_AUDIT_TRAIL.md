# PROPOSAL — Cash Requisition Audit Trail (requires web-team review before applying)

**Status: NOT APPLIED. This is a proposal, not a migration that has been run.**

Mobile does **not** define or run schema changes against shared tables unilaterally —
that caused real breakage earlier (mobile guessed the `update_cr_status` RPC
signature and had to delete/redo the work once the real server contract
arrived). This document exists so the web team can review, adjust, and apply
the change on their own schedule, with mobile's RPC calls updated to match
whatever is actually decided.

## Why

The mobile Cash Requisition approval UI now renders an audit timeline
(`src/components/finance/TransactionDetailModal.tsx`, `AuditStep`) showing
Submitted → Approved/Declined/Cancelled → Completed. Two of those steps are
currently thinner than they should be because the underlying columns don't
exist:

- **Declined**: shows the `declined_at` timestamp (this column already
  exists), but not *why* — the approver's decline reason is collected in the
  UI (`TransactionDetailModal`'s decline flow) and sent as RPC param
  `p_reason` to `update_cr_status`, but nothing persists it anywhere, so it's
  silently discarded server-side today. Neither mobile nor the web dashboard
  can show "why was this declined" after the fact.
- **Cancelled**: shows the status badge only, with no timestamp at all —
  there is no `cancelled_at` column, so we can't say *when* a CR was
  cancelled, only that it currently is.

## Proposed schema change

```sql
-- Run by the web team against the shared Supabase project, not by mobile.
ALTER TABLE cash_requisitions
  ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS cancel_reason  text;
```

And the corresponding change inside whatever version of `update_cr_status`
the web team maintains: when `p_status = 'Declined'`/`'Rejected'`, persist
the incoming `p_reason` (or `p_notes`, whichever param the real signature
uses for this) into `decline_reason`; when `p_status = 'Cancelled'`, set
`cancelled_at = now()` and persist the reason into `cancel_reason`.

**Mobile is already sending a reason/notes string on every decline and
cancel action** (`useCashRequisitionStatus.ts`, call sites in
`TransactionDetailModal.tsx`) — this proposal only asks that the existing
RPC start keeping what it's already being handed, not that mobile change
what it sends.

## What mobile will do once this ships

- Display `decline_reason` / `cancel_reason` in the `AuditStep` sublabel,
  same place the approver's name already shows for "Approved".
- Display `cancelled_at` as the Cancelled step's timestamp.
- No RPC call signature changes needed on mobile's side *unless* the web
  team decides the reason should go through a new/renamed param — if so,
  mobile needs the exact new signature before changing anything (see the
  `update_cr_status` lesson above).

## What NOT to do

Do not let mobile guess at this. If the web team ships a different shape
(e.g. a separate `cr_status_history` table instead of columns on
`cash_requisitions`), send mobile the real schema/RPC signature and this
proposal gets revised to match — not implemented speculatively.
