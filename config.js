// ブラウザに公開される値のみを入れる。service_role キーは絶対に入れないこと。
window.MEMO_CONFIG = {
  supabaseUrl: 'https://kxxiphbpeaeuiwqmjskn.supabase.co',
  supabaseKey: 'sb_publishable_sxXnHpSBZu7pab_sAUv3Dg_VRr6xUCh',
  ownerEmail: 'memo-owner@example.com',
  passwordPrefix: 'memo-', // Supabase の最小文字数（6文字）を満たすため、入力値の前に付ける。
};
