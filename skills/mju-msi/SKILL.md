---
name: mju-msi
version: 1.1.0
description: "현재 수강 시간표, 현재 학기 수강점수, 성적 이력, MSI 원본 졸업요건, 강의평가를 다루는 MSI skill."
metadata:
  openclaw:
    category: "service"
    domain: "education"
    requires:
      bins: ["mju"]
      skills: ["mju-shared"]
---

# MJU MSI

모든 명령은 `--app-dir /data/users/<DISCORD_USER_ID> --format json` 플래그와 함께 실행됩니다.

## 자주 쓰는 명령
- 현재 수강 시간표 조회: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi timetable`
  - 선택 옵션: `--year <연도> --term-code <학기코드>`
- 요일별 마지막 수업 종료 시각 조회: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi +last-class-times`
  - 셔틀 출발 알림처럼 마지막 수업 종료 시각만 필요한 자동화에서 사용합니다.
- 현재 학기 성적/점수: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi course-scores`
  - "이번 학기 성적", "현재 성적", "중간고사 점수", "기말고사 점수", "수강점수", "학기 중 점수" 요청에 사용합니다.
  - 선택 옵션: `--year <연도> --term-code <학기코드>`
- 전체 성적 이력: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi grade-history`
  - "지난 학기 성적", "성적 이력", "누적 평점" 요청에 사용합니다.
- MSI 원본 졸업요건 조회: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi graduation`
  - 사용자가 "MSI 원본", "학교 시스템 그대로"처럼 원본 조회를 명시한 경우에만 사용합니다.
- 강의평가 대상 조회: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi lecture-evaluations list`
  - 결과 target의 `scope`가 `department`이면 교육만족도/재학생 만족도 조사이고, `course`이면 강의별 강의평가입니다.
  - 사용자가 "아무 과목이나"처럼 특정 과목을 정하지 않으면 `scope: "course"`인 미제출 target 중 첫 번째 사용 가능한 과목을 고릅니다.
- 강의평가 미리보기: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi lecture-evaluations preview --instruction "보통으로 ㄱㄱ"`
  - 대상이 여러 개면 `--target <id-or-title>` 또는 `--all` 이 필요합니다.
- 강의평가 제출: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi lecture-evaluations submit --instruction "보통으로 ㄱㄱ" --target TARGET`
  - 유저가 처음에 "강의평가 해줘"라고 요청한 것은 제출 실행 승인으로 봅니다.
  - 만족도는 `--satisfaction 매우만족|만족|보통|불만족|매우불만족`로 명시할 수 있고, 별도 신호가 없으면 `보통`입니다.
  - 사용자가 "강의평가 전부"처럼 모든 미제출 대상을 요청하면 `--all`을 사용하고, 특정 과목명이나 `target.id`가 있으면 `--target`으로 좁힙니다.

현재 학기 성적 관련 의도는 최종 학점/등급이 아직 없을 수 있으므로 모두 `msi course-scores`로 처리하세요. 기존 확정등급 조회 명령은 사용하지 않습니다.

## academic-planning과 구분

다음 의도는 MSI 조회가 아니라 `getting-mju-news` skill의 `mju-news academic-planning` 기능입니다.

- 시간표 설계, 랜덤 시간표, 추천 시간표, 전공/교양 개수 조합, 요일/교시 제외
- 졸업요건, 졸업 로드맵, 졸업까지 남은 것, 들은 과목과 들어야 할 과목, 영역별 공식 요건 판정

이 경우 `mju msi timetable`, `mju msi graduation`, `mju ucheck`를 사용하지 마세요. 일반적인 "졸업요건" 요청도 새 졸업 로드맵으로 대체합니다. 기존 MSI 명령은 이미 신청된 현재 상태나 학교 시스템 원본 요약을 명시적으로 조회할 때만 사용합니다.
