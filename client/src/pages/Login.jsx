import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
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
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!challengeId) {
        const data = await requestOtp(phone);
        setChallengeId(data.challengeId);
        if (data.devCode) {
          setOtp(data.devCode);
        }
      } else {
        await verifyOtp({ phone, code: otp, challengeId });
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message || "Failed to process OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-max flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-6 shadow-card sm:p-8">
        <SectionHeader title="Sign in" subtitle="Welcome back to SubhOne" className="mb-6" />

        <div className="mb-6 flex rounded-xl bg-surface-container-low p-1">
          <button
            onClick={() => { setTab("email"); setError(""); }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === "email" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            Email
          </button>
          <button
            onClick={() => { setTab("phone"); setError(""); }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === "phone" ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            Phone
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</div>}

        {tab === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-on-surface">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 outline-none transition-colors focus:border-primary" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-on-surface">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 outline-none transition-colors focus:border-primary" />
            </div>
            <Button fullWidth type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
          </form>
        ) : (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            {!challengeId ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-on-surface">Phone Number</label>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 outline-none transition-colors focus:border-primary" />
                </div>
                <Button fullWidth type="submit" disabled={loading}>{loading ? "Requesting..." : "Send OTP"}</Button>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-on-surface">OTP Code</label>
                  <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 outline-none transition-colors focus:border-primary" />
                </div>
                <Button fullWidth type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify OTP"}</Button>
                <button type="button" onClick={() => { setChallengeId(null); setOtp(""); }} className="mt-2 w-full text-center text-sm font-semibold text-primary">Change phone number</button>
              </>
            )}
          </form>
        )}

        <div className="mt-6 text-center text-sm text-on-surface-variant">
          Don't have an account? <Link to="/register" className="font-semibold text-primary hover:underline">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
