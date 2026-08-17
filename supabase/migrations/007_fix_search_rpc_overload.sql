-- ============================================================
-- えほんのあと 修復migration
-- 007_fix_search_rpc_overload.sql
-- ============================================================
-- 目的（diff_check.sql の結果にもとづく必要最小限の差分）:
--   (1)【最重要】search_books_by_state の重複を解消する。
--       現状 3引数版と 4引数版(p_season) の両方が存在し、アプリが3引数で呼ぶと
--       PostgRESTが関数を一意に決められず PGRST203 で失敗 → 検索が常に0件になる。
--       古い4引数版を削除し、3引数版だけに揃える。
--   (2) 3引数版を author・summary も返す版に更新（画面が読むため。003版は未返却）。
--   (3) 欠けている calendar_view を作成（006相当・表示専用）。
--
-- 安全性:
--   ・テーブルや行データは一切削除・変更しない（DROPするのは重複した「関数」だけ）。
--   ・child_states / books / book_state_links / practice_logs の中身は変更しない。
--   ・冪等。再実行しても壊れにくい。
-- ============================================================

-- ------------------------------------------------------------
-- (1)(2) 検索RPCを 3引数版1本に統一（author・summary を返す）
--   ※ drop対象は関数のみ。データには影響しない。
-- ------------------------------------------------------------
drop function if exists public.search_books_by_state(uuid, int, text, text);  -- 古い4引数版を除去
drop function if exists public.search_books_by_state(uuid, int, text);        -- 3引数版を作り直すため一旦除去

create function public.search_books_by_state(
  p_state_id  uuid,
  p_age_group int  default null,
  p_scene     text default null
)
returns table (
  book_id           uuid,
  title             text,
  author            text,
  summary           text,
  age_min           int,
  age_max           int,
  scenes            text[],
  next_activities   text,
  care_points       text,
  has_practice_log  boolean,
  has_care_points   boolean,
  has_avoid_context boolean,
  post_states_pred  text[],
  score             numeric
)
language sql stable security invoker set search_path = public as $$
  with candidates as (
    select
      b.id, b.title, b.author, b.summary, b.age_min, b.age_max,
      b.scenes, b.next_activities, b.care_points,
      (p_age_group is not null
        and (b.age_min is null or b.age_min <= p_age_group)
        and (b.age_max is null or b.age_max >= p_age_group)) as age_matched,
      (p_scene is not null and p_scene = any (b.scenes))      as scene_matched
    from public.book_state_links l
    join public.books b on b.id = l.book_id
    where l.state_id = p_state_id
      and l.relation = 'pre'
      and b.is_active = true
      and not exists (
        select 1 from public.book_state_links a
        where a.book_id = b.id and a.state_id = p_state_id and a.relation = 'avoid'
      )
      and (
        p_age_group is null
        or ((b.age_min is null or b.age_min <= p_age_group)
            and (b.age_max is null or b.age_max >= p_age_group))
      )
      and (
        p_scene is null or cardinality(b.scenes) = 0 or p_scene = any (b.scenes)
      )
  ),
  enriched as (
    select c.*,
      exists (select 1 from public.practice_logs pl where pl.book_id = c.id) as has_practice_log,
      (c.care_points is not null and length(trim(c.care_points)) > 0) as has_care_points,
      exists (
        select 1 from public.book_state_links a2
        where a2.book_id = c.id and a2.relation = 'avoid' and a2.state_id <> p_state_id
      ) as has_avoid_context,
      coalesce((
        select array_agg(cs.name order by cs.name)
        from public.book_state_links pp
        join public.child_states cs on cs.id = pp.state_id
        where pp.book_id = c.id and pp.relation = 'post_pred' and cs.is_active = true
      ), '{}') as post_states_pred
    from candidates c
  )
  select
    e.id, e.title, e.author, e.summary, e.age_min, e.age_max,
    e.scenes, e.next_activities, e.care_points,
    e.has_practice_log, e.has_care_points, e.has_avoid_context, e.post_states_pred,
    (1.0
      + case when e.has_practice_log then 0.5 else 0 end
      + case when e.has_care_points  then 0.3 else 0 end
      + case when e.age_matched      then 0.2 else 0 end
      + case when e.scene_matched    then 0.2 else 0 end
    )::numeric(4,2) as score
  from enriched e
  order by score desc, e.title asc;
$$;

grant execute on function public.search_books_by_state(uuid, int, text) to anon, authenticated;

-- ------------------------------------------------------------
-- (3) 欠けている calendar_view を作成（006相当・表示専用・本人のデータのみ）
-- ------------------------------------------------------------
create or replace view public.calendar_view with (security_invoker = true) as
select ('log-'  || l.id)::text as entry_id, 'practice_log'::text as entry_type,
       l.read_date as entry_date, b.title as title, l.class_name as class_name,
       null::text as status, l.id as log_id, null::uuid as plan_id
from public.practice_logs l join public.books b on b.id = l.book_id
union all
select ('plan-' || p.id)::text, 'activity_plan'::text,
       p.scheduled_date, p.title, null::text,
       p.status, p.done_log_id, p.id
from public.activity_plans p where p.scheduled_date is not null;

revoke all on public.calendar_view from public, anon, authenticated;
grant select on public.calendar_view to authenticated;

-- ============================================================
-- 完了。実行後は次で確認できます:
--   select * from public.search_books_by_state('11111111-0000-0000-0000-000000000001');
--   → 1冊以上返れば検索は復旧。0件なら seed/pre リンクのデータ確認へ。
-- ============================================================
