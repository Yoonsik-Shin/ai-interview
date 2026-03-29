import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { PageFrame } from "./components/PageFrame";
import { InterviewRecoveryModal } from "./components/InterviewRecoveryModal";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { GoogleCallback } from "./pages/GoogleCallback";
import { CompleteProfile } from "./pages/CompleteProfile";
import { Landing } from "./pages/Landing";
import { Interviews } from "./pages/Interviews";
import { InterviewSetup } from "./pages/InterviewSetup";
import { Interview } from "./pages/Interview";
import { ResumeManage } from "./pages/ResumeManage";
import { Profile } from "./pages/Profile";
import { DebugPage } from "./pages/DebugPage";
import { InterviewReport } from "./pages/InterviewReport";
import { useEffect } from "react";
import { preloadModel } from "@/services/resume-validator";
import { InterviewRecoveryProvider } from "./contexts/InterviewRecoveryContext";

export default function App() {
  useEffect(() => {
    // 앱 실행 시 로컬 AI 모델 미리 로드 (백그라운드)
    preloadModel();
  }, []);

  return (
    <InterviewRecoveryProvider>
      <InterviewRecoveryModal />
      <Routes>
        <Route
          path="/login"
          element={
            <PageFrame>
              <Login />
            </PageFrame>
          }
        />
        <Route
          path="/register"
          element={
            <PageFrame>
              <Register />
            </PageFrame>
          }
        />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route
          path="/complete-profile"
          element={
            <PageFrame>
              <CompleteProfile />
            </PageFrame>
          }
        />
        <Route
          path="/"
          element={
            <PageFrame>
              <Landing />
            </PageFrame>
          }
        />
        <Route
          path="/setup"
          element={
            <AuthGuard>
              <PageFrame>
                <InterviewSetup />
              </PageFrame>
            </AuthGuard>
          }
        />
        <Route
          path="/interviews"
          element={
            <AuthGuard>
              <PageFrame>
                <Interviews />
              </PageFrame>
            </AuthGuard>
          }
        />
        <Route
          path="/resumes"
          element={
            <AuthGuard>
              <PageFrame>
                <ResumeManage />
              </PageFrame>
            </AuthGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <PageFrame>
                <Profile />
              </PageFrame>
            </AuthGuard>
          }
        />
        <Route
          path="/interview/:interviewId"
          element={
            <AuthGuard>
              <Interview />
            </AuthGuard>
          }
        />
        {import.meta.env.DEV && (
          <Route
            path="/debug"
            element={
              <AuthGuard>
                <PageFrame>
                  <DebugPage />
                </PageFrame>
              </AuthGuard>
            }
          />
        )}
        <Route
          path="/interviews/:interviewId/reports/:reportId"
          element={
            <AuthGuard>
              <PageFrame>
                <InterviewReport />
              </PageFrame>
            </AuthGuard>
          }
        />
        <Route
          path="/interviews/:interviewId/reports"
          element={
            <AuthGuard>
              <PageFrame>
                <InterviewReport />
              </PageFrame>
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </InterviewRecoveryProvider>
  );
}
