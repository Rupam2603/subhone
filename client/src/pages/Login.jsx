import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Mail, Lock, KeyRound, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import { SectionHeader } from "../components/ui/Feedback";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function Login() {
  const [tab, setTab] = useState("email"); // email | phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, loginWithGoogle, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Google sign-in was cancelled or failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    const formattedPhone = `+91${digits}`;

    setLoading(true);
    try {
      if (!challengeId) {
        const data = await requestOtp(formattedPhone);
        setChallengeId(data.challengeId);
        if (data.devCode) {
          setOtp(data.devCode);
        }
      } else {
        await verifyOtp({ phone: formattedPhone, code: otp, challengeId });
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message || "Failed to process OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-max flex min-h-[75vh] items-center justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-6 shadow-card sm:p-8 border border-outline-variant/60"
      >
        <SectionHeader title="Sign in" subtitle="Welcome back to SubhOne" className="mb-6 text-center" />

        {/* Google One-Click Sign In */}
        <div className="mb-5">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-outline-variant/80 bg-surface-container-lowest py-3 px-4 text-sm font-bold text-on-surface shadow-sm transition-all hover:bg-surface-container hover:border-primary/40 disabled:opacity-60"
          >
            <GoogleIcon />
            <span>{googleLoading ? "Signing in with Google..." : "Continue with Google"}</span>
          </motion.button>

          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-outline-variant/60" />
            <span className="absolute bg-surface-container-lowest px-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant/70">
              Or sign in with
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex rounded-2xl bg-surface-container-low p-1 border border-outline-variant/40">
          <button
            onClick={() => { setTab("email"); setError(""); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${tab === "email" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            Email & Password
          </button>
          <button
            onClick={() => { setTab("phone"); setError(""); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${tab === "phone" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            Mobile OTP
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 rounded-2xl bg-error/10 border border-error/20 p-3.5 text-sm font-semibold text-error text-center"
          >
            {error}
          </motion.div>
        )}

        {tab === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/60" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest pl-10 pr-4 py-3 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/60" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest pl-10 pr-4 py-3 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>
            <div className="pt-2">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button fullWidth size="lg" type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </motion.div>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            {!challengeId ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Mobile Number
                    </label>
                    <span className="text-[11px] font-semibold text-primary">Without country code</span>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center gap-1.5 text-xs font-bold text-on-surface-variant select-none pointer-events-none">
                      <span className="text-base leading-none">🇮🇳</span>
                      <span>+91</span>
                      <span className="text-outline-variant">|</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      required
                      placeholder="10-digit number (e.g. 9830012345)"
                      value={phone}
                      onChange={handlePhoneChange}
                      className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest pl-[78px] pr-4 py-3 text-sm font-medium tracking-wide outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button fullWidth size="lg" type="submit" disabled={loading}>
                      {loading ? "Requesting OTP..." : "Send OTP"}
                    </Button>
                  </motion.div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    6-Digit OTP Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/60" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest pl-10 pr-4 py-3 text-center font-display text-lg font-bold tracking-widest outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button fullWidth size="lg" type="submit" disabled={loading}>
                      {loading ? "Verifying..." : "Verify & Sign in"}
                    </Button>
                  </motion.div>
                </div>
                <button
                  type="button"
                  onClick={() => { setChallengeId(null); setOtp(""); }}
                  className="mt-2 w-full text-center text-xs font-bold text-primary hover:underline"
                >
                  Change mobile number
                </button>
              </>
            )}
          </form>
        )}

        <div className="mt-6 text-center text-sm text-on-surface-variant border-t border-outline-variant/50 pt-5">
          Don't have an account?{" "}
          <Link to="/register" className="font-bold text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
