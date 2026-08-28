# 🐙 손질왕 업무관리 시스템

손질왕(Sonjilwang)의 판매 및 수매 내역을 효율적으로 등록하고 정산하는 모바일 친화적 웹 어플리케이션입니다.  
이 프로젝트는 **Cloudflare Pages**와 **D1 데이터베이스**를 활용하여 별도 데이터베이스 서버 없이 데이터를 기록합니다.

## 배포 환경

| 환경 | Git 브랜치 | 주소 | D1 데이터베이스 |
|---|---|---|---|
| 운영 | `main` | `https://sonzilking.pages.dev` | `sonzilkingdb` |
| 테스트 | `test` | `https://test.sonzilking.pages.dev` | `sonzilking-test` |

기능 수정은 `test` 브랜치에 먼저 푸시하여 테스트 사이트에서 확인합니다. 확인이 끝난 변경만 `main` 브랜치에 병합합니다. Preview 환경은 별도 D1 데이터베이스를 사용하므로 테스트 판매·수매·수납 기록이 운영 데이터에 반영되지 않습니다.

### 버전 및 공지사항 작성 규칙

수정사항을 배포할 때 `js/releases.js` 배열의 맨 위에 새 버전을 추가합니다.

- 작은 오류 수정: 마지막 번호 증가 (예: `v1.2.0` → `v1.2.1`)
- 새 기능 추가: 가운데 번호 증가 (예: `v1.2.1` → `v1.3.0`)
- 테스트 사이트 배포 단계에서는 `테스트 배포`, 운영 반영 후에는 `정식 배포`로 표시합니다.
- 제목, 한 줄 요약, 기능별 변경사항을 사용자가 이해하기 쉬운 표현으로 작성합니다.

---

## 🌟 주요 기능

1. **메인 대시보드**: 모바일에 최적화된 세련된 디자인 및 직관적인 판매/수매 메뉴 제공
2. **판매 관리**:
   - 업체명 자동완성 및 검색 기능
   - 키로수 × 단가 자동 계산
   - 부대비용 및 수수료(%) 자동 계산 (총합계 반영)
   - 해당 업체에 **미수금**이 존재할 경우 페이지 상단에 경고 및 미수 금액 실시간 노출
   - 미수 내역 수납 완료(완납) 처리 기능
3. **수매 관리**:
   - 업체명 자동완성 및 검색 기능
   - 키로수 × 단가 자동 계산 및 기록 관리
4. **Cloudflare D1 연동**: 판매/수매 내역과 거래처 목록을 관계형 데이터베이스에 저장합니다.

---

## 🛠 로컬 개발 및 테스트 방법

컴퓨터에서 로컬로 테스트하면 실제 Cloudflare D1 대신 `.wrangler/` 아래의 로컬 데이터가 사용됩니다.

### 1. 패키지 설치
프로젝트 폴더 내에서 필요한 라이브러리(Wrangler)를 설치합니다.
```bash
npm install
```

### 2. 로컬 개발 서버 실행
다음 명령어를 실행하면 Cloudflare Pages와 KV 데이터베이스가 로컬에 모킹(Mocking)되어 실행됩니다.
```bash
npm run dev
```
- 서버가 켜지면 브라우저에서 `http://localhost:8788`에 접속할 수 있습니다.
- 로컬 테스트 데이터는 `.wrangler/` 폴더에 저장되며 운영 및 테스트 Cloudflare D1에는 영향을 주지 않습니다.

### 3. 테스트 사이트 배포

```bash
git switch test
git push origin test
```

GitHub에 연결된 Cloudflare Pages가 `https://test.sonzilking.pages.dev`로 자동 배포합니다.

---

## 🚀 GitHub 업로드 및 Cloudflare Pages 배포 방법

### 1. 깃허브(GitHub)에 올리기
프로젝트 폴더에서 Git 저장소를 초기화하고 커밋하여 GitHub 원격 저장소에 푸시합니다.

```bash
# git 초기화
git init

# 파일 추가 및 커밋
git add .
git commit -m "Initial commit: 손질왕 업무관리 앱 완료"

# 깃허브 리포지토리 연결 및 푸시
git branch -M main
git remote add origin <본인의_깃허브_리포지토리_주소>
git push -u origin main
```

---

### 2. Cloudflare Pages에 배포 및 D1 연동하기

1. **Cloudflare Dashboard** 로그인 후 **[Workers & Pages]** -> **[Create]** -> **[Pages]** -> **[Connect to Git]** 클릭
2. 방금 올린 GitHub 리포지토리(`sonjilwang`)를 선택하고 **[Begin setup]** 클릭
3. **Build settings** 설정:
   - Framework preset: `None` (Static HTML 이므로 지정하지 않음)
   - Build command: (비워둠)
   - Build output directory: `.` (현재 폴더)
   - **[Save and Deploy]** 클릭하여 첫 배포 완료.
4. `wrangler.jsonc`에서 운영과 Preview D1 바인딩을 각각 설정합니다.
   - 바인딩 변수명: `sonzil`
   - Production: `sonzilkingdb`
   - Preview: `sonzilking-test`
5. 테스트 DB를 처음 만들었거나 스키마를 갱신할 때 `npm run init-db:test`를 실행합니다.
6. **재배포**:
   - 변경된 설정을 적용하기 위해 **[Deployments]** 탭에서 **[Retry deployment]**를 클릭하거나 새 커밋을 GitHub에 푸시(Push)하면 자동으로 재배포 및 KV 연동이 완료됩니다!
