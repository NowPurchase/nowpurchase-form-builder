import { useState, useEffect, useRef } from "react";
import { setToken, setNowPurchaseToken, sendOTP, verifyOTP, loginWithNowPurchaseToken } from "../../services/api";
import "./Login.css";

function Login({ onLogin }) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpInputRef = useRef(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (otpSent && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpSent]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!mobile || mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);

    try {
      const mobileWithPrefix = mobile.startsWith('+91') ? mobile : `+91${mobile}`;
      const response = await sendOTP(mobileWithPrefix);
      
      if (response?.detail || response) {
        setOtpSent(true);
        setCountdown(60);
        setError("");
      } else {
        setError("Failed to send OTP. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please check your mobile number and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");

    if (!otp || otp.length !== 4) {
      setError("Please enter a valid 4-digit OTP");
      return;
    }

    setLoading(true);

    try {
      const mobileWithPrefix = mobile.startsWith('+91') ? mobile : `+91${mobile}`;

      // Step 1: Verify OTP and get NowPurchase token
      const otpResponse = await verifyOTP(mobileWithPrefix, otp);
      const nowpurchaseToken = otpResponse?.token;

      if (!nowpurchaseToken) {
        setError("Verification successful but no token received from server");
        return;
      }

      // Step 2: Login to DLMS API with NowPurchase token to get JWT
      const loginResponse = await loginWithNowPurchaseToken(nowpurchaseToken);
      const jwtToken = loginResponse?.access_token;

      if (jwtToken) {
        // Store both tokens
        setToken(jwtToken, true); // JWT for new DLMS API
        setNowPurchaseToken(nowpurchaseToken, true); // NowPurchase token for old API
        onLogin();
      } else {
        setError("Login successful but no JWT token received");
      }
    } catch (err) {
      setError(err.message || "Invalid OTP. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setError("");
    setOtp("");
    setLoading(true);

    try {
      const mobileWithPrefix = mobile.startsWith('+91') ? mobile : `+91${mobile}`;
      const response = await sendOTP(mobileWithPrefix);
      
      if (response?.detail || response) {
        setCountdown(60);
        setError("");
      } else {
        setError("Failed to resend OTP. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMobile = () => {
    setOtpSent(false);
    setOtp("");
    setError("");
    setCountdown(0);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Admin Login</h2>
        {!otpSent ? (
          <form onSubmit={handleSendOTP}>
            <div className="form-group">
              <label htmlFor="mobile">Mobile Number</label>
              <div className="mobile-input-wrapper">
                <span className="mobile-prefix">+91</span>
                <input
                  type="text"
                  id="mobile"
                  value={mobile}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\+91/g, '').replace(/\D/g, '');
                    setMobile(value);
                  }}
                  placeholder="Enter mobile number"
                  maxLength={10}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div className="otp-info">
              <p className="otp-message">
                We've sent a verification code to <strong>+91 {mobile}</strong>
              </p>
              <button
                type="button"
                className="change-number-link"
                onClick={handleBackToMobile}
                disabled={loading}
              >
                Change number
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="otp">Enter OTP</label>
              <input
                ref={otpInputRef}
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtp(value);
                }}
                placeholder="Enter 4-digit OTP"
                maxLength={4}
                required
                disabled={loading}
                className="otp-input"
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <div className="resend-otp">
              {countdown > 0 ? (
                <span className="resend-countdown">
                  Resend OTP in {countdown}s
                </span>
              ) : (
                <button
                  type="button"
                  className="resend-button"
                  onClick={handleResendOTP}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;

