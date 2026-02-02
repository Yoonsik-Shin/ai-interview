# Entity Mapping Document

**Generated from:** unbrdn-snapshot.json
**Date:** 2026-01-13T15:25:45.667Z
**Total Oracle DB Entities:** 30

## Table of Contents

1. [Entity Overview](#entity-overview)
2. [Entity Hierarchy](#entity-hierarchy)
3. [Entity Details](#entity-details)
4. [Relationship Mappings](#relationship-mappings)
5. [Enum Types](#enum-types)
6. [DDD Implementation Guide](#ddd-implementation-guide)

## Entity Overview

| Entity Name (Korean) | Table Name | Primary Key(s) | Comment |
|---------------------|------------|----------------|---------|
| PG 결제 내역 | `Payment` | Key |  |
| 약관 | `Term` | id |  |
| 관리자 계정 (별도관리) | `admin` | id |  |
| 관리자 활동 로그 | `admin_audit` | id |  |
| 면접자 | `candidate` | N/A |  |
| 면접자 희망 직무분야 | `candidate_desire_job_field` | N/A |  |
| 면접자 스킬 | `candidate_skills` | N/A |  |
| 커리어 | `career` | id |  |
| 크레딧 장부 | `credit_transaction` | id |  |
| 면접 세션 | `interview_session` | id |  |
| 유저 구매 상품 인벤토리 | `inventory` | id |  |
| 직무분야 | `job_field` | id |  |
| 소셜로그인 지원 플랫폼 | `oauth_provider` | id |  |
| 단품 패키지 상품 | `package` | id |  |
| 패키지 구성품 | `package_content` | id |  |
| PG사 | `pg_provider` | id |  |
| 구독 플랜 | `plan` | id |  |
| 구독플랜별 월 제공량 | `plan_quota` | id |  |
| 상품 | `product` | id |  |
| 상품 사용 이력 | `product_usage_history` | id |  |
| 채용담당자 | `recruiter` | N/A |  |
| 이력서 | `resume` | id |  |
| 기술스택 | `skill` | id |  |
| 구독 계약서 | `subscription` | id |  |
| 구독 할당량 사용량 | `subscription_usages` | Key |  |
| 유저 (공통속성) | `user` | id |  |
| 유저 연동 소셜로그인 플랫폼 | `user_oauths` | N/A |  |
| 유저개인설정 | `user_options` | N/A |  |
| 약관동의여부 | `user_term_agreement` | N/A |  |
| 크레딧 관리 지갑 | `wallet` | id |  |

## Entity Hierarchy

### Core Entities

```
User (유저)
├── Candidate (면접자)
│   ├── Resume (이력서)
│   ├── Career (커리어)
│   ├── Candidate_Skills (면접자 스킬)
│   └── Candidate_Desire_Job_Field (희망 직무분야)
├── Recruiter (채용담당자)
├── User_Oauths (소셜로그인 연동)
├── User_Options (유저개인설정)
├── User_Term_Agreement (약관동의)
└── Wallet (크레딧 지갑)
    └── Credit_Transaction (크레딧 장부)

Product (상품)
├── Package (패키지 상품)
│   └── Package_Content (패키지 구성품)
├── Inventory (구매 상품 인벤토리)
└── Product_Usage_History (사용 이력)

Subscription (구독)
├── Plan (구독 플랜)
│   └── Plan_Quota (플랜별 할당량)
└── Subscription_Usages (구독 사용량)

Interview_Session (면접 세션)

Payment (결제)
└── PG_Provider (PG사)
```

## Entity Details

### PG 결제 내역 (`Payment`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| Key | `Key` |  | No | ✓ |  |  |  |
| 결제금액 | `amount` | Integer | No |  |  |  |  |
| 통화 | `currency` | String | No |  |  |  |  |
| 결제상태 | `status` | Enum | No |  |  |  | PENDING, SUCCESS, FAILED, REFUNDED |
| 서비스내부 상품 ID | `merchant_uid` | String | No |  |  |  | 주문번호 |
| 결제 승인 시간 | `paid_at` | Date | Yes |  |  |  |  |
| 결제 내역 생성일시 | `created_at` | Date | No |  |  |  |  |
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
| PG사 ID | `pg_provider_id` | String | No |  | ✓ |  |  |

### 약관 (`Term`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 약관ID | `id` |  | No | ✓ |  |  |  |
| 약관명 | `title` | String | No |  |  |  |  |
| 약관내용 | `content` | String | No |  |  |  |  |
| 약관 버전 | `version` | Integer | No |  |  |  |  |
| 지원종료일 | `deprecated_at` | Date | Yes |  |  |  |  |

### 관리자 계정 (별도관리) (`admin`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 관리자ID | `id` | String | No | ✓ |  |  |  |
| 회원가입 이메일 | `email` | String | No |  |  |  |  |
| 비밀번호 | `password` | String | No |  |  |  |  |
| 역할 | `role` | Enum | No |  |  |  | MASTER |
| 계정활성상태 | `is_active` | Enum | No |  |  |  | ACTIVE, DORMANT |
| 계정 생성 시간 | `created_at` | Date | No |  |  |  |  |
| 계정 최신 업데이트시간 | `updated_at` | Date | No |  |  |  |  |
| 핸드폰번호 | `phone_number` | String | No |  |  |  | 010-0000-0000 |
| 이메일인증 | `verified_email` | String | Yes |  |  | NULL | 인증받은 이메일값 |
| 프로필사진 주소 | `profile_image_url` | String | Yes |  |  | NULL | Object Storage 주소 |
| 계정 삭제 시간 | `deleted_at` | Date | Yes |  |  | NULL |  |
| 최근 계정 로그인 시간 | `last_logined_at` | Date | Yes |  |  | NULL |  |

### 관리자 활동 로그 (`admin_audit`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 관리자 계정 기록 ID | `id` | String | No | ✓ |  |  |  |
| 대상 테이블 | `target_table` | String | No |  |  | NULL | 변경된 데이터의 테이블 |
| 대상 ID | `target_id` | String | No |  |  |  | 변경된 데이터의 PK |
| 행위 유형 | `action_type` | Enum | No |  |  |  | CREATE, UPDATE, DELETE, PATCH, PUT |
| 변경 내용 | `changes` | JSON | No |  |  |  | 이전값/변경값 (JSON) |
| 접속 IP | `ip_address` | String | No |  |  |  |  |
| 생성 일시 | `created_at` | Date | No |  |  |  |  |
| 관리자ID | `admin_id` | String | No |  | ✓ |  |  |

### 면접자 (`candidate`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 사용자ID | `id` | String | No |  | ✓ |  |  |

### 면접자 희망 직무분야 (`candidate_desire_job_field`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
| 직무분야ID | `job_field_id` | String | No |  | ✓ |  |  |

### 면접자 스킬 (`candidate_skills`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
| 스킬ID | `skill_id` | String | No |  | ✓ |  |  |
| 숙련도 | `proficiency` | Enum | Yes |  |  |  | TRIED: 사용해봄, SKILLED: 능숙한, NULL: 노출 X |

### 커리어 (`career`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 경력ID | `id` |  | No | ✓ |  |  |  |
| 회사명 | `company_name` | String | No |  |  |  |  |
| 부서 | `department` | String | Yes |  |  |  |  |
| 입사일 | `started_at` | Date | No |  |  |  |  |
| 퇴사일 | `ended_at` | Date | Yes |  |  |  |  |
| 간단소개 | `description` | String | Yes |  |  |  |  |
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
| 직무분야ID | `job_field_id` | String | No |  | ✓ |  |  |

### 크레딧 장부 (`credit_transaction`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 크레딧 장부 ID | `id` | String | No | ✓ |  |  |  |
| 증감량 | `amount` | Integer | No |  |  |  | 음수 가능 |
| 증감이유 | `type` | Enum | No |  |  |  | 추가 고려 필요 |
| 참조 타입 | `reference_type` | Enum | No |  |  |  |  |
| 참조 ID | `reference_id` | String | Yes |  |  |  |  |
| 지갑 ID | `wallet_id` | String | No |  | ✓ |  |  |

### 면접 세션 (`interview_session`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 면접 세션 ID | `id` | String | No | ✓ |  |  |  |
| 면접명 | `title` | String | No |  |  |  | Default: interview_당일시간 |
| 인터뷰 진행상황 | `status` | Enum | No |  |  |  | READY, INPROGRESS, PROCESSING, COMPETED, CANCELED |
| 면접 시작 시간 | `started_at` | Date | Yes |  |  |  |  |
| 면접 종료 시간 | `ended_at` | Date | Yes |  |  |  |  |
| 면접 전체 영상 저장 위치 | `full_video_url` | String | Yes |  |  |  |  |
| 썸네일 저장 위치 | `thumbnail_url` | String | Yes |  |  |  |  |
| 강제종료시간 | `canceled_at` | Date | Yes |  |  |  |  |
| 이력서ID | `resume_id` | String | No |  | ✓ |  |  |

### 유저 구매 상품 인벤토리 (`inventory`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 인벤토리 ID | `id` | String | No | ✓ |  |  |  |
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
| 상품 ID | `product_id` | String | No |  | ✓ |  |  |
| 총 지급 수량 | `total_count` | Integer | No |  |  |  |  |
| 잔여 수량 | `remaining_count` | Integer | No |  |  |  |  |
| 먄료 일시 | `expired_at` | Date | No |  |  |  |  |
| 상태 | `status` | Enum | No |  |  |  | ACTIVE, EXPIRED, EXHAUSTED |

### 직무분야 (`job_field`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 직무분야ID | `id` | String | No | ✓ |  |  |  |
| 직무분야명 | `name` | String | No |  |  |  |  |

### 소셜로그인 지원 플랫폼 (`oauth_provider`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 소셜로그인지원플랫폼ID | `id` | String | No | ✓ |  |  |  |
| 플랫폼명 | `company_name` |  | No |  |  |  |  |

### 단품 패키지 상품 (`package`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 단품 패키지 ID | `id` | String | No | ✓ |  |  |  |
| 패키지 이름 | `name` | String | No |  |  |  |  |
| 패키지 가격 | `price` | Integer | No |  |  |  | 크레딧을 의미 |
| 패키지 설명 | `description` | String | Yes |  |  |  |  |

### 패키지 구성품 (`package_content`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 패키지 구성품 ID | `id` | String | No | ✓ |  |  |  |
| 지급 수량 | `quantity` | Integer | No |  |  |  |  |
| 단품 패키지 ID | `package_id` | String | No |  | ✓ |  |  |
| 상품 ID | `product_id` | String | No |  | ✓ |  |  |

### PG사 (`pg_provider`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| PG사 ID | `id` | String | No | ✓ |  |  |  |
| PG사 이름 | `name` | String | No |  |  |  |  |

### 구독 플랜 (`plan`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 구독 플랜 ID | `id` | String | No | ✓ |  |  |  |
| 구독 플랜명 | `name` | String | No |  |  |  | Standard, Premium |
| 월간 가격 | `price_monthly` | Integer | No |  |  |  |  |
| 연간 가격 | `price_yearly` | Integer | No |  |  |  |  |
| 결제 주기 | `billing_cycle` |  | Yes |  |  |  | MONTHLY, YEARLY |
| 플랜 등급 | `level` |  | Yes |  |  |  | 상위 플랜 업그레이드 판단용 |

### 구독플랜별 월 제공량 (`plan_quota`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 구독플랜별 월 제공량 ID | `id` |  | No | ✓ |  |  |  |
| 기능코드 | `feature_code` | Enum | No |  |  |  | AI_INTERVIEW_LIMIT |
| 제한값 | `limit_value` | Integer | No |  |  |  | -1이면 무제한 |
| 초기화 주기 | `frequency` | Enum | No |  |  |  | MONTHLY, DAILY |
| 상품 ID | `product_id` | String | No |  | ✓ |  |  |
| 구독 플랜 ID | `plan_id` | String | No |  | ✓ |  |  |

### 상품 (`product`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 상품 ID | `id` | String | No | ✓ |  |  |  |
| 상품명 | `name` | String | No |  |  |  |  |
| 상품유형 | `type` | Enum | No |  |  |  | SUBSCRIPTION, ONE_TIME, CREDIT |
| 가격 | `price` | Integer | No |  |  |  |  |
| 통화 | `currency` | String | No |  |  |  |  |
| 상품 설명 | `description` | String | Yes |  |  |  |  |
| 판매 가능 여부 | `deprecated_at` | Boolean | Yes |  |  |  |  |

### 상품 사용 이력 (`product_usage_history`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 상품 사용 이력 ID | `id` | String | No | ✓ |  |  |  |
| 증감유형 | `source_type` | Enum | No |  |  |  | SUBSCRIPTION, INVENTORY |
| 증감수량 | `amount` | Integer | No |  |  |  |  |
| 차감 근거 타입 | `reference_id` | String | No |  |  |  |  |
| 차감 근거 관계 | `reference_type` | Enum | No |  |  |  | INTERVIEW_SESSION, RESUME_VIEW |
| 상품 사용일 | `created_at` | Date | No |  |  |  |  |
| 상품 ID | `product_id` | String | No |  | ✓ |  |  |
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |

### 채용담당자 (`recruiter`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 사용자ID | `id` | VARCHAR | No |  | ✓ |  |  |

### 이력서 (`resume`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 이력서ID | `id` |  | No | ✓ |  |  |  |
| 이력서 이름 | `title` |  | No |  |  |  |  |
| 이력서 부가 설명 | `description` |  | Yes |  |  |  |  |
| 이력시 원본 저장소 위치 | `original_url` |  | No |  |  |  |  |
| 이력서 추출 텍스트 | `extract_text` |  | No |  |  |  |  |
| 이력서 추출 이미지 | `extract_image` | JSON | Yes |  |  |  | 이미지 url 배열 |
| 사용자ID | `user_id` | VARCHAR | No |  | ✓ |  |  |

### 기술스택 (`skill`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 스킬ID | `id` | String | No | ✓ |  |  |  |
| 스킬명 | `name` | String | No |  |  |  |  |
| 카테고리 | `category` | Enum | No |  |  |  | Language, Framework, DB |
| 스킬 배지 이미지 저장 공간 | `badge_image` | String | Yes |  |  |  | 별도 정적 이미지로 저장 |

### 구독 계약서 (`subscription`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 구독 ID | `id` | String | No | ✓ |  |  |  |
| 구독 플랜 ID | `plan_id` | String | No |  | ✓ |  |  |
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |

### 구독 할당량 사용량 (`subscription_usages`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| Key | `Key` |  | No | ✓ |  |  |  |
| 구독 ID | `subscription_id` | String | No |  | ✓ |  |  |
| 상품 ID | `product_id` | String | No |  | ✓ |  |  |

### 유저 (공통속성) (`user`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 사용자ID | `id` | String | No | ✓ |  |  |  |
| 회원가입 이메일 | `email` | String | No |  |  |  |  |
| 비밀번호 | `password` | String | No |  |  |  |  |
| 역할 | `role` | Enum | No |  |  |  | CANDIDATE, RECRUITER |
| 계정활성상태 | `is_active` | Enum | No |  |  |  | ACTIVE, DORMANT |
| 계정 생성 시간 | `created_at` | Date | No |  |  |  |  |
| 계정 최신 업데이트시간 | `updated_at` | Date | No |  |  |  |  |
| 핸드폰번호 | `phone_number` | String | No |  |  |  | 010-0000-0000 |
| 이메일인증 | `verified_email` | String | Yes |  |  | NULL | 인증받은 이메일값 |
| 프로필사진 주소 | `profile_image_url` | String | Yes |  |  | NULL | Object Storage 주소 |
| 계정 삭제 시간 | `deleted_at` | Date | Yes |  |  | NULL |  |
| 최근 계정 로그인 시간 | `last_logined_at` | Date | Yes |  |  | NULL |  |

### 유저 연동 소셜로그인 플랫폼 (`user_oauths`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
| 소셜로그인지원플랫폼ID | `provider_id` | String | No |  | ✓ |  |  |
| 제공자측 사용ID | `provider_user_id` | String | No |  |  |  | OAuth 제공자가 리턴하는 고유 사용자 식별값 |
| 엑세트 토큰 | `access_token` | String | No |  |  |  |  |
| 토큰 만료 일시 | `token_expires_at` | Date | No |  |  |  |  |

### 유저개인설정 (`user_options`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 프로필 공개 여부 | `is_profile_public` | Boolean | No |  |  |  | Default: False |
| 이력서 공개 여부 | `is_resume_public` | Boolean | No |  |  |  | Default: False |
| 인터뷰 공개 여부 | `is_interview_public` | Boolean | No |  |  |  | Default: False |
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |

### 약관동의여부 (`user_term_agreement`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
| 약관ID | `term_id` | String | No |  | ✓ |  |  |
| 약관동의여부 | `is_agreed` | Boolean | No |  |  |  |  |
| 약관동의일시 | `agreed_at` | Date | No |  |  |  |  |
| 접속IP주소 | `ip_address` | String | Yes |  |  |  | 부인방지를 위한 당시 IP주소 |

### 크레딧 관리 지갑 (`wallet`)

| Field Name (Korean) | Column Name | Type | Nullable | PK | FK | Default | Comment |
|---------------------|-------------|------|----------|----|----|---------|---------|
| 지갑 ID | `id` | String | No | ✓ |  |  |  |
| 무료 크레딧 | `free_credits` | Integer | No |  |  |  | Default: 2000 |
| 추가 크레딧 | `paid_credits` | Integer | No |  |  |  | Default: 0 |
| 지갑 업데이트 시간 | `updated_at` | Date | No |  |  |  |  |
| 사용자ID | `user_id` | String | No |  | ✓ |  |  |
## Relationship Mappings

### All Foreign Key Relationships

| From Entity | From Field | Relationship Type | To Entity | To Field |
|-------------|------------|-------------------|-----------|----------|
| `user_term_agreement` | `user_id` | ZERO_OR_MANY | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `user_term_agreement` | `term_id` | ZERO_OR_MANY | `og6255hiqRcesG5sd` | `haFMJyaaWoFrcB7j6` |
| `product_usage_history` | `product_id` | ZERO_OR_ONE_OR_MANY | `4LWXRwfEu5HquZghw` | `3dhMYbi52H6XLZyts` |
| `product_usage_history` | `user_id` | ZERO_OR_MANY | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `recruiter` | `id` | ONE | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `career` | `user_id` | ZERO_OR_MANY | `r2nWRBZFusZwYdpR2` | `kRirJyCvYSw6BgDot` |
| `career` | `job_field_id` | ZERO_OR_ONE_OR_MANY | `jzdSSq3Bbp5C8r3iE` | `26p2xZfHNhHfKvaau` |
| `admin_audit` | `admin_id` | ZERO_OR_MANY | `GjA22SnGvM6NEqDht` | `NRY5CYCPoWGbfFnHh` |
| `credit_transaction` | `wallet_id` | ONE_OR_MANY | `hrEzrEnyKZPMcEcBR` | `pbA4ud8wcFLg8bywX` |
| `user_oauths` | `user_id` | ZERO_OR_MANY | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `user_oauths` | `provider_id` | ZERO_OR_MANY | `HodZSiRaRxMEairsK` | `7GSMhQrY2fSgWWFQT` |
| `interview_session` | `resume_id` | ZERO_OR_ONE_OR_MANY | `trEf2QmyiBXuSzQhC` | `zywn6K2ebYnc9KLtv` |
| `candidate_desire_job_field` | `user_id` | ZERO_OR_ONE_OR_MANY | `r2nWRBZFusZwYdpR2` | `kRirJyCvYSw6BgDot` |
| `candidate_desire_job_field` | `job_field_id` | ZERO_OR_ONE_OR_MANY | `jzdSSq3Bbp5C8r3iE` | `26p2xZfHNhHfKvaau` |
| `package_content` | `package_id` | ZERO_OR_MANY | `3FGfPvDkv2jXsH2bG` | `g8BpfjnxJpQJEWaWk` |
| `package_content` | `product_id` | ZERO_OR_MANY | `4LWXRwfEu5HquZghw` | `3dhMYbi52H6XLZyts` |
| `wallet` | `user_id` | ONE | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `candidate_skills` | `user_id` | ZERO_OR_MANY | `r2nWRBZFusZwYdpR2` | `kRirJyCvYSw6BgDot` |
| `candidate_skills` | `skill_id` | ZERO_OR_MANY | `zfvcj6BmpzMPBHP3R` | `26p2xZfHNhHfKvaau` |
| `inventory` | `user_id` | ZERO_OR_MANY | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `inventory` | `product_id` | ZERO_OR_MANY | `4LWXRwfEu5HquZghw` | `3dhMYbi52H6XLZyts` |
| `candidate` | `id` | ONE | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `user_options` | `user_id` | ONE | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `subscription` | `plan_id` | ZERO_OR_MANY | `us4nphWYrd4xMkAQR` | `9NhCZpJYPFxAYygnt` |
| `subscription` | `user_id` | ZERO_OR_ONE | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `subscription_usages` | `subscription_id` | ZERO_OR_MANY | `rZ8RjjaKDDyPRrJq7` | `Eco6tjKQ3jLNSYXC3` |
| `subscription_usages` | `product_id` | ZERO_OR_MANY | `4LWXRwfEu5HquZghw` | `3dhMYbi52H6XLZyts` |
| `resume` | `user_id` | ZERO_OR_MANY | `r2nWRBZFusZwYdpR2` | `kRirJyCvYSw6BgDot` |
| `plan_quota` | `product_id` | ZERO_OR_MANY | `4LWXRwfEu5HquZghw` | `3dhMYbi52H6XLZyts` |
| `plan_quota` | `plan_id` | ZERO_OR_MANY | `us4nphWYrd4xMkAQR` | `9NhCZpJYPFxAYygnt` |
| `Payment` | `user_id` | ZERO_OR_MANY | `yHBe94M2AABSkiPMZ` | `NRY5CYCPoWGbfFnHh` |
| `Payment` | `pg_provider_id` | ONLY_ONE | `kpoWZAieKfC8DjfbR` | `DZQQ9SPRcuSoiftib` |

## Enum Types

The following fields are defined as Enum types and will need corresponding Java enums:

### Payment.status

**Korean Name:** 결제상태
**Entity:** PG 결제 내역 (Payment)
**Comment:** PENDING, SUCCESS, FAILED, REFUNDED

```java
public enum Status {
    // TODO: Define enum values based on business requirements
    // PENDING
    // SUCCESS
    // FAILED
    // REFUNDED
}
```

### admin.role

**Korean Name:** 역할
**Entity:** 관리자 계정 (별도관리) (admin)
**Comment:** MASTER

```java
public enum Role {
    // TODO: Define enum values based on business requirements
    // MASTER
}
```

### admin.is_active

**Korean Name:** 계정활성상태
**Entity:** 관리자 계정 (별도관리) (admin)
**Comment:** ACTIVE, DORMANT

```java
public enum IsActive {
    // TODO: Define enum values based on business requirements
    // ACTIVE
    // DORMANT
}
```

### admin_audit.action_type

**Korean Name:** 행위 유형
**Entity:** 관리자 활동 로그 (admin_audit)
**Comment:** CREATE, UPDATE, DELETE, PATCH, PUT

```java
public enum ActionType {
    // TODO: Define enum values based on business requirements
    // CREATE
    // UPDATE
    // DELETE
    // PATCH
    // PUT
}
```

### candidate_skills.proficiency

**Korean Name:** 숙련도
**Entity:** 면접자 스킬 (candidate_skills)
**Comment:** TRIED: 사용해봄, SKILLED: 능숙한, NULL: 노출 X

```java
public enum Proficiency {
    // TODO: Define enum values based on business requirements
    // TRIED: 사용해봄
    // SKILLED: 능숙한
    // NULL: 노출 X
}
```

### credit_transaction.type

**Korean Name:** 증감이유
**Entity:** 크레딧 장부 (credit_transaction)
**Comment:** 추가 고려 필요

```java
public enum Type {
    // TODO: Define enum values based on business requirements
    // 추가 고려 필요
}
```

### credit_transaction.reference_type

**Korean Name:** 참조 타입
**Entity:** 크레딧 장부 (credit_transaction)

```java
public enum ReferenceType {
    // TODO: Define enum values based on business requirements
}
```

### interview_session.status

**Korean Name:** 인터뷰 진행상황
**Entity:** 면접 세션 (interview_session)
**Comment:** READY, INPROGRESS, PROCESSING, COMPETED, CANCELED

```java
public enum Status {
    // TODO: Define enum values based on business requirements
    // READY
    // INPROGRESS
    // PROCESSING
    // COMPETED
    // CANCELED
}
```

### inventory.status

**Korean Name:** 상태
**Entity:** 유저 구매 상품 인벤토리 (inventory)
**Comment:** ACTIVE, EXPIRED, EXHAUSTED

```java
public enum Status {
    // TODO: Define enum values based on business requirements
    // ACTIVE
    // EXPIRED
    // EXHAUSTED
}
```

### plan_quota.feature_code

**Korean Name:** 기능코드
**Entity:** 구독플랜별 월 제공량 (plan_quota)
**Comment:** AI_INTERVIEW_LIMIT

```java
public enum FeatureCode {
    // TODO: Define enum values based on business requirements
    // AI_INTERVIEW_LIMIT
}
```

### plan_quota.frequency

**Korean Name:** 초기화 주기
**Entity:** 구독플랜별 월 제공량 (plan_quota)
**Comment:** MONTHLY, DAILY

```java
public enum Frequency {
    // TODO: Define enum values based on business requirements
    // MONTHLY
    // DAILY
}
```

### product.type

**Korean Name:** 상품유형
**Entity:** 상품 (product)
**Comment:** SUBSCRIPTION, ONE_TIME, CREDIT

```java
public enum Type {
    // TODO: Define enum values based on business requirements
    // SUBSCRIPTION
    // ONE_TIME
    // CREDIT
}
```

### product_usage_history.source_type

**Korean Name:** 증감유형
**Entity:** 상품 사용 이력 (product_usage_history)
**Comment:** SUBSCRIPTION, INVENTORY

```java
public enum SourceType {
    // TODO: Define enum values based on business requirements
    // SUBSCRIPTION
    // INVENTORY
}
```

### product_usage_history.reference_type

**Korean Name:** 차감 근거 관계
**Entity:** 상품 사용 이력 (product_usage_history)
**Comment:** INTERVIEW_SESSION, RESUME_VIEW

```java
public enum ReferenceType {
    // TODO: Define enum values based on business requirements
    // INTERVIEW_SESSION
    // RESUME_VIEW
}
```

### skill.category

**Korean Name:** 카테고리
**Entity:** 기술스택 (skill)
**Comment:** Language, Framework, DB

```java
public enum Category {
    // TODO: Define enum values based on business requirements
    // Language
    // Framework
    // DB
}
```

### user.role

**Korean Name:** 역할
**Entity:** 유저 (공통속성) (user)
**Comment:** CANDIDATE, RECRUITER

```java
public enum Role {
    // TODO: Define enum values based on business requirements
    // CANDIDATE
    // RECRUITER
}
```

### user.is_active

**Korean Name:** 계정활성상태
**Entity:** 유저 (공통속성) (user)
**Comment:** ACTIVE, DORMANT

```java
public enum IsActive {
    // TODO: Define enum values based on business requirements
    // ACTIVE
    // DORMANT
}
```

## DDD Implementation Guide

### Aggregate Roots

Based on the entity relationships, the following entities should be considered as Aggregate Roots:

1. **User** - Central entity for user management
   - Contains: UserOptions, UserTermAgreement, UserOauths
   - Related aggregates: Candidate, Recruiter, Wallet

2. **Candidate** - Job seeker profile and data
   - Contains: Resume, Career, CandidateSkills, CandidateDesireJobField

3. **Recruiter** - Hiring manager profile

4. **Product** - Product catalog management
   - Contains: Package, PackageContent
   - Related: Inventory, ProductUsageHistory

5. **Subscription** - Subscription management
   - Contains: Plan, PlanQuota, SubscriptionUsages

6. **InterviewSession** - Interview session management

7. **Payment** - Payment transaction management
   - Related: PGProvider

8. **Wallet** - Credit management
   - Contains: CreditTransaction

### Value Objects

Consider creating Value Objects for:

- User email, phone number
- Money/Amount for payments and credits
- Date ranges for subscriptions and careers
- Product quantities and quotas

### Repository Pattern

Create repositories for each Aggregate Root:

```java
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
}

public interface CandidateRepository extends JpaRepository<Candidate, Long> {
    Optional<Candidate> findByUserId(Long userId);
}

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByStatus(ProductStatus status);
}

// ... other repositories
```

### JPA Entity Annotations

Key annotations to use:

```java
@Entity
@Table(name = "user")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @Enumerated(EnumType.STRING)
    private UserStatus status;
    
    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    private UserOptions userOptions;
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<UserTermAgreement> termAgreements = new ArrayList<>();
}
```

### Implementation Checklist

- [ ] Define all enum types
- [ ] Create BaseEntity with common audit fields (createdAt, updatedAt, etc.)
- [ ] Implement all entity classes with JPA annotations
- [ ] Define relationship mappings (@OneToOne, @OneToMany, @ManyToOne, @ManyToMany)
- [ ] Create repository interfaces for aggregate roots
- [ ] Implement domain services for business logic
- [ ] Create DTOs for API requests/responses
- [ ] Add validation annotations (@NotNull, @Email, @Pattern, etc.)
- [ ] Configure Oracle database dialect in application.properties
- [ ] Set up database migration scripts (Flyway/Liquibase)

---

**Document generated:** 2026-01-13T15:25:45.667Z

This document provides a comprehensive overview of the database schema and serves as a reference for implementing the domain model using DDD principles and JPA in Spring Boot.