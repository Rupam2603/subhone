import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "./ui/Feedback";

export default function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Rendering the redirect before the bootstrap finishes would bounce a
  // signed-in user to /login on every hard refresh.
  if (loading) {
    return <div className="container-max flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
