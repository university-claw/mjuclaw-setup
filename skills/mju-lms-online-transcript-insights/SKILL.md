---
name: mju-lms-online-transcript-insights
version: 1.0.1
description: "LMS 온라인 강의의 제공 요약, 자막 원문, rule-based 중요 구간을 조회하는 helper skill."
metadata:
  openclaw:
    category: "helper"
    domain: "education"
    requires:
      bins: ["mju"]
      skills: ["mju-shared", "mju-lms"]
---

# LMS Online Transcript Insights

모든 명령은 `--app-dir /data/users/<DISCORD_USER_ID> --format json` 플래그와 함께 실행합니다.

## 목적

사용자가 "LMS 영상 요약해줘", "강의 영상 핵심 알려줘", "온라인 강의 중요한 구간 찾아줘"처럼 요청했을 때 사용합니다.

이 skill은 LMS가 제공하는 요약, 자막 원문, rule-based 중요 구간 후보를 mju-cli로 조회해 사용자에게 필요한 정보만 요약하는 기능입니다. 사용자가 온라인 강의 요약이나 핵심 구간을 요청하면 대상 강의/주차/영상 항목을 확인한 뒤 도구를 호출하세요.

## 사전 확인

1. 강의 목록에서 대상 강의 확인:

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json lms courses list
```

2. 온라인 주차 목록 확인:

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json lms online list --course COURSE_NAME
```

`list` 결과의 `weeks[].lectureWeeks`는 LMS 온라인 학습 주차의 내부 ID입니다. `week`나 `weekLabel`은 사용자에게 보여줄 주차 표시일 뿐이고, CLI의 `--lecture-weeks` 인자에는 절대 `9`, `10` 같은 주차 숫자를 넣지 않습니다. 사용자가 "9주차"처럼 말하면 `weeks[].week`/`weekLabel`로 후보를 찾고, 실제 명령에는 같은 행의 `lectureWeeks` 값을 넣습니다.

3. 대상 주차 상세 확인:

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json lms online get --course COURSE_NAME --lecture-weeks LECTURE_WEEKS_ID
```

주차에 영상 항목이 여러 개면 `online get`의 `items`에서 `linkSeq`를 확인한 뒤 `--link-seq LINK_SEQ`를 붙입니다. `linkSeq`는 오직 `online get`의 `items[].linkSeq` 값만 사용합니다. 과제 `rtSeq`, 공지 `articleId`, `lectureWeeks`, 다른 LMS 목록의 id를 `linkSeq`로 재사용하지 마세요. 사용자가 "첫 번째 영상"처럼 순서로 말하면 `--item-index INDEX`를 사용할 수 있지만, 안정적인 재호출에는 `--link-seq`가 더 낫습니다. 사용자가 단순히 "영상 1개 요약"처럼 대상만 넓게 말하면 `online get`으로 항목을 확인한 뒤 첫 번째 항목부터 요약하거나, 여러 항목을 보여주고 고르게 합니다.

## LMS 제공 요약만 가져오기

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json lms online summary --course COURSE_NAME --lecture-weeks LECTURE_WEEKS_ID --link-seq LINK_SEQ
```

기대 출력:

- `summary.title`: LMS 요약 영역 제목
- `summary.markdown`: LMS가 제공하는 요약문
- `selectedItem`: 선택된 영상 항목
- `resolvedBy`: `linkSeq`, `itemIndex`, `single-item` 중 선택 방식

## 자막 원문 plain text 가져오기

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json lms online transcript --course COURSE_NAME --lecture-weeks LECTURE_WEEKS_ID --link-seq LINK_SEQ --language KO
```

기대 출력:

- `source.language`: 선택한 자막 언어
- `source.cueCount`: VTT cue 개수
- `text`: cue 텍스트만 합친 plain transcript

`--language` 기본값은 `KO`입니다. 가능한 다른 언어가 필요하면 `EN`, `CH`, `VI` 같은 LMS track 언어 코드를 지정합니다.

## 중요한 구간만 rule-based로 가져오기

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json lms online insights --course COURSE_NAME --lecture-weeks LECTURE_WEEKS_ID --link-seq LINK_SEQ --language KO
```

기대 출력:

- `counts`: 유형별 하이라이트 개수
- `highlights.examCandidates`: 시험/개념 후보
- `highlights.assignments`: 과제/제출 후보
- `highlights.practice`: 실습 절차와 명령어 후보
- `highlights.important`: 강조 표현이 있는 중요 설명
- `summaryHighlights`: LMS 제공 요약문에서 잡힌 중요 후보

각 highlight는 `timeRange`, `keywords`, `reasons`, `evidence`를 포함합니다. LLM 요약이 아니라 키워드와 cue window 기반 rule result이므로, 사용자에게는 "중요 후보" 또는 "검토할 구간"으로 안내합니다.

필요한 유형만 좁힐 수 있습니다.

```bash
mju --app-dir /data/users/<DISCORD_USER_ID> --format json lms online insights --course COURSE_NAME --lecture-weeks LECTURE_WEEKS_ID --link-seq LINK_SEQ --types exam-candidate,assignment --max-items 3
```

`--show-score`는 디버깅용입니다. 일반 사용자 응답에는 점수를 노출하지 않습니다.

## 응답 기준

- 과목명, 주차, 선택된 영상 제목을 먼저 짧게 확인합니다.
- `summary` 요청은 LMS 제공 요약을 중심으로 답합니다.
- `insights` 요청은 시험/과제/실습/중요 후보를 구분해 짧게 정리합니다.
- `transcript` 요청은 사용자가 원문을 명시적으로 원할 때만 사용하고, 긴 원문은 필요한 범위로 요약합니다.
- 대상 영상이 모호하면 임의 선택하지 말고 후보를 제시하거나 필요한 값을 물어봅니다.
