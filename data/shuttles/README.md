# 셔틀 시간표 데이터

`current.json`은 `mju-shuttle-alert`가 사용하는 현재 학기 셔틀 시간표이다. 새 학기에는 학교 공지 PDF를 확인해 이 파일을 갱신한다.

## 갱신 절차

1. 새 학기 셔틀 운행 안내 PDF를 준비한다.
2. `template.json`과 PDF를 agent에게 함께 제공한다.
3. `CONVERSION_PROMPT.md`의 프롬프트를 사용해 `current.json` 초안을 생성한다.
4. agent가 남긴 `검수 필요` 항목을 사람이 확인한다.
5. `current.json`을 갱신하고 아래 명령으로 검증한다.

```bash
node -e "JSON.parse(require('fs').readFileSync('data/shuttles/current.json', 'utf8')); console.log('ok')"
node --test test/shuttle-alert-script.test.cjs
```

## 스키마 메모

- `routes[].times`는 문자열 `HH:mm` 또는 `{ "time": "HH:mm", "note": "..." }` 객체를 사용할 수 있다.
- `dayTypes`는 `weekday`, `saturday`, `sunday`, `holiday`, `daily`만 사용한다.
- `holidayDates`는 특정 날짜가 PDF에 명시된 경우에만 채운다.
- `source`에는 공지와 첨부 PDF의 출처를 남겨 다음 학기 검수 시 비교 가능하게 한다.
