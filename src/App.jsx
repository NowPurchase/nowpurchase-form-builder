import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { getToken, removeToken } from "./services/api";
import Login from "./components/pages/Login";
import Home from "./components/pages/Home";
import NewForm from "./components/pages/NewForm";
import ViewForm from "./components/pages/ViewForm";
import Permissions from "./components/pages/Permissions";
import TemplateConfig from "./components/pages/TemplateConfig";
import ToastContainer from "./components/shared/Toast";

function AppContent() {
  const navigate = useNavigate();
  // Check authentication state based on token presence
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = getToken();
    return !!token;
  });

  // Update auth state when token changes
  useEffect(() => {
    const checkAuth = () => {
      const token = getToken();
      setIsAuthenticated(!!token);
    };

    // Listen for storage changes (e.g., token removed in another tab)
    window.addEventListener('storage', checkAuth);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    removeToken();
    setIsAuthenticated(false);
    // Also remove legacy auth flag if it exists
    localStorage.removeItem("isAuthenticated");
    // Redirect to login page
    navigate("/", { replace: true });
  };

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/home" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/home"
          element={
            isAuthenticated ? (
              <Home onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/new-form"
          element={
            isAuthenticated ? (
              <NewForm />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/form/:formId"
          element={
            isAuthenticated ? (
              <ViewForm />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/permissions"
          element={
            isAuthenticated ? (
              <Permissions onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/config/:templateId"
          element={
            isAuthenticated ? (
              <TemplateConfig />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
