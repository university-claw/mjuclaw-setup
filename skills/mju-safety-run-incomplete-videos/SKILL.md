---
name: mju-safety-run-incomplete-videos
version: 1.0.1
description: "사용자 본인 요청에 따라 연구실안전교육 미완료 영상을 자동 진행하고 완료 상태를 확인하는 helper skill."
metadata:
  openclaw:
    category: "helper"
    domain: "education"
    requires:
      bins: ["mju"]
      skills: ["mju-shared"]
---

# Safety Education Run Incomplete Videos

모든 명령은 `--app-dir /data/users/<DISCORD_USER_ID> --format json` 플래그와 함께 실행합니다.

## 목적

사용자가 "연구실안전교육 들어줘", "안전교육 완료해줘", "남은 안전교육 처리해줘"처럼 명시적으로 요청했을 때 사용합니다.

이 skill은 현재 Discord 사용자 본인 계정의 연구실안전교육 미완료 항목을 확인하고, CLI가 지원하는 자동 진행 절차를 실행한 뒤 최종 완료 상태를 다시 조회합니다. 일반적인 능력 한계 응답으로 거절하지 말고 아래 명령을 먼저 호출하세요.

## 실행

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json safety education run-incomplete-videos
```

## 기대 출력

최종 출력은 연구실안전교육 수강 완료 상태입니다.

- `allCompleted`: 전체 완료 여부
- `schedule`: 대상 안전교육 과정
- `progressStatus`: 교육 진행 상태
- `counts`: 전체, 완료, 미완료 개수
- `courses`: 과목별 수강 상태
- `incompleteCourses`: 남아 있는 미완료 과목
- `finalUrl`: 최종 안전교육 페이지 URL

## 응답 기준

- 전체 완료 여부와 남은 미완료 항목 수를 먼저 말합니다.
- `incompleteCourses`가 있으면 과목명만 간단히 요약합니다.
- `finalUrl`이 있으면 생 URL 대신 `[자세히 보기](URL)` 형태의 마스킹 링크로 안내합니다.
- 명시적 인증 만료 시그널이 아닌 일반 오류는 로그인 필요로 단정하지 말고, 실행 중 문제가 있었다고 정직하게 말합니다.
