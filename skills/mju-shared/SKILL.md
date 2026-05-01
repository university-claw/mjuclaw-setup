---
name: mju-shared
version: 2.0.0
description: "명지대학교 CLI 공통 인증, 출력, 안전 규칙. Discord 환경용 (v2 — app-dir을 Discord User ID로 격리)."
metadata:
  openclaw:
    category: "shared"
    domain: "education"
    requires:
      bins: ["mju"]
---

# MJU Shared (Discord)

`mju`를 사용할 때 공통으로 지켜야 할 규칙입니다.

## 기본 원칙

1. **모든 mju 명령에 `--app-dir /data/users/{DISCORD_USER_ID}` 를 붙이세요.** 유저별 크리덴셜과 세션이 이 경로에 저장됩니다. `{DISCORD_USER_ID}`는 현재 대화하는 Discord 유저의 ID입니다.
2. 먼저 인증 상태를 확인합니다: `mju auth status --app-dir /data/users/{DISCORD_USER_ID} --format json`
3. 인증이 안 되어있으면 `mju-onboarding` skill로 안내합니다. 직접 로그인을 시도하지 마세요.
4. 기본 출력은 `--format json`을 유지합니다.
5. 실제 변경이 있는 명령은 preview를 먼저 보고 `--confirm`으로 실행합니다.
6. 삭제, 초기화, 로그아웃, 전체 구독 해제처럼 되돌리기 어렵거나 사용자 상태를 크게 바꾸는 요청은 실행 전에 한 번 확인합니다.

## 내부 정보 비노출

`mju` 명령 결과는 사용자 응답에 그대로 붙이지 말고, 필요한 정보만 사용자용으로 요약하세요.

특히 다음은 사용자에게 출력하지 않습니다.

- raw JSON 또는 rawData
- 인증/세션/크리덴셜 관련 내부 필드명
- 실행한 내부 명령어와 옵션
- `/data/users/...` 같은 저장 경로
- 파일명, 함수명, 로그, 스택트레이스, 환경변수/설정값

인증 상태는 내부 필드 대신 다음처럼만 표현하세요.

```text
로그인 상태가 정상입니다.
로그인이 필요합니다.
로그인 세션을 다시 확인해야 합니다.
```

## 주요 표면

- 인증: `mju auth ...`
- LMS: `mju lms ...`
- MSI: `mju msi ...`
- UCheck: `mju ucheck ...`
- Library: `mju library ...`
- Skills catalog: `mju skills list`

## 데이터 표시

학사 데이터를 조회한 후 상세 결과를 보여줘야 할 때:

1. 요약은 Discord 메시지(embed)로 직접 보여주세요
2. 상세 데이터는 view-server에 저장하고 링크 버튼으로 제공하세요:
   ```bash
   curl -s -X POST http://localhost:3001/api/view \
     -H "Content-Type: application/json" \
     -d '{"dataType":"grades","title":"2026-1학기 성적","summary":"평균 4.12","rawData":{...},"aiResponse":"..."}'
   ```
   응답의 `url` 필드를 Discord 링크 버튼으로 보여주세요.
