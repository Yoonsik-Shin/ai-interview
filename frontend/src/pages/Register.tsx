import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, type RegisterReq } from "@/auth/authApi";
import { Toast } from "@/components/Toast";
import { PasswordInput, isPasswordValid } from "@/components/auth/PasswordInput";
import { PasswordConfirmInput } from "@/components/auth/PasswordConfirmInput";
import { ProfileFormFields, type Role } from "@/components/auth/ProfileFormFields";
import logo from "@/assets/logo.png";
import styles from "./Auth.module.css";

interface FieldErrors {
  [key: string]: string | undefined;
  email?: string;
  password?: string;
  confirmPassword?: string;
  nickname?: string;
  phoneNumber?: string;
  companyCode?: string;
}

function validateEmail(value: string): string | undefined {
  if (!value) return "이메일을 입력해주세요";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "올바른 이메일 형식이 아닙니다";
}

function validateNickname(value: string): string | undefined {
  if (!value) return "닉네임을 입력해주세요";
  if (value.length < 2) return "닉네임은 최소 2자 이상이어야 합니다";
  if (value.length > 20) return "닉네임은 최대 20자 이하이어야 합니다";
  if (!/^[가-힣a-zA-Z0-9]+$/.test(value)) return "한글, 영문, 숫자만 사용 가능합니다";
}

function validatePhoneNumber(value: string): string | undefined {
  if (!value) return "전화번호를 입력해주세요";
  const digits = value.replace(/-/g, "");
  if (!/^01[016789][0-9]{3,4}[0-9]{4}$/.test(digits))
    return "올바른 전화번호 형식이 아닙니다 (예: 01012345678)";
}

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterReq>({
    email: "",
    password: "",
    role: "CANDIDATE",
    nickname: "",
    phoneNumber: "",
    companyCode: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function setFieldError(field: keyof FieldErrors, message: string | undefined) {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }

  function handleBlur(field: keyof FieldErrors) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    switch (field) {
      case "email":
        setFieldError("email", validateEmail(form.email));
        break;
      case "password":
        setFieldError("password", isPasswordValid(form.password) ? undefined : "비밀번호 규칙을 확인해주세요");
        if (touched.confirmPassword) {
          setFieldError(
            "confirmPassword",
            confirmPassword && confirmPassword !== form.password
              ? "비밀번호가 일치하지 않습니다"
              : undefined,
          );
        }
        break;
      case "confirmPassword":
        setFieldError(
          "confirmPassword",
          confirmPassword !== form.password ? "비밀번호가 일치하지 않습니다" : undefined,
        );
        break;
      case "nickname":
        setFieldError("nickname", validateNickname(form.nickname));
        break;
      case "phoneNumber":
        setFieldError("phoneNumber", validatePhoneNumber(form.phoneNumber ?? ""));
        break;
      case "companyCode":
        if (form.role === "RECRUITER" && !form.companyCode) {
          setFieldError("companyCode", "회사 코드를 입력해주세요");
        } else {
          setFieldError("companyCode", undefined);
        }
        break;
    }
  }

  function validateAll(): boolean {
    const errors: FieldErrors = {
      email: validateEmail(form.email),
      password: isPasswordValid(form.password) ? undefined : "비밀번호 규칙을 확인해주세요",
      confirmPassword:
        confirmPassword !== form.password ? "비밀번호가 일치하지 않습니다" : undefined,
      nickname: validateNickname(form.nickname),
      phoneNumber: validatePhoneNumber(form.phoneNumber ?? ""),
      companyCode:
        form.role === "RECRUITER" && !form.companyCode ? "회사 코드를 입력해주세요" : undefined,
    };
    setFieldErrors(errors);
    setTouched({ email: true, password: true, confirmPassword: true, nickname: true, phoneNumber: true, companyCode: true });
    return !Object.values(errors).some(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll()) return;

    setError("");
    setLoading(true);
    try {
      const payload: RegisterReq = {
        ...form,
        phoneNumber: (form.phoneNumber ?? "").replace(/-/g, ""),
      };
      await register(payload);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.backgroundGlow}></div>

      <div className={styles.logoContainer}>
        <img src={logo} alt="Unbrdn" className={styles.logo} />
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>회원가입</h1>
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {/* 이메일 */}
          <div className={styles.inputField}>
            <input
              type="email"
              placeholder="이메일"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              onBlur={() => handleBlur("email")}
              autoComplete="email"
              className={`${styles.input} ${touched.email && fieldErrors.email ? styles.inputError : ""}`}
            />
            {touched.email && fieldErrors.email && (
              <span className={styles.errorText}>{fieldErrors.email}</span>
            )}
          </div>

          {/* 비밀번호 */}
          <div className={styles.inputField}>
            <PasswordInput
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              onBlur={() => handleBlur("password")}
              placeholder="비밀번호"
              autoComplete="new-password"
              error={touched.password ? fieldErrors.password : undefined}
            />
          </div>

          {/* 비밀번호 확인 */}
          <div className={styles.inputField}>
            <PasswordConfirmInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              password={form.password}
              onBlur={() => handleBlur("confirmPassword")}
              error={touched.confirmPassword ? fieldErrors.confirmPassword : undefined}
            />
          </div>

          <ProfileFormFields
            nickname={form.nickname}
            onNicknameChange={(v) => setForm((f) => ({ ...f, nickname: v }))}
            phoneNumber={form.phoneNumber ?? ""}
            onPhoneNumberChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
            role={form.role as Role}
            onRoleChange={(v) =>
              setForm((f) => ({
                ...f,
                role: v,
                companyCode: "",
              }))
            }
            companyCode={form.companyCode}
            onCompanyCodeChange={(v) => setForm((f) => ({ ...f, companyCode: v }))}
            fieldErrors={fieldErrors}
            touched={touched}
            onBlur={(f) => handleBlur(f)}
          />

          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "가입 중…" : "가입"}
          </button>
        </form>
        <div className={styles.divider}>
          <span>또는</span>
        </div>
        <a href="/api/v1/auth/google" className={styles.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google로 계속하기
        </a>
        <p className={styles.footer}>
          이미 계정이 있으시면 <Link to="/login">로그인</Link>
        </p>
      </div>
      {error && (
        <Toast message={error} onClose={() => setError("")} autoDismissMs={5000} />
      )}
    </div>
  );
}
