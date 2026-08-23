import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import { useNotification } from "./NotificationContext";

export const CartContext = createContext(null);

const EMPTY = { items: [], itemCount: 0, subtotal: 0, mrpTotal: 0, savings: 0 };

export function CartProvider({ children }) {
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { notify } = useNotification();

  const applyCart = useCallback((data) => {
    setCart({ ...EMPTY, ...data, items: data.items || [] });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getCart();
      applyCart(data);
    } catch {
      /* keep last known cart */
    } finally {
      setLoading(false);
    }
  }, [applyCart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (item, quantity = 1) => {
      try {
        const data = await api.addToCart({ id: item.id, type: item.type, quantity });
        applyCart(data);
        notify(`${item.name} added to cart`, "success");
        return true;
      } catch (e) {
        notify(e.message || "Couldn't add to cart", "error");
        return false;
      }
    },
    [applyCart, notify]
  );

  const updateItem = useCallback(
    async (item, quantity) => {
      try {
        const data = await api.updateCart({ id: item.id, type: item.type, quantity });
        applyCart(data);
      } catch (e) {
        notify(e.message || "Couldn't update cart", "error");
      }
    },
    [applyCart, notify]
  );

  const removeItem = useCallback(
    async (item) => {
      try {
        const data = await api.removeFromCart(item.type, item.id);
        applyCart(data);
        notify(`${item.name} removed`, "info");
      } catch (e) {
        notify(e.message || "Couldn't remove item", "error");
      }
    },
    [applyCart, notify]
  );

  const clear = useCallback(async () => {
    try {
      const data = await api.clearCart();
      applyCart(data);
    } catch (e) {
      notify(e.message || "Couldn't clear cart", "error");
    }
  }, [applyCart, notify]);

  const isInCart = useCallback(
    (id, type) => cart.items.some((i) => i.id === id && i.type === type),
    [cart.items]
  );

  const getQuantity = useCallback(
    (id, type) => {
      const found = cart.items.find((i) => i.id === id && i.type === type);
      return found ? found.quantity : 0;
    },
    [cart.items]
  );

  const value = {
    cart,
    items: cart.items,
    count: cart.itemCount,
    subtotal: cart.subtotal,
    savings: cart.savings,
    loading,
    drawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    addItem,
    addToCart: (item, type, quantity = 1) => addItem({ ...item, type: type || item.type }, quantity),
    updateItem,
    removeItem,
    clear,
    refresh,
    isInCart,
    getQuantity,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
