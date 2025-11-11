import { useState } from "react";
import { setToken, apiLogin } from "../../services/api";
import "./Login.css";

function Login({ onLogin }) {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Automatically prepend +91 to mobile number
      const mobileWithPrefix = mobile.startsWith('+91') ? mobile : `+91${mobile}`;
      const response = await apiLogin(mobileWithPrefix, password);
      
      // Extract token from response: { token: "...", name: "...", mobile: "..." }
      const token = response?.token;
      
      if (token) {
        setToken(token, true);
        onLogin();
      } else {
        setError("Login successful but no token received from server");
      }
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mobile">Mobile</label>
            <div className="mobile-input-wrapper">
              <span className="mobile-prefix">+91</span>
              <input
                type="text"
                id="mobile"
                value={mobile}
                onChange={(e) => {
                  // Remove +91 if user tries to type it, only allow digits
                  const value = e.target.value.replace(/\+91/g, '').replace(/\D/g, '');
                  setMobile(value);
                }}
                placeholder="Enter mobile number"
                maxLength={10}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;


