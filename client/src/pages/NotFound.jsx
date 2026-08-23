import { Link } from "react-router-dom";
import { Plus, Home } from "lucide-react";
import Button from "../components/ui/Button";

export default function NotFound() {
  return (
    <div className="container-max flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-on-primary shadow-pill">
        <Plus className="h-8 w-8" strokeWidth={3} />
      </span>
      <p className="mt-6 font-display text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold text-on-surface">Page not found</h1>
      <p className="mt-2 max-w-sm text-on-surface-variant">
        The page you're looking for doesn't exist or has moved. Let's get you back to good health.
      </p>
      <Button as={Link} to="/" variant="primary" size="lg" className="mt-6">
        <Home className="h-4 w-4" /> Back to home
      </Button>
    </div>
  );
}
