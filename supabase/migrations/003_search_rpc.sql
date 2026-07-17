-- ============================================================
-- えほんのあと 検索RPC
-- 003_search_rpc.sql
-- 002_seed_data.sql 実行後に Supabase SQL Editor で実行
-- ============================================================
-- 検索ロジック:
--  1. 選択された state_id に relation='pre' の絵本を候補にする
--  2. 同じ state_id に relation='avoid' がある絵本は完全に除外する
--  3. has_practice_log   … その絵本に自分の実践記録が1件以上ある
--     （security invoker + RLS により「自分の記録」だけがカウント対象。
--       他ユーザーの記録は見えない設計）
--  4. has_care_points    … books.care_points が空でない
--  5. has_avoid_context  … 別の子どもの姿に対して avoid リンクがある
--     （画面では「配慮あり」等のやわらかい表現に変換して表示する）
-- ============================================================

create or replace function public.search_books_by_state(
  p_state_id  uuid,
  p_age_group int  default null,
  p_scene     text default null
)
returns table (
  book_id           uuid,
  title             text,
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
language sql
stable
security invoker
set search_path = public
as $$
  with candidates as (
    select
      b.id,
      b.title,
      b.age_min,
      b.age_max,
      b.scenes,
      b.next_activities,
      b.care_points,
      -- 年齢・場面の一致（スコア加点用）
      (p_age_group is not null
        and (b.age_min is null or b.age_min <= p_age_group)
        and (b.age_max is null or b.age_max >= p_age_group)) as age_matched,
      (p_scene is not null and p_scene = any (b.scenes))      as scene_matched
    from public.book_state_links l
    join public.books b on b.id = l.book_id
    where l.state_id = p_state_id
      and l.relation = 'pre'
      and b.is_active = true
      -- 同じ子どもの姿に avoid がある絵本は完全に除外
      and not exists (
        select 1
        from public.book_state_links a
        where a.book_id  = b.id
          and a.state_id = p_state_id
          and a.relation = 'avoid'
      )
      -- 年齢フィルタ（指定時のみ。範囲未設定の絵本は除外しない）
      and (
        p_age_group is null
        or (
          (b.age_min is null or b.age_min <= p_age_group)
          and (b.age_max is null or b.age_max >= p_age_group)
        )
      )
      -- 場面フィルタ（指定時のみ。scenes未設定の絵本は残す）
      and (
        p_scene is null
        or cardinality(b.scenes) = 0
        or p_scene = any (b.scenes)
      )
  ),
  enriched as (
    select
      c.*,
      exists (
        select 1 from public.practice_logs pl
        where pl.book_id = c.id
      ) as has_practice_log,       -- RLSにより「自分の記録」のみ対象
      (c.care_points is not null and length(trim(c.care_points)) > 0)
        as has_care_points,
      exists (
        select 1 from public.book_state_links a2
        where a2.book_id  = c.id
          and a2.relation = 'avoid'
          and a2.state_id <> p_state_id
      ) as has_avoid_context,
      coalesce(
        (
          select array_agg(cs.name order by cs.name)
          from public.book_state_links pp
          join public.child_states cs on cs.id = pp.state_id
          where pp.book_id  = c.id
            and pp.relation = 'post_pred'
            and cs.is_active = true
        ),
        '{}'
      ) as post_states_pred
    from candidates c
  )
  select
    e.id            as book_id,
    e.title,
    e.age_min,
    e.age_max,
    e.scenes,
    e.next_activities,
    e.care_points,
    e.has_practice_log,
    e.has_care_points,
    e.has_avoid_context,
    e.post_states_pred,
    (
      1.0
      + case when e.has_practice_log then 0.5 else 0 end   -- 実践実績を最重視
      + case when e.has_care_points  then 0.3 else 0 end   -- 配慮の手がかりがある
      + case when e.age_matched      then 0.2 else 0 end
      + case when e.scene_matched    then 0.2 else 0 end
    )::numeric(4,2) as score
  from enriched e
  order by score desc, e.title asc;
$$;

grant execute on function public.search_books_by_state(uuid, int, text) to authenticated;

-- 動作確認例（「貸し借りが難しい」）:
-- select * from public.search_books_by_state(
--   '11111111-0000-0000-0000-000000000001', 4, '活動の導入'
-- );
