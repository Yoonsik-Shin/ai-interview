import { useNavigate } from "react-router-dom";
import styles from "./Landing.module.css";
import { useEffect, useState } from "react";
import { User, getMe } from "../auth/authApi";
import logo from "../assets/logo.png";
import heroVisual from "../assets/hero-visual.png";
import { Skeleton } from "../components/Skeleton";

export function Landing() {
  // ... (existing states and logic) ...
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tip, setTip] = useState("");
  const isLoggedIn = !!localStorage.getItem("accessToken");

  const stats = {
    totalPracticeTime: "12h 45m",
    interviewsCompleted: 8,
    averageScore: 84,
  };

  const interviewTips = [
    "결과보다는 과정에서의 논리적 사고를 강조하세요.",
    "자신의 강점을 구체적인 사례(STAR 기법)로 설명하는 연습을 하세요.",
    "AI는 당신의 목소리 톤과 비언어적 표현도 분석하고 있습니다.",
    "모르는 질문에는 솔직하게 인정하되, 아는 범위 내에서 최선을 다해 답변하세요.",
  ];

  const fetchRandomTip = () => {
    setTip(interviewTips[Math.floor(Math.random() * interviewTips.length)]);
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      if (isLoggedIn) {
        try {
          const u = await getMe();
          setUser(u);
        } catch (err) {
          console.error("Failed to fetch user info", err);
          localStorage.removeItem("accessToken");
        }
      }
      setLoading(false);
    }
    init();
    fetchRandomTip();
  }, [isLoggedIn]);

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGlow}></div>
      <div className={styles.content}>
        {isLoggedIn ? (
          <>
            <div className={styles.logoContainer}>
              <img src={logo} alt="Unbrdn" className={styles.logo} />
            </div>
            <p className={styles.heroText}>
              당신의 가능성을 증명하는 가장 완벽한 방법
            </p>
            <div className={styles.loggedInContainer}>
              {/* ... (existing logged in dashboard) ... */}
              <div className={styles.mainGrid}>
                <div className={styles.leftColumn}>
                  {loading ? (
                    <div className={styles.profileCard}>
                      <div className={styles.profileHeader}>
                        <Skeleton circle width={50} height={50} />
                        <div className={styles.profileInfoText}>
                          <Skeleton width={120} height={20} />
                          <Skeleton
                            width={180}
                            height={14}
                            className={styles.mt1}
                          />
                        </div>
                      </div>
                      <div className={styles.gaugeContainer}>
                        <div className={styles.gaugeHeader}>
                          <Skeleton width={100} height={16} />
                          <Skeleton width={40} height={16} />
                        </div>
                        <Skeleton width="100%" height={8} borderRadius={4} />
                        <Skeleton
                          width="60%"
                          height={12}
                          className={styles.mt1}
                        />
                      </div>
                      <div className={styles.statsRow}>
                        <div className={styles.statItem}>
                          <Skeleton width={40} height={24} />
                          <Skeleton
                            width={60}
                            height={12}
                            className={styles.mt1}
                          />
                        </div>
                        <div className={styles.statItem}>
                          <Skeleton width={80} height={24} />
                          <Skeleton
                            width={60}
                            height={12}
                            className={styles.mt1}
                          />
                        </div>
                      </div>
                    </div>
                  ) : user ? (
                    <div
                      className={styles.profileCard}
                      onClick={() => navigate("/profile")}
                      style={{ cursor: "pointer" }}
                    >
                      <div className={styles.profileHeader}>
                        <div className={styles.avatar}>
                          {user.nickname.charAt(0)}
                        </div>
                        <div className={styles.userInfo}>
                          <div className={styles.greetingRow}>
                            <p className={styles.greeting}>
                              반갑습니다, <strong>{user.nickname}</strong>님
                            </p>
                            <span className={styles.profileLinkInline}>
                              프로필 관리 →
                            </span>
                          </div>
                          <p className={styles.email}>{user.email}</p>
                        </div>
                      </div>

                      <div className={styles.gaugeContainer}>
                        <div className={styles.gaugeHeader}>
                          <span className={styles.gaugeLabel}>
                            종합 면접 준비도
                          </span>
                          <span className={styles.gaugeValue}>85%</span>
                        </div>
                        <div className={styles.gaugeTrack}>
                          <div
                            className={styles.gaugeFill}
                            style={{ width: "85%" }}
                          ></div>
                        </div>
                        <p className={styles.gaugeDesc}>
                          실전 면접 준비가 거의 완료되었습니다!
                        </p>
                      </div>

                      <div className={styles.statsRow}>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>
                            {stats.interviewsCompleted}
                          </span>
                          <span className={styles.statLabel}>면접 완료</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>
                            {stats.totalPracticeTime}
                          </span>
                          <span className={styles.statLabel}>연습 시간</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={styles.rightColumn}>
                  <button
                    className={styles.primeStartButton}
                    onClick={() => navigate("/setup")}
                  >
                    <div className={styles.buttonContent}>
                      <span className={styles.primeLabel}>실전 면접 시작</span>
                      <span className={styles.primeDesc}>
                        AI 페르소나와 무제한 연습
                      </span>
                    </div>
                    <span className={styles.buttonIcon}>→</span>
                  </button>

                  <div className={styles.subActionGrid}>
                    <div
                      className={styles.actionCard}
                      onClick={() => navigate("/interviews")}
                    >
                      <span className={styles.actionIcon}>📋</span>
                      <span className={styles.actionLabel}>면접 내역</span>
                    </div>
                    <div
                      className={styles.actionCard}
                      onClick={() => navigate("/resumes")}
                    >
                      <span className={styles.actionIcon}>📁</span>
                      <span className={styles.actionLabel}>이력서 관리</span>
                    </div>
                  </div>

                  <div className={styles.analyticsCard}>
                    <div className={styles.analyticsHeader}>
                      <span className={styles.analyticsLabel}>성장 분석</span>
                      <span className={styles.trendUp}>↑ 12%</span>
                    </div>
                    <p className={styles.analyticsDesc}>
                      최근 논리력 점수가 꾸준히 상승하고 있습니다.
                    </p>
                  </div>

                  <div className={styles.recommendCard}>
                    <div className={styles.recommendHeader}>
                      <span className={styles.recommendTitle}>추천 연습</span>
                      <span className={styles.newBadge}>NEW</span>
                    </div>
                    <p className={styles.recommendDesc}>
                      이력서 기반 '관련 경험' 질문군을 준비해 보세요.
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.bottomGrid}>
                {loading ? (
                  <>
                    <div className={styles.tipCard}>
                      <Skeleton
                        width={100}
                        height={16}
                        className={styles.mb1}
                      />
                      <Skeleton width="100%" height={40} />
                    </div>
                    <div className={styles.noticeCard}>
                      <Skeleton
                        width={100}
                        height={16}
                        className={styles.mb1}
                      />
                      <Skeleton
                        width="100%"
                        height={20}
                        className={styles.mb1}
                      />
                      <Skeleton width="80%" height={20} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.tipCard}>
                      <h4 className={styles.tipTitle}>오늘의 면접 팁</h4>
                      <p className={styles.tipContent}>"{tip}"</p>
                    </div>

                    <div className={styles.noticeCard}>
                      <h4 className={styles.noticeTitle}>공지 및 일정</h4>
                      <div className={styles.noticeItem}>
                        <span className={styles.noticeDate}>02.14</span>
                        <span className={styles.noticeText}>
                          신규 AI 페르소나 '엄격한 인사담당자' 추가 예정
                        </span>
                      </div>
                      <div className={styles.noticeItem}>
                        <span className={styles.noticeDate}>02.11</span>
                        <span className={styles.noticeText}>
                          서비스 안정화 점검 안내 (02:00 ~ 04:00)
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.guestContainer}>
            <header className={styles.header}>
              <div className={styles.logoContainer}>
                <img src={logo} alt="Unbrdn" className={styles.logo} />
              </div>
            </header>

            <section className={styles.heroSection}>
              <div className={styles.heroContent}>
                <h1 className={styles.heroTitle}>
                  당신의 가능성을 증명하는
                  <span>가장 완벽한 방법</span>
                </h1>
                <p className={styles.heroSubtitle}>
                  AI 페르소나와 실전 같은 면접 연습을 통해 당신의 커리어를 한
                  단계 더 높이세요. 최첨단 음성 AI 기술이 당신의 도전을 성공으로
                  바꿉니다.
                </p>
                <div className={styles.heroCtaGroup}>
                  <button
                    className={styles.primeCta}
                    onClick={() => navigate("/login")}
                  >
                    지금 시작하기
                  </button>
                  <button
                    className={styles.secondaryCta}
                    onClick={() => navigate("/register")}
                  >
                    회원가입
                  </button>
                </div>
              </div>

              <div className={styles.heroVisualContainer}>
                <img
                  src={heroVisual}
                  alt="AI Dashboard"
                  className={styles.heroVisual}
                />
              </div>
            </section>

            <section className={styles.featuresSection}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTag}>Features</span>
                <h2 className={styles.sectionTitle}>
                  면접의 패러다임을 바꿉니다
                </h2>
              </div>

              <div className={styles.featureGrid}>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>🎙️</div>
                  <h3>실시간 음성 분석</h3>
                  <p>
                    고성능 STT 엔진을 통해 당신의 발화를 실시간으로 텍스트화하고
                    논리 구조를 분석합니다.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>🎭</div>
                  <h3>맞춤형 AI 페르소나</h3>
                  <p>
                    실제 면접관의 성향을 반영한 다양한 AI 페르소나들이 때로는
                    편안하게, 때로는 날카롭게 질문을 던집니다.
                  </p>
                </div>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>📈</div>
                  <h3>데이터 기반 성장 리포트</h3>
                  <p>
                    면접이 끝난 후, 당신의 답변 속도, 단어 선택, 논리력을
                    수치화하여 완벽한 개선 가이드를 제공합니다.
                  </p>
                </div>
              </div>
            </section>

            <footer className={styles.authContainer}>
              <p className={styles.ghostLink} style={{ cursor: "default" }}>
                이미 계정이 있으신가요?{" "}
                <span
                  onClick={() => navigate("/login")}
                  style={{
                    color: "#10b981",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  로그인
                </span>
              </p>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
