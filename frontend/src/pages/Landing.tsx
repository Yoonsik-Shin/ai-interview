import { useNavigate } from "react-router-dom";
import styles from "./Landing.module.css";
import { useEffect, useState } from "react";
import { User, getMe, logout } from "../auth/authApi";

export function Landing() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const isLoggedIn = !!localStorage.getItem("accessToken");

  useEffect(() => {
    if (isLoggedIn) {
      getMe()
        .then(setUser)
        .catch((err) => {
          console.error("Failed to fetch user info", err);
          // 토큰이 유효하지 않은 경우 로그아웃 처리
          localStorage.removeItem("accessToken");
          // 필요하면 로그인 페이지로 리다이렉트하거나 상태 갱신
        });
    }
  }, [isLoggedIn]);

  const handleStart = () => {
    if (isLoggedIn) {
      navigate("/setup");
    } else {
      navigate("/login");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken"); // 클라이언트 사이드 정리
      setUser(null);
      window.location.reload(); // 상태 초기화를 위해 새로고침
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>AI 면접 연습</h1>
        <p className={styles.subtitle}>
          실전과 같은 AI 면접으로 완벽하게 준비하세요
        </p>

        {isLoggedIn ? (
          <div className={styles.loggedInContainer}>
            {user && (
              <div className={styles.profileInfo}>
                <p className={styles.greeting}>
                  안녕하세요, <strong>{user.nickname}</strong>님!
                </p>
                <p className={styles.email}>{user.email}</p>
              </div>
            )}

            <button className={styles.startButton} onClick={handleStart}>
              면접 시작하기
            </button>

            <button className={styles.logoutButton} onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        ) : (
          <div className={styles.authButtons}>
            <button
              className={styles.loginButton}
              onClick={() => navigate("/login")}
            >
              로그인
            </button>
            <button
              className={styles.registerButton}
              onClick={() => navigate("/register")}
            >
              회원가입
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
