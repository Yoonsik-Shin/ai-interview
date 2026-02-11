import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "@/auth/authApi";
import { Toast } from "@/components/Toast";
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
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={styles.input}
          />
          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>
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
