import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

// The server merges the guest cart during login, so the client's copy is stale
// the moment the user identity changes. Refreshing here keeps CartContext
// untouched while still reacting to auth.
export default function CartAuthBridge() {
  const { user, loading } = useAuth();
  const { refresh } = useCart();
  const lastUserId = useRef(undefined);

  useEffect(() => {
    if (loading) return;
    const id = user ? user.id || user._id : null;
    if (lastUserId.current !== undefined && lastUserId.current !== id) refresh();
    lastUserId.current = id;
  }, [user, loading, refresh]);

  return null;
}
