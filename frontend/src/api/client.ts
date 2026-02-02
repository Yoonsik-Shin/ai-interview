const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const token = localStorage.getItem("accessToken");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token)
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res = await fetch(url, { ...options, headers, credentials: "include" });

  // 401 Unauthorized - 토큰 만료 또는 유효하지 않음
  // Refresh Token 재발급 시도 (로그인/Refresh 요청 자체는 제외)
  if (
    res.status === 401 &&
    !url.includes("/auth/login") &&
    !url.includes("/auth/refresh")
  ) {
    try {
      const refreshRes = await fetch(`${BASE}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 쿠키 전송 필수
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const newAccessToken = data.accessToken;

        if (newAccessToken) {
          localStorage.setItem("accessToken", newAccessToken);

          // 새 토큰으로 헤더 업데이트 후 재요청
          (headers as Record<string, string>)["Authorization"] =
            `Bearer ${newAccessToken}`;
          res = await fetch(url, {
            ...options,
            headers,
            credentials: "include",
          });
        }
      } else {
        throw new Error("Refresh failed");
      }
    } catch (e) {
      console.error("Token refresh failed", e);
      // Refresh 실패 시 로그아웃 -> 로그인 페이지로 이동
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken"); // 만약 있다면 삭제
      window.location.href = "/login";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  if (!res.ok) {
    // 401이어도 refresh 실패 후라면 여기서 에러 처리됨
    // 401이 아니면 일반적인 에러 처리
    if (res.status === 401) {
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }

    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}
