import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { PageFrame } from "./components/PageFrame";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Landing } from "./pages/Landing";
import { InterviewSetup } from "./pages/InterviewSetup";
import { Interview } from "./pages/Interview";
import { ResumeManage } from "./pages/ResumeManage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PageFrame><Login /></PageFrame>} />
      <Route path="/register" element={<PageFrame><Register /></PageFrame>} />
      <Route path="/" element={<PageFrame><Landing /></PageFrame>} />
      <Route
        path="/setup"
        element={
          <AuthGuard>
            <PageFrame><InterviewSetup /></PageFrame>
          </AuthGuard>
        }
      />
      <Route
        path="/resumes"
        element={
          <AuthGuard>
            <PageFrame><ResumeManage /></PageFrame>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
