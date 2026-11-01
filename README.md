# 마크다운 메모장

탭 방식의 마크다운 메모장입니다. 빌드 없는 정적 사이트이고, 메모는 Supabase에 저장합니다.

## Supabase 설정

1. SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)을 실행합니다.
2. Authentication → Users → Add user에서 사용자를 만듭니다.
   - 이메일: [config.js](config.js)의 `ownerEmail`
   - 비밀번호: `memo-` + 접속에 쓸 비밀번호
   - Auto Confirm User: 켜기
3. Authentication 설정에서 Allow new users to sign up을 끕니다.
4. Project Settings → API의 공개 키(anon 또는 publishable)를 [config.js](config.js)의 `supabaseKey`에 넣습니다. `service_role` 키는 넣으면 안 됩니다.

## 비밀번호

- 화면에서 입력한 값 앞에 `memo-`를 붙여 Supabase Auth에 보냅니다.
- 실제 비밀번호는 이 저장소에 적지 않습니다.
- 비밀번호를 잊으면 Authentication → Users에서 해당 사용자의 비밀번호를 `memo-새비밀번호`로 재설정합니다.

## 로컬 실행

```
python -m http.server 8000
```

http://localhost:8000 을 엽니다.

## 배포

GitHub 저장소의 Settings → Pages에서 `main` 브랜치의 루트(`/`)를 선택합니다.
