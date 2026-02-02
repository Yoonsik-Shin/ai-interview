import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./auth/AuthGuard";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Landing } from "./pages/Landing";
import { InterviewSetup } from "./pages/InterviewSetup";
import { Interview } from "./pages/Interview";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Landing />} />
      <Route
        path="/setup"
        element={
          <AuthGuard>
            <InterviewSetup />
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
