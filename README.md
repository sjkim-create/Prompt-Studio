# Aigle Movie — 필기 획 재생기 & 채점용 이미지 생성기

ncode 스마트펜으로 작성된 수학 풀이의 획 데이터를 재생하고, LLM 기반 자동 채점을 위한 정적 이미지와 동영상을 생성하는 웹 앱.

## 왜 만들었나

수학 서술형 채점에서 **풀이 과정의 순서와 사고 흐름**을 분석하려면 동영상이 필요했다. 그러나 동영상은:
- Gemini에서만 지원 (Claude, GPT-4o 불가)
- 토큰 비용이 높음 (5분 풀이 = ~79,000 토큰)
- 처리 속도가 느림

이 앱은 동영상 대신 **1~2장의 PNG 이미지**로 획 순서와 딜레이를 인코딩하여, 모든 비전 LLM에서 채점 가능하게 한다.

## 토큰 절감 효과

| 풀이 시간 | 동영상 | A안 (1장) | 절감률 |
|----------|--------|----------|-------|
| 1분 (초등) | ~17,000 | ~3,400 | 5배 |
| 2분 (중등) | ~32,500 | ~3,400 | 9.6배 |
| 5분 (고등) | ~78,900 | ~3,400 | 23배 |

## 기능

### 5개 탭

| 탭 | 설명 |
|----|------|
| **실시간 재생** | 획의 시간 순서대로 애니메이션 재생 (0.5x~8x 속도) |
| **동영상 1x** | 실시간 속도 WebM 동영상 생성 |
| **동영상 2x** | 2배속 WebM 동영상 생성 |
| **A안 이미지** | 단일 메타데이터 PNG (색상 순서 + 딜레이 마커 + 시간 비례 색상바) |
| **B안 이미지** | 원본(검정) + 메타데이터(컬러) 2장 PNG |

### A안 이미지 인코딩 방식

- **획 색상 = 작성 순서**: 빨강(첫 획) → 주황 → 노랑 → 초록 → 파랑 → 보라(마지막 획)
- **딜레이 마커**: ≥500ms 멈춤 지점에 빨간 원 + 시간 텍스트 (예: `● 1.2s`)
- **시간 비례 색상바**: 가로축이 시간에 비례 — 같은 색이 넓으면 딜레이가 길었음

### B안 이미지

- **이미지 1**: 원본 필기 (검정색, LLM이 내용을 읽는 용도)
- **이미지 2**: A안과 동일한 메타데이터 이미지

### 내보내기

- 각 탭에서 개별 저장 가능
- 실시간 재생 탭에서 4개 파일(A안 PNG, B안 PNG 2장, 1x WebM) 일괄 저장
- 탭 2~5는 생성 결과를 캐시하며, [새로 고침]으로 재생성

## 시작하기

```bash
npm install
npm run dev
```

http://localhost:5173 에서 앱 실행.

## 프로젝트 구조

```
src/
  App.tsx                          탭 UI + 파일 로드 + 캐시 관리
  types.ts                         타입 정의
  files.ts                         데이터 파일 목록
  tabs/
    LivePlayerTab.tsx               실시간 재생
    VideoTab.tsx                    동영상 생성/재생
    PlanATab.tsx                    A안 이미지
    PlanBTab.tsx                    B안 이미지
  export/
    strokeUtils.ts                  타임라인 빌드, 좌표 변환, 그리기
    strokeColor.ts                  HSL 색상 함수
    delayAnalysis.ts                딜레이 분석 (≥500ms 필터링)
    renderMetadataImage.ts          A안 이미지 렌더링
    renderOriginalImage.ts          B안 원본 이미지 렌더링
    exportVideo.ts                  WebM 동영상 생성 (MediaRecorder)
    download.ts                     Blob 다운로드 유틸리티

data/
  prompt/
    prompt.md                       기본 채점 프롬프트
    a_prompt.md                     A안용 채점 프롬프트 (이미지 해석 가이드 포함)
    b_prompt.md                     B안용 채점 프롬프트 (이미지 해석 가이드 포함)
  1. 초등 수학 문제 1/
    *_strokes_parsed.json           획 데이터 (ncode 좌표)
    *_page.png                      렌더링된 페이지 이미지
    문제 정보 + 채점 기준.pdf         문제 + 루브릭
  ...6개 폴더 (초등 2, 중등 2, 고등 2)

docs/planning/
  stroke-static-image-spec.md      기술 기획 문서
```

## 데이터 형식

### 획 데이터 (strokes_parsed.json)

ncode 좌표계: 600/56 DPI (1 unit = 1/56 inch)

```json
{
  "strokes": [
    {
      "startTime": 1773904379352,
      "endTime": 1773904379520,
      "color": "#000000",
      "points": [
        { "x": 14.88, "y": 12.7, "f": 0.755, "dt": 0 },
        { "x": 14.88, "y": 12.75, "f": 0.971, "dt": 10 }
      ]
    }
  ]
}
```

- `startTime` / `endTime`: 절대 타임스탬프 (ms)
- `points[].f`: 필압 (0~1)
- `points[].dt`: 이전 점으로부터의 시간 차이 (ms)
- **딜레이 계산**: `strokes[i].startTime - strokes[i-1].endTime`

## 채점 프롬프트 사용법

A안 또는 B안 이미지를 생성한 후, 해당 프롬프트와 함께 LLM에 전달:

```
[입력]
1. a_prompt.md (또는 b_prompt.md) 텍스트
2. 문제 정보 + 채점 기준.pdf
3. A안 이미지 1장 (또는 B안 이미지 2장)

[출력]
채점 결과 (등급, 점수, 피드백)
```

## 기술 스택

- React 19 + TypeScript
- Vite 8
- Canvas API (이미지 렌더링)
- MediaRecorder API (동영상 생성, WebM/VP9)
- 외부 라이브러리 의존성 없음
