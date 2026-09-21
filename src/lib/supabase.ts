import { createClient } from "@supabase/supabase-js";

/**
 * ログ用のSupabaseクライアント。未設定の場合はnullを返し、
 * 呼び出し側(log.ts)がログをスキップしてアプリを止めないようにする。
 */
export function createLogClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
