---
name: getting-mju-news
version: 2.1.0
description: "명지대학교 공개 공지/학식과 공통 DB 기반 시간표 설계, 졸업 로드맵을 다루는 mju-news Reader skill."
metadata:
  openclaw:
    category: "service"
    domain: "education"
    requires:
      bins: ["mju-news"]
      skills: ["mju-shared"]
---

# 명지 공개 데이터 조회

`mju-news`는 공통 Postgres DB를 읽는 Reader CLI입니다. 공지/학식뿐 아니라 개설강좌와 공식 졸업요건 기반의 academic-planning 웹뷰도 이 skill에서 처리합니다.

## 기능 경계

- 현재 내가 수강 중인 시간표 조회: `mju-msi`의 `mju msi timetable`
- 출석/결석/UCheck 조회: `mju-ucheck` 또는 `mju ucheck ...`
- MSI 원본 졸업요건 조회: 사용자가 "MSI 원본", "학교 시스템 그대로"를 명시한 경우에만 `mju-msi`의 `mju msi graduation`
- 시간표 설계/랜덤 시간표/추천 시간표: 이 skill의 `mju-news academic-planning timetable`
- 졸업요건/졸업 로드맵/뭐 들었고 뭐 남았는지/영역별 공식 요건 판정: 이 skill의 `mju-news academic-planning graduation-roadmap`

## 시간표 설계

다음 표현은 기존 MSI 시간표나 UCheck 출석이 아니라 academic-planning 시간표 설계입니다.

- "시간표 설계"
- "시간표 짜줘"
- "랜덤 시간표"
- "추천 시간표"
- "전공 3개 교양 2개"
- "요일 제외"
- "교시 제외"
- "시간 안 겹치게"

사용 명령:

```bash
mju-news academic-planning timetable \
  --year <개설연도> \
  --term-code <학기코드> \
  --department "<학과명 또는 MSI 학과코드>" \
  --admission-year <입학년도> \
  --format json
```

결과 JSON의 `viewUrl`을 그대로 마스킹 링크로 전달합니다. 정상 웹뷰 제목은 `시간표 설계`입니다. 이 의도에서 `mju ucheck`를 사용하면 출석 웹뷰가 열리므로 사용하지 않습니다.

## 졸업 로드맵

다음 표현은 기존 MSI 졸업요건 원본 조회가 아니라 academic-planning 졸업 로드맵입니다.

- "졸업요건"
- "졸업 로드맵"
- "졸업까지 뭐 남았어"
- "내가 뭘 들었고 뭘 들어야 해"
- "영역별 졸업요건"
- "필수 과목 뭐 남았어"

사용 명령:

```bash
mju-news academic-planning graduation-roadmap \
  --department "<학과명 또는 MSI 학과코드>" \
  --admission-year <입학년도> \
  --format json
```

결과 JSON의 `viewUrl`을 그대로 마스킹 링크로 전달합니다. 정상 웹뷰 제목은 `졸업 로드맵`입니다. 일반적인 "졸업요건" 요청도 이 기능으로 처리합니다. 기존 `mju msi graduation`으로 열리는 `졸업요건` 웹뷰는 명시적인 MSI 원본 조회용이며, 학점 요약 중심이라 공식 과목 단위 상세가 없을 수 있습니다.

## 공지 / 학식

```bash
mju-news notices recent --limit 20 --format json
mju-news notices recent --category scholarship --limit 10 --format json
mju-news notices search --q "장학금" --since 2026-04-01 --format json
mju-news notices get general:12345 --format json

mju-news cafeterias today --format json
mju-news cafeterias today --meal lunch --where student-hall --format json
mju-news cafeterias week --start 2026-04-14 --format json
```

공지/학식/academic-planning 조회 명령은 wrapper가 자동으로 view-server에 저장하고 `viewUrl`을 주입합니다. 수동 view POST나 summary PATCH는 필요하지 않습니다.

## 데이터 준비 상태

academic-planning은 공통 DB의 개설강좌와 공식 졸업요건 seed/import가 있어야 세부 데이터를 보여줄 수 있습니다. DB가 비어 있거나 해당 학과/학번 기준 source가 없으면 기존 MSI/UCheck 기능으로 대체하지 말고, 데이터가 아직 준비되지 않았다고 짧게 안내합니다.
