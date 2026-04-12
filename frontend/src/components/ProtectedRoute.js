import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
    const token = localStorage.getItem("token");
    const user  = localStorage.getItem("user");
    if (!token || !user) return <Navigate to="/login" replace />;
    return children;
}
