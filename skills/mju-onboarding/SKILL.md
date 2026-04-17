---
name: mju-onboarding
version: 1.0.0
description: "명지대 포털 계정 온보딩. 학사 서비스(LMS/MSI/UCheck/도서관) 사용 전 반드시 실행. Discord DM에서만 진행."
metadata:
  openclaw:
    category: "auth"
    domain: "education"
    requires:
      bins: ["mju"]
---

# MJU Onboarding

명지대학교 학사 서비스를 사용하려면 포털 계정 인증이 필요합니다. 이 skill은 유저의 학번과 비밀번호를 받아 `mju auth login`으로 인증하고, 크리덴셜을 유저별 디렉토리에 저장합니다.

## 핵심 규칙

1. **온보딩 전에는 mju-lms, mju-msi, mju-ucheck, mju-library 등 인증이 필요한 skill을 절대 실행하지 마세요.** 온보딩이 안 된 유저가 학사 데이터를 요청하면 온보딩부터 안내하세요.
2. **getting-mju-news (학교 공지/학식)는 온보딩 없이 사용 가능합니다.** 공개 데이터(공지 + 학식)이므로 인증 불필요.
3. **온보딩은 DM에서만 진행하세요.** 길드 채널에서 비밀번호를 받지 마세요. 길드에서 요청이 오면 "DM으로 온보딩을 진행할게요"라고 안내하세요.

## 인증 상태 확인

유저가 학사 데이터를 요청할 때 항상 먼저 확인:

```bash
mju auth status --app-dir /data/users/{DISCORD_USER_ID} --format json
```

응답에 `"authenticated": true`가 있으면 온보딩 완료 상태 — 다른 skill을 바로 사용 가능.
`"authenticated": false`이거나 에러가 나면 온보딩이 필요합니다.

## 온보딩 진행

### 1단계: 크리덴셜 수집

유저에게 학번과 비밀번호를 요청합니다. 가능하면 modal 폼을 사용하고, 불가능하면 DM 대화로 하나씩 물어보세요.

예시 메시지:
> 명지대 학사 서비스를 처음 사용하시네요! 포털 계정으로 로그인이 필요합니다.
>
> 학번과 비밀번호를 알려주세요. DM이라 다른 사람에게 보이지 않습니다.

### 2단계: 로그인 실행

**반드시 `mju-login` helper를 heredoc으로 사용**하세요. 비밀번호 특수문자($, ', ", `, \)를 안전하게 처리합니다.

```bash
mju-login {DISCORD_USER_ID} {학번} <<'PW_END'
{비밀번호}
PW_END
```

- 반드시 `<<'PW_END'` 처럼 **single quote로 marker를 감쌀 것** (shell 치환 차단)
- 비밀번호는 한 줄로만 입력
- `{DISCORD_USER_ID}`: 현재 대화 유저의 Discord ID
- 성공 시 JSON에 `profile` 필드가 포함됩니다
- 실패 시 에러 메시지를 유저에게 전달하세요 (절대 `myi.mju.ac.kr`이라고 말하지 말 것, 실제 포털은 https://msi.mju.ac.kr)

❌ **절대 `mju auth login --password ...` 직접 호출 금지** — shell escape 실패로 로그인 실패함.

### 3단계: 확인 응답

성공 시:
> ✅ 인증 완료! {이름}님 ({학과}), 이제 학사 서비스를 사용할 수 있습니다.
> 시간표, 성적, 과제, 출석, 도서관 등을 물어보세요.

실패 시:
> ❌ 로그인 실패: {에러 메시지}
> 학번과 비밀번호를 다시 확인해주세요.

## 다른 skill에서의 사용

모든 mju-cli 명령은 `--app-dir /data/users/{DISCORD_USER_ID}` 플래그를 붙여야 합니다. 이 경로에 해당 유저의 크리덴셜과 세션이 저장되어 있습니다.

예시:
```bash
mju lms courses list --app-dir /data/users/{DISCORD_USER_ID} --format json
mju msi grades --app-dir /data/users/{DISCORD_USER_ID} --format json
```

## 로그아웃

유저가 로그아웃을 요청하면:

```bash
mju auth forget --app-dir /data/users/{DISCORD_USER_ID} --format json
```

이후 다시 온보딩이 필요합니다.

## 보안 참고

- 비밀번호는 `mju auth login`이 AES-256-GCM으로 암호화하여 저장합니다
- 평문 비밀번호는 어디에도 로깅하지 마세요
- 크리덴셜은 `/data/users/{DISCORD_USER_ID}/` 디렉토리에 유저별 격리됩니다
- 길드 채널에서는 절대 비밀번호를 요청하거나 표시하지 마세요
