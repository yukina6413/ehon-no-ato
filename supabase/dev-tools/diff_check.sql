-- 現在のSupabaseとの差分確認（読み取り専用・堅牢版）
-- 特徴:
--   ・単一の SELECT 文（先頭は SELECT）。
--   ・INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/GRANT/REVOKE を含まない。
--   ・ユーザーテーブルを直接 SELECT しない。参照するのは常に存在する
--     カタログ（information_schema / pg_catalog / pg_policies）だけ。
--     → 対象テーブルが1つも無くても、この確認SQLは途中で停止しない。
--   ・結果は1つのグリッドに (section, item, result) で表示される。
-- 注記:
--   正確な件数・relation内訳・孤立リンク・姿ごとの検索ヒット数は、
--   テーブルを直接読む必要があり「欠損時に停止」してしまうため、この堅牢版には含めない。
--   件数は統計(reltuples)による概算で代替。正確なデータ確認は、構造がそろっていることを
--   本SQLで確認したあと smoke_test.sql（③⑥⑦⑩）で行う。
select * from (

  -- 01 必要なテーブル/ビューの有無
  select '01 テーブル存在' as section, t.name as item,
         case when c.relname is null then '❌ 無し' else '✅ 有り' end as result
  from (values ('child_states'),('books'),('book_state_links'),('practice_logs'),
               ('practice_log_states'),('ai_reports'),('activity_plans'),
               ('profiles'),('calendar_view')) t(name)
  left join pg_class c on c.relname = t.name and c.relnamespace = 'public'::regnamespace

  union all
  -- 02 記録保存に必要な practice_logs の列
  select '02 列存在(practice_logs)', col.name,
         case when x.column_name is null then '❌ 無し' else '✅ 有り' end
  from (values ('user_id'),('book_id'),('read_date'),('age_group'),('scene'),
               ('reaction'),('memo'),('interest_tags'),('next_ideas')) col(name)
  left join information_schema.columns x
    on x.table_schema='public' and x.table_name='practice_logs' and x.column_name=col.name

  union all
  -- 03 マスタ主要列
  select '03 列存在(マスタ)', m.tbl||'.'||m.col,
         case when x.column_name is null then '❌ 無し' else '✅ 有り' end
  from (values ('books','is_active'),('books','author'),('books','summary'),
               ('book_state_links','state_id'),('book_state_links','book_id'),
               ('book_state_links','relation'),
               ('child_states','name'),('child_states','is_active'),
               ('child_states','synonyms'),('child_states','related_themes')) m(tbl,col)
  left join information_schema.columns x
    on x.table_schema='public' and x.table_name=m.tbl and x.column_name=m.col

  union all
  -- 04 ID列の型（期待値: uuid）
  select '04 ID型', m.label,
         coalesce((select data_type from information_schema.columns
                   where table_schema='public' and table_name=m.tbl and column_name=m.col),
                  '❌ 無し')
  from (values ('child_states.id','child_states','id'),
               ('books.id','books','id'),
               ('book_state_links.state_id','book_state_links','state_id'),
               ('book_state_links.book_id','book_state_links','book_id'),
               ('practice_logs.book_id','practice_logs','book_id')) m(label,tbl,col)

  union all
  -- 05 件数概算（統計 reltuples。正確値は smoke_test.sql で確認）
  select '05 件数概算(統計)', t.name,
         case when c.relname is null then '❌ テーブル無し'
              when c.reltuples < 0 then '不明(未ANALYZE)'
              else '約'||c.reltuples::bigint||'行' end
  from (values ('child_states'),('books'),('book_state_links'),('practice_logs')) t(name)
  left join pg_class c on c.relname=t.name and c.relnamespace='public'::regnamespace

  union all
  -- 06 RLS有効/無効
  select '06 RLS有効', t.name,
         case when c.relname is null then '❌ テーブル無し'
              when c.relrowsecurity then 'RLS on' else 'RLS OFF' end
  from (values ('child_states'),('books'),('book_state_links'),('practice_logs')) t(name)
  left join pg_class c on c.relname=t.name and c.relnamespace='public'::regnamespace

  union all
  -- 07 RLSポリシー一覧（存在するものだけ表示。roles に anon が含まれるか）
  select '07 RLSポリシー', p.tablename||' / '||p.policyname,
         p.cmd||' → '||coalesce(array_to_string(p.roles::text[],','),'(none)')
  from pg_policies p
  where p.schemaname='public'
    and p.tablename in ('child_states','books','book_state_links','practice_logs')

  union all
  -- 08 anon読み取り可否（ログイン前に検索できるかの判定）
  select '08 anon読み取り可否', v.tbl,
         case when exists (select 1 from pg_policies p
                           where p.schemaname='public' and p.tablename=v.tbl
                             and p.cmd in ('SELECT','ALL')
                             and 'anon' = any(p.roles::text[]))
              then '✅ anonでSELECT可' else '❌ anon不可(ログイン前は読めない)' end
  from (values ('child_states'),('books'),('book_state_links')) v(tbl)

  union all
  -- 09 検索RPCのシグネチャ（期待値: uuid, integer, text の3引数。p_season無し）
  select '09 RPCシグネチャ', 'search_books_by_state',
         coalesce((select string_agg('('||pg_get_function_arguments(p.oid)||')', ' / ')
                   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                   where n.nspname='public' and p.proname='search_books_by_state'),
                  '❌ 関数が存在しない')

  union all
  -- 10 検索RPCの実行付与（期待値: anon と authenticated の両方に EXECUTE）
  select '10 RPC実行付与', g.role,
         coalesce((select string_agg(rp.privilege_type, ',')
                   from information_schema.routine_privileges rp
                   join information_schema.routines ro on ro.specific_name = rp.specific_name
                   where ro.routine_schema='public' and ro.routine_name='search_books_by_state'
                     and rp.grantee = g.role), '❌ 付与なし')
  from (values ('anon'),('authenticated')) g(role)

) d
order by section, item;
