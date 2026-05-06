import { useState, useEffect, useRef } from "react";
import { FileSpreadsheet, Phone, KeyRound, ArrowLeft, Loader2, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-glow), hsl(var(--background))' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="icon-box h-14 w-14 mb-4">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">DLMS Admin Panel</h1>
        </div>

        {/* Card */}
        <div className="section-card p-8">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              {otpSent ? "Verify OTP" : "Sign in"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {otpSent
                ? `Enter the code sent to +91 ${mobile}`
                : "Enter your mobile number to continue"
              }
            </p>
          </div>

          {!otpSent ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">+91</span>
                    <div className="w-px h-4 bg-border" />
                  </div>
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
                    className="input-field pl-24 h-12 text-base"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mobile.length !== 10}
                className="btn-primary w-full h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <button
                type="button"
                onClick={handleBackToMobile}
                disabled={loading}
                className="btn-ghost -ml-2 mb-2 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change number
              </button>

              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    className="input-field pl-10 h-12 text-base tracking-widest font-mono text-center"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 4}
                className="btn-primary w-full h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                {countdown > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Resend code in <span className="font-mono font-medium text-foreground">{countdown}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-sm font-medium text-primary hover:underline cursor-pointer bg-transparent border-0"
                  >
                    Resend verification code
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

export default Login;
