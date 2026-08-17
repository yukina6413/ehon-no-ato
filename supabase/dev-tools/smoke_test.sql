-- ============================================================
-- えほんのあと DBスモークテスト（SELECTのみ・データ非変更）
-- smoke_test.sql
-- ============================================================
-- 使い方: 000_complete_mvp_setup.sql を実行したあと、
--   このファイルを Supabase SQL Editor に貼って Run する。
--   各セクションの「expected（期待値）」と結果を見比べる。
-- 注意: SQL Editor は RLS を迂回する管理ロールで動くため、
--   ⑩のRLS確認は「ポリシー定義」を見る形にしている（実効の可否は定義から判断）。
-- ============================================================

-- ① 必要なテーブル・ビューがすべて存在するか（expected: 9行 = missing が無い）
select t.expected_name,
       case when c.relname is null then '❌ MISSING' else '✅ ok' end as status
from (values
  ('child_states'),('books'),('book_state_links'),
  ('practice_logs'),('practice_log_states'),('ai_reports'),
  ('activity_plans'),('profiles'),('calendar_view')
) as t(expected_name)
left join pg_class c
  on c.relname = t.expected_name
 and c.relnamespace = 'public'::regnamespace
order by status desc, t.expected_name;

-- ② 記録保存に必要な practice_logs の列が存在するか
--    （expected: 下記すべて ✅。savePracticeLog が insert する列）
select col.expected_col,
       case when c.column_name is null then '❌ MISSING' else '✅ ok' end as status
from (values
  ('user_id'),('book_id'),('read_date'),('age_group'),('scene'),
  ('reaction'),('memo'),('interest_tags'),('next_ideas')
) as col(expected_col)
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = 'practice_logs'
 and c.column_name = col.expected_col
order by status desc, col.expected_col;

-- ③ 各マスタの件数（expected: child_states>=14, books>=4, book_state_links>=20）
select 'child_states' as tbl, count(*) as rows from public.child_states
union all select 'books', count(*) from public.books
union all select 'book_state_links', count(*) from public.book_state_links;

-- ④ relation の内訳（expected: pre が十分な件数あり、post_pred/avoid も存在）
select relation, count(*) as rows
from public.book_state_links
group by relation
order by relation;

-- ⑤ 孤立リンクチェック（expected: 両方とも 0）
select
  count(*) filter (where cs.id is null) as orphan_state_links,
  count(*) filter (where b.id  is null) as orphan_book_links
from public.book_state_links l
left join public.child_states cs on cs.id = l.state_id
left join public.books        b  on b.id = l.book_id;

-- ⑥ 子どもの姿ごとの検索ヒット数（RPCを実際に呼ぶ／RLS迂回でデータ・ロジック検証）
--    expected: 11語前後が hits>=1。0件は該当本なしの意図的な姿（怖い話/死/体を動かす等）
select cs.name,
       (select count(*) from public.search_books_by_state(cs.id)) as hits
from public.child_states cs
order by hits desc, cs.sort_order;

-- ⑦ 「1冊以上出る」保証の代表確認（expected: それぞれ 1 以上）
select
  (select count(*) from public.search_books_by_state('11111111-0000-0000-0000-000000000001')) as 貸し借り,
  (select count(*) from public.search_books_by_state('11111111-0000-0000-0000-000000000004')) as 食べ物興味,
  (select count(*) from public.search_books_by_state('11111111-0000-0000-0000-000000000006')) as 虫を探す,
  (select count(*) from public.search_books_by_state('11111111-0000-0000-0000-000000000009')) as 午睡前;

-- ⑧ avoid が効いているか（午睡前ではぐりとぐらが除外される）
--    expected: ぐりとぐら(…002) が結果に含まれない = 0
select count(*) as guri_in_nap_results
from public.search_books_by_state('11111111-0000-0000-0000-000000000009')
where book_id = '22222222-0000-0000-0000-000000000002';

-- ⑨ ID型の一致確認（expected: すべて uuid）
select 'child_states.id' as col, data_type from information_schema.columns
  where table_schema='public' and table_name='child_states' and column_name='id'
union all
select 'books.id', data_type from information_schema.columns
  where table_schema='public' and table_name='books' and column_name='id'
union all
select 'book_state_links.state_id', data_type from information_schema.columns
  where table_schema='public' and table_name='book_state_links' and column_name='state_id'
union all
select 'book_state_links.book_id', data_type from information_schema.columns
  where table_schema='public' and table_name='book_state_links' and column_name='book_id';

-- ⑩ RLSがアプリ利用と矛盾しないか（ポリシー定義の確認）
--    expected:
--      ・child_states / books / book_state_links の SELECT に {anon,authenticated}
--        → ログイン前でも検索できる
--      ・practice_logs は {authenticated} のみ（本人の記録だけ）
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('child_states','books','book_state_links','practice_logs')
order by tablename, policyname;

-- ⑪ 検索RPCが anon/authenticated に実行付与されているか（expected: 2ロール分）
select r.grantee, r.privilege_type
from information_schema.routine_privileges r
join information_schema.routines ro
  on ro.specific_name = r.specific_name
where ro.routine_schema = 'public'
  and ro.routine_name = 'search_books_by_state'
  and r.grantee in ('anon','authenticated')
order by r.grantee;
