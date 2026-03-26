import { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { completeOAuthProfile } from "@/auth/authApi";
import { Toast } from "@/components/Toast";
import { PasswordInput, isPasswordValid } from "@/components/auth/PasswordInput";
import { PasswordConfirmInput } from "@/components/auth/PasswordConfirmInput";
import logo from "@/assets/logo.png";
import styles from "./Auth.module.css";

export function CompleteProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pendingToken =
    (location.state as { pendingToken?: string })?.pendingToken ??
    searchParams.get("pending_token") ??
    "";

  const [role, setRole] = useState<"CANDIDATE" | "RECRUITER" | "">("");
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!role) errors.role = "역할을 선택해주세요.";
    if (nickname.length < 2 || nickname.length > 20)
      errors.nickname = "닉네임은 2~20자여야 합니다.";
    if (!/^[가-힣a-zA-Z0-9]+$/.test(nickname))
      errors.nickname = "닉네임은 한글, 영문, 숫자만 사용 가능합니다.";
    const rawPhone = phoneNumber.replace(/-/g, "");
    if (!/^01[016789][0-9]{7,8}$/.test(rawPhone))
      errors.phoneNumber = "올바른 휴대폰 번호 형식이 아닙니다.";
    if (!isPasswordValid(password))
      errors.password = "비밀번호 규칙을 확인해주세요.";
    if (password !== confirmPassword)
      errors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      const { accessToken } = await completeOAuthProfile({
        pendingToken,
        role: role as "CANDIDATE" | "RECRUITER",
        nickname,
        phoneNumber: phoneNumber.replace(/-/g, ""),
        password,
      });
      localStorage.setItem("accessToken", accessToken);
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "프로필 등록 실패";
      if (msg.includes("만료") || msg.includes("유효하지 않")) {
        setIsExpired(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (isExpired) {
    return (
      <div className={styles.wrap}>
        <div className={styles.backgroundGlow}></div>
        <div className={styles.logoContainer}>
          <img src={logo} alt="Unbrdn" className={styles.logo} />
        </div>
        <div className={styles.card}>
          <h1 className={styles.title}>세션 만료</h1>
          <p style={{ color: "#94a3b8", textAlign: "center", marginBottom: "1.5rem" }}>
            프로필 등록 세션이 만료되었습니다.<br />Google 로그인을 다시 시도해주세요.
          </p>
          <button
            className={styles.btn}
            style={{ width: "100%" }}
            onClick={() => navigate("/login", { replace: true })}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!pendingToken) {
    return (
      <div style={{ color: "#f1f5f9", textAlign: "center", marginTop: "4rem" }}>
        잘못된 접근입니다. <a href="/login" style={{ color: "#10b981" }}>로그인</a>으로 이동하세요.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.backgroundGlow}></div>

      <div className={styles.logoContainer}>
        <img src={logo} alt="Unbrdn" className={styles.logo} />
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>프로필 설정</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputField}>
            <div className={styles.roleGroup}>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "CANDIDATE" ? styles.roleBtnActive : ""}`}
                onClick={() => setRole("CANDIDATE")}
              >
                지원자
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${role === "RECRUITER" ? styles.roleBtnActive : ""}`}
                onClick={() => setRole("RECRUITER")}
              >
                채용담당자
              </button>
            </div>
            {fieldErrors.role && <p className={styles.errorText}>{fieldErrors.role}</p>}
          </div>

          <div className={styles.inputField}>
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={`${styles.input} ${fieldErrors.nickname ? styles.inputError : ""}`}
            />
            {fieldErrors.nickname && <p className={styles.errorText}>{fieldErrors.nickname}</p>}
          </div>

          <div className={styles.inputField}>
            <input
              type="tel"
              placeholder="휴대폰 번호 (010-1234-5678)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
              className={`${styles.input} ${fieldErrors.phoneNumber ? styles.inputError : ""}`}
            />
            {fieldErrors.phoneNumber && (
              <p className={styles.errorText}>{fieldErrors.phoneNumber}</p>
            )}
          </div>

          <div className={styles.inputField}>
            <PasswordInput
              value={password}
              onChange={setPassword}
              error={fieldErrors.password}
            />
          </div>

          <div className={styles.inputField}>
            <PasswordConfirmInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              password={password}
              error={fieldErrors.confirmPassword}
            />
          </div>

          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "등록 중…" : "시작하기"}
          </button>
        </form>
      </div>

      {error && <Toast message={error} onClose={() => setError("")} autoDismissMs={5000} />}
    </div>
  );
}
