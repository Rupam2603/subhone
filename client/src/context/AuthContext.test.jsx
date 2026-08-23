import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import api from "../lib/api";

vi.mock("../lib/api", () => ({
  default: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  onAuthLost: vi.fn(() => () => {}),
}));

function Probe() {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <p>loading</p>;
  return <p>{isAuthenticated ? `hi ${user.name}` : "anonymous"}</p>;
}

const renderProbe = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => vi.clearAllMocks());

describe("AuthContext", () => {
  it("treats a 401 from /me as anonymous, not an error", async () => {
    api.me.mockRejectedValueOnce(Object.assign(new Error("Please sign in"), { status: 401 }));
    renderProbe();
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });

  it("bootstraps an existing session", async () => {
    api.me.mockResolvedValueOnce({ user: { id: "1", name: "Subhasis" } });
    renderProbe();
    await waitFor(() => expect(screen.getByText("hi Subhasis")).toBeInTheDocument());
  });

  it("stops loading even if /me hangs up with a network error", async () => {
    api.me.mockRejectedValueOnce(new Error("Failed to fetch"));
    renderProbe();
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });

  it("sets the user after login and clears it after logout", async () => {
    api.me.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 401 }));
    api.login.mockResolvedValueOnce({ user: { id: "1", name: "Subhasis" } });
    api.logout.mockResolvedValueOnce(null);

    let auth;
    function Capture() { auth = useAuth(); return null; }
    render(<AuthProvider><Capture /><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());

    await act(() => auth.login({ email: "s@example.com", password: "correct-horse-1" }));
    await waitFor(() => expect(screen.getByText("hi Subhasis")).toBeInTheDocument());

    await act(() => auth.logout());
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });

  it("propagates a login failure so the form can show it", async () => {
    api.me.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 401 }));
    api.login.mockRejectedValueOnce(new Error("That email or password isn't right."));

    let auth;
    function Capture() { auth = useAuth(); return null; }
    render(<AuthProvider><Capture /></AuthProvider>);
    await waitFor(() => expect(auth).toBeTruthy());
    await expect(auth.login({ email: "a@b.com", password: "x" }))
      .rejects.toThrow("That email or password isn't right.");
  });

  it("clears the user when the api reports the session was lost", async () => {
    const { onAuthLost } = await import("../lib/api");
    api.me.mockResolvedValueOnce({ user: { id: "1", name: "Subhasis" } });
    let fire;
    onAuthLost.mockImplementation((fn) => { fire = fn; return () => {}; });

    renderProbe();
    await waitFor(() => expect(screen.getByText("hi Subhasis")).toBeInTheDocument());
    await act(async () => { fire(); });
    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
  });
});
