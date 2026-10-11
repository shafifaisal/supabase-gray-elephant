-- =============================================================================
-- 0010_fix_author_self_publish.sql
--
-- VULNERABILITY
-- -------------
-- Policy "articles_update_authorized" used can_edit_article(id) in BOTH its
-- USING and WITH CHECK clauses. can_edit_article is SECURITY DEFINER and
-- contains:
--
--     exists (select 1 from public.articles a
--             where a.id = _article_id
--               and a.author_id = auth.uid()
--               and a.status in ('draft','in_review'))
--
-- During an UPDATE, PostgreSQL evaluates the RLS WITH CHECK against the
-- *candidate* tuple, but a plain SELECT executed inside that check runs under
-- the calling command's snapshot — which does NOT yet include the row's own
-- new version. The function therefore observed status = 'draft' (the old
-- value) and returned true, so the WITH CHECK passed.
--
-- Net effect: an author could set their own draft to status='published' and
-- publish content to the public site, bypassing editorial review entirely.
--
-- Confirmed by scripts/verify-auth.mjs before this migration.
--
-- FIX
-- ---
-- Replace the function-based check with direct column references in the policy.
-- A bare column reference in WITH CHECK is evaluated against the candidate
-- row, so an author's new status is genuinely constrained to draft/in_review.
-- Editorial actions (publish/schedule/archive) remain editor/admin-only.
-- =============================================================================

drop policy if exists "articles_update_authorized" on public.articles;

create policy "articles_update_authorized"
  on public.articles for update
  using (
    -- USING sees the OLD row: editors may touch anything, authors only their
    -- own work while it is still an unpublished draft.
    public.is_editor()
    or (author_id = auth.uid() and status in ('draft', 'in_review'))
  )
  with check (
    -- WITH CHECK sees the NEW row: an author may never move content into a
    -- publicly visible state. Publishing is an editor/admin action.
    public.is_editor()
    or (author_id = auth.uid() and status in ('draft', 'in_review'))
  );

-- Belt and braces: an author must not be able to hand their article to
-- another account, or tamper with review metadata.
create or replace function public.guard_article_authorship()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only non-editors are constrained here; editors legitimately reassign.
  if not public.is_editor() then
    if new.author_id is distinct from old.author_id then
      raise exception 'Only editors may reassign article authorship'
        using errcode = '42501';
    end if;

    if new.is_noindex is distinct from old.is_noindex then
      raise exception 'Only editors may change indexing directives'
        using errcode = '42501';
    end if;

    if new.published_at is distinct from old.published_at then
      raise exception 'Only editors may set a publication date'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists articles_guard_authorship on public.articles;
create trigger articles_guard_authorship
  before update on public.articles
  for each row execute function public.guard_article_authorship();

revoke all on function public.guard_article_authorship() from public, anon;
grant execute on function public.guard_article_authorship() to authenticated;

-- ---------------------------------------------------------------------------
-- Regression-proof the invariant in the database itself, so a future policy
-- edit cannot silently reintroduce author-led publishing.
-- ---------------------------------------------------------------------------
create or replace function public.assert_publish_requires_editor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Transitioning INTO a publicly visible state requires an editor.
  if new.status in ('published', 'scheduled')
     and old.status is distinct from new.status
     and not public.is_editor() then
    raise exception
      'Publishing requires an editor or administrator role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists articles_guard_publish on public.articles;
create trigger articles_guard_publish
  before update on public.articles
  for each row execute function public.assert_publish_requires_editor();

revoke all on function public.assert_publish_requires_editor() from public, anon;
grant execute on function public.assert_publish_requires_editor() to authenticated;