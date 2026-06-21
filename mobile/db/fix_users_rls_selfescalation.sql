-- SECURITY FIX — privilege self-escalation via the users table.
--
-- Found 2026-06-18 while wiring admin-panel E2E: an ordinary authenticated user
-- can promote themselves to admin straight from the browser with the anon key:
--
--   PATCH /rest/v1/users?id=eq.<own-id>   body: {"user_type":"admin"}
--
-- It succeeded on staging. The users UPDATE RLS policy authorizes the row by
-- ownership (auth.uid() = id) but does NOT restrict which columns may change,
-- so user_type / reputation_score / credibility_level are all self-writable.
-- Since the admin gate (and admin write paths) key off user_type, this is a
-- full privilege escalation. See [[project_security_reliability_todo]].
--
-- RLS WITH CHECK cannot reference OLD, so column-level protection is enforced
-- with a BEFORE UPDATE trigger instead. Idempotent.
--
-- The discriminator is current_user (the Postgres role), NOT auth.role() (a JWT
-- claim). A direct end-user PostgREST write runs as role 'authenticated'; the
-- reputation triggers (private.update_user_reputation, SECURITY DEFINER) run as
-- their owner; the service key runs as 'service_role'. auth.role() would read
-- 'authenticated' even inside the reputation trigger and wrongly block it.
--
-- This function MUST be SECURITY INVOKER (the default) — a SECURITY DEFINER
-- function would see current_user as its own owner and the check would never
-- fire for direct writes.

create or replace function public.prevent_privilege_self_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller_type text;
begin
  -- Only guard the privileged columns; ordinary profile edits pass through.
  if new.user_type is distinct from old.user_type
     or new.reputation_score is distinct from old.reputation_score
     or new.credibility_level is distinct from old.credibility_level then

    -- Only police direct end-user writes (role 'authenticated'). SECURITY
    -- DEFINER reputation triggers (run as their owner) and service_role are
    -- exempt, so legitimate reputation accrual and admin tooling keep working.
    if current_user = 'authenticated' then
      select user_type into caller_type from public.users where id = auth.uid();
      if coalesce(caller_type, '') <> 'admin' then
        raise exception
          'not authorized to modify privileged user fields (user_type / reputation_score / credibility_level)';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_privilege_self_escalation on public.users;
create trigger trg_prevent_privilege_self_escalation
  before update on public.users
  for each row execute function public.prevent_privilege_self_escalation();

-- After applying, the PATCH above must fail for a normal user. The admin
-- panel's own updateUserType still works because it runs as an admin JWT.
-- NOTE: reputation_score is normally bumped by server-side/trigger logic
-- (service_role), which stays exempt; if any client path legitimately writes
-- reputation as the user, move that to an RPC / service path before applying.
