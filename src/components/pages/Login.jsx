import { useState, useEffect, useRef } from "react";
import { FileSpreadsheet, Phone, KeyRound, ArrowLeft, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { setNowPurchaseToken, sendOTP, verifyOTP } from "../../services/api";

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
      const otpResponse = await verifyOTP(mobileWithPrefix, otp);
      const nowpurchaseToken = otpResponse?.token;

      if (!nowpurchaseToken) {
        setError("Verification successful but no token received");
        return;
      }

      if (nowpurchaseToken) {
        setNowPurchaseToken(nowpurchaseToken, true);
        onLogin();
      } else {
        setError("Login successful but no token received");
      }
    } catch (err) {
      setError(err.message || "Invalid OTP. Please try again.");
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
        setError("Failed to resend OTP.");
      }
    } catch (err) {
      setError(err.message || "Failed to resend OTP.");
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
    <div className="login-page">
      <div className="login-wrap">
        {/* Logo + Title */}
        <div className="login-top">
          <div className="login-mark">
            <img src="/np-mark.svg" alt="NowPurchase" />
          </div>
          <h1>DLMS Admin Panel</h1>
          <div className="sub">NowPurchase · MetalCloud</div>
        </div>

        {/* Mobile Step */}
        {!otpSent ? (
          <>
            <div className="login-card">
              <div className="login-card-head">
                <h2>Sign in</h2>
                <p>Enter your mobile number to continue</p>
              </div>

              <form onSubmit={handleSendOTP}>
                <label className="login-lbl">Mobile Number</label>
                <div className="login-mobile-field">
                  <span className="cc">
                    <Phone />
                    <span>+91</span>
                  </span>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\+91/g, '').replace(/\D/g, '');
                      setMobile(value);
                    }}
                    placeholder="Enter 10-digit number"
                    maxLength={10}
                    required
                    disabled={loading}
                  />
                </div>

                {error && <div className="login-error">{error}</div>}

                <button
                  type="submit"
                  disabled={loading || mobile.length !== 10}
                  className="login-btn-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight />
                    </>
                  )}
                </button>
              </form>
            </div>
            <p className="login-legal">
              By continuing, you agree to our <a href="#">Terms of Service</a>
            </p>
          </>
        ) : (
          <>
            <div className="login-card">
              <div className="login-card-head">
                <h2>Verify OTP</h2>
                <p>Enter the code sent to +91 {mobile}</p>
              </div>

              <form onSubmit={handleVerifyOTP}>
                <button
                  type="button"
                  onClick={handleBackToMobile}
                  disabled={loading}
                  className="login-back-btn"
                >
                  <ArrowLeft />
                  Change number
                </button>

                <div className="login-sent-note">
                  <CheckCircle2 />
                  OTP sent to +91 {mobile}
                </div>

                <label className="login-lbl">Verification Code</label>
                <div className="login-otp-field">
                  <span className="lead"><KeyRound /></span>
                  <input
                    ref={otpInputRef}
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setOtp(value);
                    }}
                    placeholder="Enter 4-digit OTP"
                    maxLength={4}
                    required
                    disabled={loading}
                  />
                </div>

                {error && <div className="login-error">{error}</div>}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 4}
                  className="login-btn-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Sign in
                      <ArrowRight />
                    </>
                  )}
                </button>

                <div className="login-resend">
                  {countdown > 0 ? (
                    <>Resend code in <b>{countdown}s</b></>
                  ) : (
                    <button type="button" onClick={handleResendOTP} disabled={loading}>
                      Resend verification code
                    </button>
                  )}
                </div>
              </form>
            </div>
            <p className="login-legal">
              By continuing, you agree to our <a href="#">Terms of Service</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
