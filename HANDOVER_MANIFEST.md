# 🏺 Project Git Arc: KCI Philosophy Dashboard Handover Manifest

이 문서는 'Git Arc' 프로젝트의 현재 상태와 모든 기술적/분석적 맥락을 새로운 Antigravity 에이전트에게 전수하기 위해 작성되었습니다.

## 1. 프로젝트 개요 (Context)
- **프로젝트 명:** Git Arc (KCI 철학 논문 메타데이터 분석 대시보드)
- **목표:** KCI(한국학술지인용색인)의 논문 데이터를 기반으로 철학 학문 지형도를 시각화하여, 연구자가 논문 서론 작성을 위한 거시적 통찰을 얻도록 도움.
- **철학:** 시각적 질서(Visual Order)와 결맞음(Coherence)을 최우선으로 하며, 불필요한 노이즈를 배제한 프리미엄 데이터 인사이트 제공.

## 2. 데이터 엔지니어링 (Data & Preprocessing)
### 소스 데이터
- `논문검색리스트Excel시몽동.xls`: KCI에서 추출한 원본 데이터. 
- **주의사항:** 바이너리 XLS 형식이며 CP949 인코딩을 사용함. 일반적인 텍스트 파싱 시 한글 깨짐 발생 가능. `data.js`로 정제되어 관리됨.

### 전처리 로직 (Crucial)
1. **발행년:** `YYYYMM` 형식에서 앞 4자리만 추출하여 정수화.
2. **주제분야 그룹핑 (Binning):** 33개의 세분류를 5대 핵심 계열(철학, 인문학, 학제간·사회과학, 예술·미디어, 신학·기타)로 재분류.
3. **키워드 정제:** 쉼표 단위 Split, 공백 제거, 영문 키워드 및 빈도 1 이하의 키워드 배제(한국어 개념망 순수성 유지).
4. **피인용횟수 편향 보정:** 최신 논문일수록 인용수가 적은 시간적 편향을 고려하여, 시각화 시 항상 '발행년'을 병기함.

## 3. 대시보드 아키텍처 (Implementation)
### 시각화 모듈 (7 Modules)
1. **Timeline (Chart.js):** 연도별 발행 건수 추이.
2. **Landscape (Chart.js):** 5대 계열별 분포 비율 (Doughnut).
3. **Keywords (Chart.js):** 빈도별 하강 곡선 (Bubble).
4. **Impact (Table):** 피인용 Top 10 논문 리스트.
5. **Co-occurrence Network (D3.js):** 키워드 간 상관관계. Modularity(군집별 색상)와 Degree(연결도별 크기)가 적용됨.
6. **Topic Streamgraph (D3.js):** 5대 주제의 시계열적 흐름. 각 스트림 중앙에 'Direct Label'이 위치함.
7. **Citation Map (D3.js):** 저자-학술지-담론 간의 네트워크 지형도.

### 기술적 제약 및 해결 (Workarounds)
- **Git:** 시스템 `git` 부재로 인해 `isomorphic-git` 라이브러리를 사용해 로컬 레포지토리를 관리함.
- **Deployment:** GitHub Pages 등 배포 시 root의 `index.html`을 참조하므로, 모든 핵심 파일(`index.html`, `app.js`, `styles.css`, `data.js`)은 프로젝트 root에 위치해야 함.

## 4. 디자인 시스템 (Aesthetics)
- **Palette:** `Slate (#09090b)` 배경과 `Indigo/Violet` 계열의 차트 컬러.
- **Typography:** `Outfit` (헤드라인), `Inter` (본문 및 레이블).
- **Network Layout:** Force Atlas 2 스타일을 모방한 D3 Force Simulation 사용.

## 5. 향후 과제 (Next Steps)
- **LDA 고도화:** 현재 키워드 기반 주제 분류를 논문 초록(Abstract) 크롤링 데이터를 활용한 실제 LDA 토픽 모델링으로 업그레이드.
- **인터랙티브 필터링:** 연도별, 주제별 실시간 데이터 필터링 기능 추가.
