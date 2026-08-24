const { generatePlainText, generateHtml, sendOrderNotification } = require("../../src/services/emailService");

describe("emailService", () => {
  const sampleOrder = {
    id: "SO-481999",
    items: [
      { id: "m1", type: "medicine", name: "Paracetamol 500mg", brand: "Cipla", price: 15, quantity: 2 },
      { id: "s1", type: "supplement", name: "Vitamin C 1000mg", brand: "Fast&Up", price: 399, quantity: 1 },
    ],
    address: {
      name: "Subhasis Das",
      phone: "9876543210",
      street: "123 MG Road",
      city: "Kolkata",
      state: "West Bengal",
      pincode: "700001",
    },
    paymentMethod: "Cash on Delivery",
    subtotal: 429,
    mrpSavings: 70,
    couponDiscount: 0,
    deliveryFee: 40,
    total: 469,
    placedAt: new Date().toISOString(),
  };

  it("generates plain text email containing essential order details", () => {
    const text = generatePlainText(sampleOrder);
    expect(text).toContain("SO-481999");
    expect(text).toContain("Subhasis Das");
    expect(text).toContain("9876543210");
    expect(text).toContain("Paracetamol 500mg");
    expect(text).toContain("Vitamin C 1000mg");
    expect(text).toContain("Cash on Delivery");
    expect(text).toContain("₹469");
  });

  it("generates HTML email containing formatted markup and table rows", () => {
    const html = generateHtml(sampleOrder);
    expect(html).toContain("SO-481999");
    expect(html).toContain("Subhasis Das");
    expect(html).toContain("Paracetamol 500mg");
    expect(html).toContain("Cipla");
    expect(html).toContain("Vitamin C 1000mg");
    expect(html).toContain("₹469");
    expect(html).toContain("Subh<span style=\"color: #82faab;\">One</span>");
  });

  it("dispatches order notification without crashing when in dev/unconfigured mode", async () => {
    const res = await sendOrderNotification(sampleOrder);
    expect(res.success).toBe(true);
  });
});
