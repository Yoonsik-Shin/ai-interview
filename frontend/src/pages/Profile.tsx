import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, getMe, logout } from "../auth/authApi";
import styles from "./Profile.module.css";
import { Skeleton } from "../components/Skeleton";
import { Toast } from "../components/Toast";

export function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((err) => {
        console.error("Failed to fetch user info", err);
        setError("사용자 정보를 불러오는데 실패했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/";
    } catch (e) {
      console.error("Logout failed", e);
      setError("로그아웃 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.profileContainer}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← 이전으로
        </button>

        {loading ? (
          <div className={styles.skeletonContainer}>
            <div className={styles.header}>
              <Skeleton
                circle
                width={100}
                height={100}
                className={styles.mxAuto}
              />
              <div className={styles.headerInfo}>
                <Skeleton
                  width={150}
                  height={28}
                  className={`${styles.mxAuto} ${styles.mt1}`}
                />
                <Skeleton
                  width={200}
                  height={18}
                  className={`${styles.mxAuto} ${styles.mt1}`}
                />
              </div>
            </div>
            <div className={styles.content}>
              <div className={styles.section}>
                <Skeleton width={80} height={20} className={styles.mb1} />
                <Skeleton width="100%" height={24} />
              </div>
              <div className={styles.section}>
                <Skeleton width={80} height={20} className={styles.mb1} />
                <Skeleton width="100%" height={24} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.avatarBig}>
                {user?.nickname?.charAt(0)}
              </div>
              <div className={styles.headerInfo}>
                <h1 className={styles.nickname}>{user?.nickname}님</h1>
                <p className={styles.email}>{user?.email}</p>
              </div>
            </div>

            <div className={styles.content}>
              <div className={styles.section}>
                <h3>가입 이메일</h3>
                <p>{user?.email}</p>
              </div>
              <div className={styles.section}>
                <h3>닉네임</h3>
                <p>{user?.nickname}</p>
              </div>
              <div className={styles.actionSection}>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  로그아웃
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <Toast
          message={error}
          onClose={() => setError("")}
          autoDismissMs={3000}
        />
      )}
    </div>
  );
}
