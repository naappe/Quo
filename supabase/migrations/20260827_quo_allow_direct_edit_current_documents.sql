-- Edit now updates the current Quotation / Proforma / Invoice directly.
-- Revision lineage metadata remains protected and can only be changed by the controlled revision workflow.

create or replace function public.quo_guard_issued_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then return new; end if;

  if (
      new.revision_root_id is distinct from old.revision_root_id
      or new.revision_no is distinct from old.revision_no
      or new.supersedes_document_id is distinct from old.supersedes_document_id
      or new.superseded_by_id is distinct from old.superseded_by_id
      or new.amendment_reason is distinct from old.amendment_reason
      or new.void_reason is distinct from old.void_reason
     )
     and coalesce(current_setting('quo.allow_document_revision',true),'0') <> '1' then
    raise exception 'Revision metadata is managed by the Quo document workflow';
  end if;

  -- Commercial content is intentionally editable on the current document.
  -- Receipt/payment integrity and workflow state are protected by their dedicated guards.
  return new;
end;
$$;
