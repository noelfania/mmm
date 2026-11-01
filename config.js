// 브라우저에 공개되는 값만 넣는다. service_role 키는 절대 넣지 말 것.
window.MEMO_CONFIG = {
  supabaseUrl: 'https://kxxiphbpeaeuiwqmjskn.supabase.co',
  supabaseKey: 'sb_publishable_sxXnHpSBZu7pab_sAUv3Dg_VRr6xUCh',
  ownerEmail: 'memo-owner@example.com',
  passwordPrefix: 'memo-', // Supabase의 최소 길이(6자)를 맞추기 위해 입력값 앞에 붙인다.
};
