require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { sendOrderNotification } = require("../services/emailService");

async function testEmail() {
  console.log("Testing Mailjet integration...");
  const dummyOrder = {
    id: "TEST-12345",
    total: 1500,
    subtotal: 1400,
    deliveryFee: 100,
    mrpSavings: 200,
    couponDiscount: 50,
    coupon: { code: "WELCOME50" },
    paymentMethod: "UPI",
    placedAt: new Date().toISOString(),
    address: {
      name: "Test User",
      phone: "+91 9876543210",
      line1: "123 Test Street",
      city: "Kolkata",
      state: "West Bengal",
      pincode: "700001",
    },
    items: [
      { name: "Paracetamol 500mg", type: "Medicine", quantity: 2, price: 50 },
      { name: "Vitamin C Supplements", type: "Health Supplement", quantity: 1, price: 1300 },
    ]
  };

  try {
    const result = await sendOrderNotification(dummyOrder);
    console.log("Result:", result);
  } catch (err) {
    console.error("Error sending test email:", err);
  }
}

testEmail();
