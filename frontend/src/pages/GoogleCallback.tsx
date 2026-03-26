import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const pendingToken = searchParams.get("pending_token");
    if (pendingToken) {
      navigate("/complete-profile", { state: { pendingToken }, replace: true });
    }
    // 기존 유저는 BFF가 직접 /로 리다이렉트하므로 이 컴포넌트에 도달하지 않음
  }, [navigate, searchParams]);

  return (
    <div style={{ color: "#f1f5f9", textAlign: "center", marginTop: "4rem" }}>
      Google 로그인 처리 중…
    </div>
  );
}
