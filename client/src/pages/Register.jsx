import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { User, Mail, Lock, Phone, ArrowRight, ShieldCheck } from "lucide-react";
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

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const handleGoogleSignUp = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError(err.message || "Google sign-up was cancelled or failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePhoneChange = (e) => {
    // Only allow digits and max 10 characters (without country code)
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Validate phone number if provided
    if (phone && phone.length !== 10) {
      setFieldErrors({ phone: "Please enter a valid 10-digit mobile number" });
      return;
    }

    setLoading(true);
    try {
      await register({
        name,
        email,
        phone: phone ? phone : undefined,
        password,
      });
      navigate(from, { replace: true });
    } catch (err) {
      if (err.status === 422 && err.details) {
        const errors = {};
        err.details.forEach((detail) => {
          errors[detail.field] = detail.message;
        });
        setFieldErrors(errors);
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
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
        <SectionHeader
          title="Create Account"
          subtitle="Join SubhOne for medicines, lab tests & expert healthcare"
          className="mb-6 text-center"
        />

        {/* Google One-Click Sign Up */}
        <div className="mb-5">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignUp}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-outline-variant/80 bg-surface-container-lowest py-3 px-4 text-sm font-bold text-on-surface shadow-sm transition-all hover:bg-surface-container hover:border-primary/40 disabled:opacity-60"
          >
            <GoogleIcon />
            <span>{googleLoading ? "Signing up with Google..." : "Sign up with Google"}</span>
          </motion.button>

          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-outline-variant/60" />
            <span className="absolute bg-surface-container-lowest px-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant/70">
              Or with email & mobile
            </span>
          </div>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/60" />
              <input
                type="text"
                required
                placeholder="e.g. Subhasis Das"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full rounded-2xl border pl-10 pr-4 py-3 text-sm font-medium outline-none transition-all ${
                  fieldErrors.name
                    ? "border-error focus:ring-2 focus:ring-error/20"
                    : "border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10"
                }`}
              />
            </div>
            {fieldErrors.name && <p className="mt-1 text-xs font-semibold text-error">{fieldErrors.name}</p>}
          </div>

          {/* Mobile Number (Without country code) */}
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
                placeholder="10-digit number (e.g. 9830012345)"
                value={phone}
                onChange={handlePhoneChange}
                className={`w-full rounded-2xl border pl-[78px] pr-4 py-3 text-sm font-medium outline-none tracking-wide transition-all ${
                  fieldErrors.phone
                    ? "border-error focus:ring-2 focus:ring-error/20"
                    : "border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10"
                }`}
              />
            </div>
            {fieldErrors.phone && <p className="mt-1 text-xs font-semibold text-error">{fieldErrors.phone}</p>}
            <p className="mt-1 text-[11px] text-on-surface-variant/70">
              Used for order updates, delivery OTPs & prescription consultations
            </p>
          </div>

          {/* Email Address */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/60" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-2xl border pl-10 pr-4 py-3 text-sm font-medium outline-none transition-all ${
                  fieldErrors.email
                    ? "border-error focus:ring-2 focus:ring-error/20"
                    : "border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10"
                }`}
              />
            </div>
            {fieldErrors.email && <p className="mt-1 text-xs font-semibold text-error">{fieldErrors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/60" />
              <input
                type="password"
                required
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-2xl border pl-10 pr-4 py-3 text-sm font-medium outline-none transition-all ${
                  fieldErrors.password
                    ? "border-error focus:ring-2 focus:ring-error/20"
                    : "border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10"
                }`}
              />
            </div>
            {fieldErrors.password && <p className="mt-1 text-xs font-semibold text-error">{fieldErrors.password}</p>}
          </div>

          <div className="pt-2">
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button fullWidth size="lg" type="submit" disabled={loading}>
                {loading ? (
                  "Creating account..."
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Create SubhOne Account <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </motion.div>
          </div>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Your personal healthcare information is 100% secure</span>
        </div>

        <div className="mt-6 text-center text-sm text-on-surface-variant border-t border-outline-variant/50 pt-5">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
