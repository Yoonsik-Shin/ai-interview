# AI 인터뷰 프론트엔드

React + TypeScript + Vite 기반 웹 앱. 노트북·모바일 공통 사용을 위해 PWA(manifest)를 지원합니다.

## 실행

```bash
pnpm install
pnpm dev
```

개발 서버는 `http://localhost:5173` 에서 동작합니다.  
`/api` → BFF, `/socket.io` → Socket 서비스로 프록시되므로 BFF·Socket을 로컬에서 띄워 두어야 합니다.

## 환경 변수

- `VITE_API_BASE`: BFF API 베이스 (기본 ` /api`)
- `VITE_SOCKET_URL`: Socket 서버 URL (비우면 현재 origin 사용, 프록시 활용)

## 구조

- **인증**: 로그인·회원가입, JWT(accessToken) + refreshToken(cookie)
- **홈**: 이력서 업로드 또는 ID 입력 후 인터뷰 생성 → `/interview/:id` 이동
- **인터뷰**: Socket.IO 연결, 오디오 녹음 → `interview:audio_chunk` 전송, STT/LLM/TTS 이벤트 수신 및 재생

## 빌드

```bash
pnpm build
pnpm preview
```
