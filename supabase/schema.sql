-- 休日アイデア提案アプリ: ログ保存用スキーマ (週末7)
-- ログインなしのMVPのため、匿名の session_id (クライアント側でcrypto.randomUUID()生成) で
-- 一連の操作を紐付ける。個人を特定できる情報(IP・氏名・メールなど)は保存しない。
--
-- 使い方: Supabaseダッシュボードの SQL Editor にこの内容を貼り付けて実行する。

create table if not exists sessions (
  session_id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(session_id),
  with_value text not null,
  energy text not null,
  time_value text not null,
  budget text not null,
  mood text,
  weather text,
  season text not null,
  created_at timestamptz not null default now()
);

create table if not exists suggestions (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(session_id),
  -- 0=最初の提案、1以降=「違うな」による再提案の回数
  round int not null,
  activity_id text not null,
  rank int not null,
  rule_score double precision not null,
  jev_score double precision,
  final_score double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists rejections (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(session_id),
  round int not null,
  activity_id text not null,
  -- money / hassle / been_there / not_in_mood / stay_home / not_interested のいずれか。
  -- 自由記述をJevが分類できなかった場合はnull(その場合もfree_textは残る)。
  reason text,
  -- 自由記述(その他)の場合、入力テキストとJevの分類結果も残す
  free_text text,
  classified_reason text,
  created_at timestamptz not null default now()
);

create table if not exists decisions (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(session_id),
  activity_id text not null,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;
alter table answers enable row level security;
alter table suggestions enable row level security;
alter table rejections enable row level security;
alter table decisions enable row level security;

-- anonキーからは INSERT のみ許可する(閲覧・更新・削除は不可)。
-- アプリはSupabaseの匿名キーでサーバー側(Server Actions)からのみ書き込む。
create policy "anon can insert sessions" on sessions for insert to anon with check (true);
create policy "anon can insert answers" on answers for insert to anon with check (true);
create policy "anon can insert suggestions" on suggestions for insert to anon with check (true);
create policy "anon can insert rejections" on rejections for insert to anon with check (true);
create policy "anon can insert decisions" on decisions for insert to anon with check (true);
