import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Phone, ArrowRight, KeyRound } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import { SectionHeader } from "../components/ui/Feedback";

export default function Login() {
  const [tab, setTab] = useState("email"); // email | phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

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
