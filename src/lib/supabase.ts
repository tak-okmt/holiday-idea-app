import { createClient } from "@supabase/supabase-js";

/**
 * ログ用のSupabaseクライアント。未設定の場合はnullを返し、
 * 呼び出し側(log.ts)がログをスキップしてアプリを止めないようにする。
 *
 * サーバー側だが、あえてPublishable key(旧anon keyの後継、anonロール)を使う。
 * Secret key(旧service_role、RLSを無視する管理者キー)は使わない。
 * このアプリのSupabase利用はログのINSERTのみで読み取り・更新・削除は行わないため、
 * RLSで「anonロールはINSERTのみ許可」に制限しておくことで、万一キーが漏れても
 * 書き込みしかできない(閲覧・改ざん不可)状態を保てる。管理画面など読み取りが
 * 必要な機能を追加するときはSecret keyへの切り替えを検討する。
 */
export function createLogClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
