# 🐙 손질왕 업무관리 시스템

손질왕(Sonjilwang)의 판매 및 수매 내역을 효율적으로 등록하고 정산하는 모바일 친화적 웹 어플리케이션입니다.  
이 프로젝트는 **Cloudflare Pages**와 **KV(Key-Value) 저장소**를 활용하여 데이터베이스 서버 없이 완전 무료로 영구 데이터를 안전하게 기록합니다.

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
4. **Cloudflare KV 연동**: 모든 판매/수매 내역과 거래처 목록이 Cloudflare 글로벌 저장소에 영구 보존됩니다.

---

## 🛠 로컬 개발 및 테스트 방법

컴퓨터에서 로컬로 테스트하려면 아래 단계를 따르세요.

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
- 로컬에서 테스트한 KV 데이터는 `.wrangler/` 폴더 내에 로컬로 안전하게 저장되며 실제 클라우드에는 영향을 주지 않습니다.

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

### 2. Cloudflare Pages에 배포 및 KV 연동하기

1. **Cloudflare Dashboard** 로그인 후 **[Workers & Pages]** -> **[Create]** -> **[Pages]** -> **[Connect to Git]** 클릭
2. 방금 올린 GitHub 리포지토리(`sonjilwang`)를 선택하고 **[Begin setup]** 클릭
3. **Build settings** 설정:
   - Framework preset: `None` (Static HTML 이므로 지정하지 않음)
   - Build command: (비워둠)
   - Build output directory: `.` (현재 폴더)
   - **[Save and Deploy]** 클릭하여 첫 배포 완료.
4. **KV 데이터베이스 생성**:
   - Cloudflare 대시보드 좌측 메뉴에서 **[Workers & Pages]** -> **[KV]** -> **[Create namespace]** 클릭
   - namespace 이름으로 `SONJILWANG_KV` 입력 후 생성
5. **Pages 프로젝트에 KV 바인딩(연동)**:
   - 생성된 Pages 프로젝트의 **[Settings]** -> **[Functions]** 탭으로 이동
   - **[KV namespace bindings]** 영역으로 스크롤하여 **[Add binding]** 클릭
   - 아래와 같이 설정 입력:
     - **Variable name**: `SONJILWANG_KV`
     - **KV namespace**: 방금 생성한 `SONJILWANG_KV` 선택
   - **[Save]**를 눌러 저장합니다.
   - ⚠️ **중요**: 배포(Production)와 미리보기(Preview) 설정 모두 바인딩을 완료해주세요.
6. **재배포**:
   - 변경된 설정을 적용하기 위해 **[Deployments]** 탭에서 **[Retry deployment]**를 클릭하거나 새 커밋을 GitHub에 푸시(Push)하면 자동으로 재배포 및 KV 연동이 완료됩니다!
