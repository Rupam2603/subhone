import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import { SectionHeader } from "../components/ui/Feedback";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      await register({ name, email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err.status === 422 && err.details) {
        const errors = {};
        err.details.forEach(detail => {
          errors[detail.field] = detail.message;
        });
        setFieldErrors(errors);
      } else {
        setError(err.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-max flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-6 shadow-card sm:p-8">
        <SectionHeader title="Create Account" subtitle="Join SubhOne today" className="mb-6" />

        {error && <div className="mb-4 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface">Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={`w-full rounded-xl border px-4 py-2.5 outline-none transition-colors ${fieldErrors.name ? "border-error focus:border-error" : "border-outline-variant bg-surface-container-lowest focus:border-primary"}`} />
            {fieldErrors.name && <p className="mt-1 text-xs text-error">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full rounded-xl border px-4 py-2.5 outline-none transition-colors ${fieldErrors.email ? "border-error focus:border-error" : "border-outline-variant bg-surface-container-lowest focus:border-primary"}`} />
            {fieldErrors.email && <p className="mt-1 text-xs text-error">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full rounded-xl border px-4 py-2.5 outline-none transition-colors ${fieldErrors.password ? "border-error focus:border-error" : "border-outline-variant bg-surface-container-lowest focus:border-primary"}`} />
            {fieldErrors.password && <p className="mt-1 text-xs text-error">{fieldErrors.password}</p>}
          </div>
          <Button fullWidth type="submit" disabled={loading}>{loading ? "Creating account..." : "Sign up"}</Button>
        </form>

        <div className="mt-6 text-center text-sm text-on-surface-variant">
          Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
