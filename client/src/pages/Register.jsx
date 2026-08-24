import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { User, Mail, Lock, Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import { SectionHeader } from "../components/ui/Feedback";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

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

    // Validate phone number if provided (or mandatory 10 digits)
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
              {/* +91 Indicator Prefix */}
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
