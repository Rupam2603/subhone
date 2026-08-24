/**
 * Normalizes and deduplicates extracted orders into canonical output schema with summary analytics.
 */

function normalizeOrders(ordersList = []) {
  const orderMap = new Map();

  for (const order of ordersList) {
    if (!order || (!order.order_id && !order.email_id)) continue;

    const key = order.order_id || order.email_id;
    if (orderMap.has(key)) {
      // Merge / update with richer data
      const existing = orderMap.get(key);
      if ((order.items || []).length > (existing.items || []).length) {
        orderMap.set(key, order);
      }
    } else {
      orderMap.set(key, {
        order_id: String(order.order_id || key).trim(),
        merchant: order.merchant || "Online Merchant",
        date: order.date || new Date().toISOString(),
        items: (order.items || []).map((item) => ({
          name: item.name || "Item",
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
        })),
        subtotal: Number(order.subtotal) || 0,
        tax: Number(order.tax) || 0,
        shipping: Number(order.shipping) || 0,
        total: Number(order.total) || 0,
        tracking: Array.isArray(order.tracking) ? order.tracking : [],
        payment: {
          method: order.payment?.method || "Online",
          last4: order.payment?.last4 || "",
        },
      });
    }
  }

  // Sort descending by date
  const normalized = Array.from(orderMap.values()).sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Calculate Aggregates
  const totalSpend = normalized.reduce((acc, o) => acc + (o.total || 0), 0);
  const merchantStats = {};
  const monthlyStats = {};

  for (const order of normalized) {
    // By merchant
    const m = order.merchant || "Other";
    if (!merchantStats[m]) merchantStats[m] = { count: 0, spend: 0 };
    merchantStats[m].count += 1;
    merchantStats[m].spend += order.total || 0;

    // By month (YYYY-MM)
    const monthKey = order.date ? order.date.substring(0, 7) : "Unknown";
    if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { count: 0, spend: 0 };
    monthlyStats[monthKey].count += 1;
    monthlyStats[monthKey].spend += order.total || 0;
  }

  return {
    meta: {
      generated_at: new Date().toISOString(),
      order_count: normalized.length,
      total_spend: totalSpend,
      merchants_count: Object.keys(merchantStats).length,
      merchant_breakdown: merchantStats,
      monthly_breakdown: monthlyStats,
    },
    orders: normalized,
  };
}

module.exports = {
  normalizeOrders,
};
