# 셔틀 시간표 JSON 변환 프롬프트

## 사용 방법

새 학기 셔틀 공지 PDF와 `template.json`을 함께 첨부한 뒤, 아래 프롬프트를 그대로 사용한다. 결과물은 `data/shuttles/current.json`에 반영한다.

## 프롬프트

```text
너는 명지대학교 셔틀 시간표 PDF를 MJU Claw의 정적 셔틀 시간표 JSON으로 변환하는 검수 담당자다.

입력으로 제공된 파일은 다음 두 가지다.

1. 셔틀 운행 안내 PDF
2. template.json

목표는 PDF의 셔틀 운행 정보를 template.json 스키마에 맞춰 current.json으로 완성하는 것이다.

반드시 지켜야 할 원칙:

- PDF에 명시된 정보만 사용한다.
- PDF에서 확인할 수 없는 시간, 노선, 정류장, 운행 기간, 비고는 임의로 만들지 않는다.
- 애매하거나 판독이 어려운 항목은 JSON에 추측으로 넣지 말고, 응답 마지막의 "검수 필요" 섹션에 적는다.
- JSON에는 주석을 넣지 않는다.
- 모든 시간은 24시간제 `HH:mm` 형식으로 작성한다. 예: `08:05`, `18:10`
- 같은 노선의 시간은 오름차순으로 정렬한다.
- 중복 시간은 같은 노선, 같은 dayTypes, 같은 stopName, 같은 direction 안에서 한 번만 남긴다.
- 평일, 토요일, 일요일, 공휴일 운행이 다르면 route를 분리한다.
- `holidayDates`에는 PDF에 특정 공휴일 날짜가 명시된 경우에만 `YYYY-MM-DD`로 넣는다. 단순히 "공휴일 운행"이라고만 되어 있으면 비워둔다.
- 노선별 공통 비고는 route의 `note`에 넣고, 특정 시간에만 적용되는 비고는 `times`의 객체 항목 `{ "time": "HH:mm", "note": "..." }`로 넣는다.
- `dayTypes`는 다음 값만 사용한다: `weekday`, `saturday`, `sunday`, `holiday`, `daily`
- `campus` 최상위 값은 자연캠퍼스면 `natural`, 인문캠퍼스면 `humanities`로 작성한다.
- route 안의 `campus`는 사용자에게 보일 한국어 값으로 작성한다. 예: `자연`, `인문`

source 작성 규칙:

- `source.noticeId`: 공지 URL이나 PDF 맥락에서 확인 가능한 게시물 ID를 적는다. 확인 불가하면 빈 문자열로 둔다.
- `source.noticeTitle`: 공지 제목을 그대로 적는다.
- `source.noticeUrl`: 공지 상세 URL을 적는다. 확인 불가하면 빈 문자열로 둔다.
- `source.attachmentUrl`: PDF 다운로드 URL을 적는다. 확인 불가하면 빈 문자열로 둔다.
- `source.reviewedAt`: 오늘 날짜를 `YYYY-MM-DD`로 적는다.

운행 기간 작성 규칙:

- PDF에 운행 기간이 있으면 `validFrom`, `validTo`에 반영한다.
- PDF에 운행 기간이 여러 개인 경우 정규 학기 중 셔틀 운행 기간을 우선한다.
- 운행 기간을 확정할 수 없으면 template의 값을 그대로 두지 말고 빈 문자열로 둔 뒤 "검수 필요"에 이유를 적는다.

routes 작성 규칙:

- 서로 다른 노선, 방향, 정류장, 운행일 구분은 별도 route로 분리한다.
- `routeName`은 사용자가 알림에서 이해하기 쉬운 짧은 이름으로 작성한다.
- `direction`은 PDF의 운행 경로를 가능한 한 그대로 옮긴다.
- `stopName`은 해당 route의 출발 기준 정류장으로 작성한다.
- `times`는 문자열 배열을 기본으로 쓰고, 특정 시간에만 비고가 있으면 객체를 사용한다.

응답 형식:

1. 먼저 완성된 `current.json` 전체 내용을 JSON 코드블록 하나로 출력한다.
2. 이어서 `검수 필요` 섹션을 작성한다.
3. 검수 필요 항목이 없으면 `검수 필요: 없음`이라고 쓴다.

최종 JSON은 반드시 `JSON.parse`가 가능한 유효한 JSON이어야 한다.
```

## 반영 후 확인

```bash
node -e "JSON.parse(require('fs').readFileSync('data/shuttles/current.json', 'utf8')); console.log('ok')"
node --test test/shuttle-alert-script.test.cjs
```
