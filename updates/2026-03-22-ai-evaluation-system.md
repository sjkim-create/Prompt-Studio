# AI 평가 시스템 구현 및 대규모 리팩터링

## 변경 일자
2026-03-22

## 변경 요약
필기 획 재생기에 OpenAI/Gemini 기반 AI 자동 채점 시스템을 추가하고, 3-column 레이아웃으로 전면 리팩터링함. 평가 결과를 IndexedDB에 영속 저장하며, 프롬프트 편집/히스토리 관리/병렬 평가 기능을 지원함.

## 변경된 파일

### 신규 파일
- `src/evalTypes.ts`: 공유 타입 정의 (EvalContext, EvalHistoryEntry, AttachedFileInfo)
- `src/db.ts`: IndexedDB 헬퍼 (히스토리 저장/로드, 프롬프트 캐시)
- `src/export/evaluateWithOpenAI.ts`: OpenAI/Gemini 통합 평가 엔진 (SSE 스트리밍, 동영상 지원)
- `src/tabs/EvaluationPanel.tsx`: 오른쪽 평가 결과 패널 (모델 선택, 평가 버튼, 히스토리 풀다운, 마크다운 렌더링)
- `src/tabs/PromptSidebar.tsx`: 왼쪽 프롬프트 편집 사이드바 (편집/다운로드/초기화)
- `src/tabs/ImagePopup.tsx`: 이미지 풀스크린 뷰어 (줌/패닝)
- `src/tabs/PanelResizer.tsx`: 패널 폭 드래그 조절 컴포넌트
- `data/prompt/stroke_prompt.md`: 획순/딜레이 분석 프롬프트 (시간축 기반 멈춤 시간표)
- `data/prompt/movie_prompt.md`: 동영상 평가 시스템 프롬프트
- `data/prompt/movie_stroke_prompt.md`: 동영상 기반 획 분석 프롬프트
- `public/data/prompt/*.md`: 런타임 접근용 프롬프트 파일 복사본
- `deploy-scripts/deploy.sh`: OCI 배포 스크립트 (nginx 정적 호스팅)
- `deploy-scripts/setup-ssl.sh`: Let's Encrypt SSL 설정 스크립트
- `.vscode/launch.json`, `.vscode/tasks.json`: VSCode F5 실행 설정

### 수정 파일
- `src/App.tsx`: 3-column 레이아웃으로 전면 리팩터링. 공유 히스토리/평가 상태를 App 레벨로 이동. 프롬프트 사이드바/평가 패널 항상 표시. 패널 리사이즈 지원.
- `src/tabs/PlanATab.tsx`: 평가 로직 제거, evalContext 등록 패턴으로 단순화
- `src/tabs/PlanBTab.tsx`: 동일 패턴으로 단순화
- `src/tabs/VideoTab.tsx`: Gemini 동영상 평가 지원 추가, evalContext 등록
- `src/files.ts`: FileEntry에 pdfPath 필드 추가
- `src/types.ts`: FileEntry 인터페이스에 pdfPath 추가
- `src/export/renderMetadataImage.ts`: 딜레이 라벨 초 단위 통일, 경과 시간 표시 추가, 필압 제거(균일 두께)
- `src/export/renderOriginalImage.ts`: 필압 제거(균일 두께)
- `src/export/strokeUtils.ts`: 필압 제거(균일 두께)
- `src/index.css`: 마크다운 렌더링 스타일 (.eval-markdown) 추가
- `data/prompt/a_prompt.md`: 경과 시간 설명 추가, 색상바 해석 가이드 보강
- `data/prompt/b_prompt.md`: 동일 보강
- `vite.config.ts`: OpenAI/Gemini API 키 경로 설정
- `package.json`: react-markdown, remark-gfm 의존성 추가

### 삭제 파일
- `src/tabs/EvaluationModal.tsx`: 패널로 대체되어 삭제

## 상세 내용

### AI 평가 시스템
- **멀티 모델 지원**: OpenAI (GPT-5.4/5.2/4.1/4o 계열) + Google Gemini (3.1/3/2.5 계열)
- **SSE 스트리밍**: 평가 결과가 실시간으로 마크다운 렌더링
- **병렬 평가**: 하나의 평가 진행 중에도 추가 평가 실행 가능
- **동영상 평가**: Gemini 모델로 WebM 동영상 직접 분석 (1x/2x 배속 자동 보정)
- **customPrompt**: 사이드바에서 편집한 프롬프트가 평가에 반영

### 3-Column 레이아웃
- 왼쪽: 프롬프트 편집 사이드바 (첨부 파일 목록 포함)
- 가운데: 이미지/동영상/재생 콘텐츠
- 오른쪽: 평가 결과 패널 (모델 선택 + 평가 버튼 + 히스토리 + 마크다운 뷰어)
- 패널 경계선 드래그로 폭 조정 가능

### IndexedDB 영속성
- 평가 히스토리: source, model, timestamp, content, usage, cost, promptText, fileName 저장
- 편집된 프롬프트: 탭별 자동 저장 (debounce 1초)
- 페이지 새로고침 후에도 히스토리 유지

### 이미지 렌더링 개선
- 딜레이 라벨: ms 단위 제거, 모두 초 단위 (예: 0.5s)
- 색상바: 경과 시간(검은색) + 멈춤 시간(빨간색) 이중 라벨
- 필압 제거: 모든 획이 동일한 두께로 렌더링

### 프롬프트 체계
- A안/B안: 이미지 해석 가이드 + 채점 Decision Tree + 획순 분석
- 동영상: 동영상 해석 가이드 + 채점 Decision Tree + 필기 속도 분석
- 색상 언급 금지: "획의 색상을 절대 언급하지 마세요" 명시

### 배포
- OCI develop-neolab-aigle (132.145.83.186) 대상
- DNS: aigle.test.neolab.net → 132.145.83.186
- deploy-scripts/deploy.sh: 빌드 → SCP → nginx 설정 자동화
