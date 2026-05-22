---
name: mju-msi
version: 1.0.1
description: "시간표, 현재 학기 수강점수, 성적 이력, 졸업요건을 조회하는 MSI skill."
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
- 시간표 조회: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi timetable`
  - 선택 옵션: `--year <연도> --term-code <학기코드>`
- 요일별 마지막 수업 종료 시각 조회: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi +last-class-times`
  - 셔틀 출발 알림처럼 마지막 수업 종료 시각만 필요한 자동화에서 사용합니다.
- 현재 학기 성적/점수: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi course-scores`
  - "이번 학기 성적", "현재 성적", "중간고사 점수", "기말고사 점수", "수강점수", "학기 중 점수" 요청에 사용합니다.
  - 선택 옵션: `--year <연도> --term-code <학기코드>`
- 전체 성적 이력: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi grade-history`
  - "지난 학기 성적", "성적 이력", "누적 평점" 요청에 사용합니다.
- 졸업 요건: `mju --app-dir /data/users/<DISCORD_USER_ID> --format json msi graduation`

현재 학기 성적 관련 의도는 최종 학점/등급이 아직 없을 수 있으므로 모두 `msi course-scores`로 처리하세요. 기존 확정등급 조회 명령은 사용하지 않습니다.
