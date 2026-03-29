import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "@/auth/authApi";
import { Toast } from "@/components/Toast";
import { PasswordInput } from "@/components/auth/PasswordInput";
import logo from "@/assets/logo.png";
import styles from "./Auth.module.css";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { accessToken } = await login({ email, password });
      localStorage.setItem("accessToken", accessToken);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
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
        <h1 className={styles.title}>로그인</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={styles.input}
          />
          <PasswordInput
            placeholder="비밀번호"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            hideRules={true}
          />
          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>
        <div className={styles.divider}>
          <span>또는</span>
        </div>
        <a href="/api/v1/auth/google" className={styles.googleBtn}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Google로 계속하기
        </a>
        <p className={styles.footer}>
          계정이 없으시면 <Link to="/register">회원가입</Link>
        </p>
      </div>
      {error && (
        <Toast
          message={error}
          onClose={() => setError("")}
          autoDismissMs={5000}
        />
      )}
    </div>
  );
}
