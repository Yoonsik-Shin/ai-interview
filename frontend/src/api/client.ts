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
        const refreshBody = await refreshRes.json().catch(() => ({}));
        throw new Error(
          refreshBody.message ??
            "인증 세션이 만료되었습니다. 다시 로그인해주세요.",
        );
      }
    } catch (e) {
      console.error("Token refresh failed", e);
      // Refresh 실패 시 로그아웃 -> 로그인 페이지로 이동
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken"); // 만약 있다면 삭제

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      throw e instanceof Error
        ? e
        : new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  if (!res.ok) {
    const isAuthRequest =
      url.includes("/v1/auth/login") || url.includes("/v1/auth/refresh");

    let errorMessage = `HTTP ${res.status}`;
    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const body = await res.json();
        errorMessage = body.message || body.error || errorMessage;
      } else {
        const text = await res.text();
        if (text) errorMessage = text.slice(0, 100);
      }
    } catch (e) {
      console.error("Error parsing error response", e);
    }

    // 401 에러 처리
    if (res.status === 401) {
      localStorage.removeItem("accessToken");

      // 로그인/리프레시 요청이 아닌 경우에만 리다이렉트
      if (!isAuthRequest && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      throw new Error(
        errorMessage === `HTTP 401`
          ? isAuthRequest
            ? "인증에 실패했습니다."
            : "인증이 만료되었습니다. 다시 로그인해주세요."
          : errorMessage,
      );
    }

    throw new Error(errorMessage);
  }
  return res.json() as Promise<T>;
}
