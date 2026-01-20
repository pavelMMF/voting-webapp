import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";

import Home from "./pages/Home";
import Votes from "./pages/Votes";
import VoteDetail from "./pages/VoteDetail";
import CreateProposal from "./pages/CreateProposal";

import Profile from "./pages/Profile";
import Exams from "./pages/Exams";
import ExamTake from "./pages/ExamTake";

import AdminPanel from "./pages/AdminPanel";
import AdminReview from "./pages/AdminReview";

import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthed } = useAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user?.role === "admin" ? children : <Navigate to="/profile" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route path="/votes" element={<RequireAuth><Votes /></RequireAuth>} />
          <Route path="/votes/new" element={<RequireAuth><CreateProposal /></RequireAuth>} />
          <Route path="/votes/:id" element={<RequireAuth><VoteDetail /></RequireAuth>} />

          <Route path="/exams" element={<RequireAuth><Exams /></RequireAuth>} />
          <Route path="/exams/:id" element={<RequireAuth><ExamTake /></RequireAuth>} />

          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

          <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminPanel /></RequireAdmin></RequireAuth>} />
          <Route path="/admin/reviews/:attemptId" element={<RequireAuth><RequireAdmin><AdminReview /></RequireAdmin></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
