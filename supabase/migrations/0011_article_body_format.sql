-- =============================================================================
-- 0011_article_body_format.sql
-- Records how each article body was authored so the rich text editor's HTML
-- and legacy Markdown content can coexist without guessing.
--
-- Additive and non-destructive. Existing rows default to 'markdown', which is
-- exactly how they were being rendered before this migration, so no article
-- changes appearance. `body_html` remains the sanitised HTML the public site
-- renders, whichever format produced it.
-- =============================================================================

alter table public.articles
  add column if not exists body_format text not null default 'markdown';

alter table public.articles
  drop constraint if exists articles_body_format_check;

alter table public.articles
  add constraint articles_body_format_check
  check (body_format in ('markdown', 'html'));

comment on column public.articles.body_format is
  'Authoring format of the body: ''markdown'' (legacy) or ''html'' (rich text '
  'editor). body_html always holds the sanitised HTML rendered publicly.';
