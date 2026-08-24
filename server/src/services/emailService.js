const nodemailer = require("nodemailer");

const DEFAULT_ADMIN_EMAIL = "subhonehealthgroup@gmail.com";

/**
 * Creates and returns a Nodemailer transporter based on environment variables.
 */
function getTransporter() {
  const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (emailUser && emailPass) {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    }

    // Default to Gmail service if host is not explicitly specified
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  }

  return null;
}

/**
 * Formats full address string.
 */
function formatAddress(addr) {
  if (!addr) return "Not provided";
  const parts = [
    addr.street || addr.line1,
    addr.city,
    addr.state,
    addr.pincode ? `PIN: ${addr.pincode}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

/**
 * Generates plain text email body for order notification.
 */
function generatePlainText(order) {
  const addr = order.address || {};
  const itemsText = (order.items || [])
    .map(
      (item, idx) =>
        `  ${idx + 1}. ${item.name} (${item.type || "Item"}) - Qty: ${item.quantity} x ₹${item.price} = ₹${item.price * item.quantity}`
    )
    .join("\n");

  return `
========================================
NEW ORDER RECEIVED - SUBHONE HEALTH
========================================

Order ID: ${order.id || "N/A"}
Date/Time: ${new Date(order.placedAt || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
Payment Method: ${order.paymentMethod || "Cash on Delivery"}
Estimated Delivery: ${order.eta || "2-4 business days"}

--- CUSTOMER & DELIVERY DETAILS ---
Name: ${addr.name || "N/A"}
Phone: ${addr.phone || "N/A"}
Address: ${formatAddress(addr)}

--- ORDERED ITEMS ---
${itemsText || "  No items"}

--- PAYMENT SUMMARY ---
Items Subtotal: ₹${order.subtotal || 0}
MRP Savings: ₹${order.mrpSavings || 0}
Coupon Discount: ₹${order.couponDiscount || 0} ${order.coupon?.code ? `(${order.coupon.code})` : ""}
Delivery Fee: ₹${order.deliveryFee === 0 ? "FREE (₹0)" : order.deliveryFee || 0}
TOTAL AMOUNT: ₹${order.total || 0}

========================================
SubhOne E-Commerce Admin Notification
========================================
`.trim();
}

/**
 * Generates responsive HTML email body for order notification.
 */
function generateHtml(order) {
  const addr = order.address || {};
  const itemsRows = (order.items || [])
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-size: 14px; color: #1f2937;">
          <strong>${item.name}</strong>
          ${item.brand ? `<br/><span style="font-size: 12px; color: #6b7280;">Brand: ${item.brand}</span>` : ""}
          <br/><span style="font-size: 11px; text-transform: uppercase; color: #006a39; font-weight: 600;">${item.type || "Product"}</span>
        </td>
        <td style="padding: 12px 8px; font-size: 14px; text-align: center; color: #374151;">${item.quantity}</td>
        <td style="padding: 12px 8px; font-size: 14px; text-align: right; color: #374151;">₹${item.price}</td>
        <td style="padding: 12px 8px; font-size: 14px; text-align: right; font-weight: 600; color: #111827;">₹${item.price * item.quantity}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Order Notification - ${order.id}</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #006a39 0%, #004d28 100%); padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">🌿 Subh<span style="color: #82faab;">One</span> Health</h1>
      <p style="margin: 6px 0 0; font-size: 15px; opacity: 0.95; font-weight: 500;">New Customer Order Notification</p>
    </div>

    <div style="padding: 24px;">
      
      <!-- Order Badge & Time -->
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 13px; color: #065f46; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Order Reference</div>
        <div style="font-size: 22px; font-weight: 800; color: #047857; margin-top: 2px;">#${order.id || "N/A"}</div>
        <div style="font-size: 12px; color: #047857; margin-top: 4px;">Placed on ${new Date(order.placedAt || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
      </div>

      <!-- Customer Details -->
      <h3 style="margin: 20px 0 8px; font-size: 16px; color: #111827; border-bottom: 2px solid #006a39; padding-bottom: 6px;">📍 Delivery & Customer Details</h3>
      <table style="width: 100%; font-size: 14px; margin-bottom: 20px; line-height: 1.6;">
        <tr>
          <td style="width: 30%; color: #6b7280; font-weight: 600;">Customer:</td>
          <td style="color: #111827; font-weight: 700;">${addr.name || "N/A"}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-weight: 600;">Phone:</td>
          <td style="color: #111827; font-weight: 700;"><a href="tel:${addr.phone}" style="color: #006a39; text-decoration: none;">${addr.phone || "N/A"}</a></td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-weight: 600; vertical-align: top;">Address:</td>
          <td style="color: #111827;">${formatAddress(addr)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; font-weight: 600;">Payment Mode:</td>
          <td style="color: #111827; font-weight: 600;">${order.paymentMethod || "Cash on Delivery"}</td>
        </tr>
      </table>

      <!-- Items Table -->
      <h3 style="margin: 20px 0 8px; font-size: 16px; color: #111827; border-bottom: 2px solid #006a39; padding-bottom: 6px;">📦 Ordered Items</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #6b7280;">
            <th style="padding: 10px 8px; text-align: left;">Item</th>
            <th style="padding: 10px 8px; text-align: center;">Qty</th>
            <th style="padding: 10px 8px; text-align: right;">Price</th>
            <th style="padding: 10px 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || '<tr><td colspan="4" style="text-align: center; padding: 12px;">No items</td></tr>'}
        </tbody>
      </table>

      <!-- Pricing Breakdown -->
      <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 14px; line-height: 1.8;">
          <tr>
            <td style="color: #6b7280;">Subtotal:</td>
            <td style="text-align: right; color: #111827; font-weight: 600;">₹${order.subtotal || 0}</td>
          </tr>
          ${order.mrpSavings > 0 ? `
          <tr>
            <td style="color: #059669;">MRP Savings:</td>
            <td style="text-align: right; color: #059669; font-weight: 600;">-₹${order.mrpSavings}</td>
          </tr>
          ` : ""}
          ${order.couponDiscount > 0 ? `
          <tr>
            <td style="color: #059669;">Coupon Discount ${order.coupon?.code ? `(${order.coupon.code})` : ""}:</td>
            <td style="text-align: right; color: #059669; font-weight: 600;">-₹${order.couponDiscount}</td>
          </tr>
          ` : ""}
          <tr>
            <td style="color: #6b7280;">Delivery Charge:</td>
            <td style="text-align: right; color: #111827; font-weight: 600;">${order.deliveryFee === 0 ? '<span style="color: #059669;">FREE</span>' : `₹${order.deliveryFee}`}</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding-top: 8px; font-size: 16px; font-weight: 800; color: #111827;">Grand Total:</td>
            <td style="padding-top: 8px; text-align: right; font-size: 20px; font-weight: 800; color: #006a39;">₹${order.total || 0}</td>
          </tr>
        </table>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af;">
      This email was automatically generated by <strong>SubhOne Platform</strong> for administrator dispatch notification.
    </div>

  </div>
</body>
</html>
`.trim();
}

/**
 * Sends email via EmailJS REST API if configured.
 *
 * @param {object} params - EmailJS payload
 * @returns {Promise<{ success: boolean, status?: number, error?: string }>}
 */
async function sendViaEmailJS({ serviceId, templateId, publicKey, templateParams, privateKey }) {
  const endpoint = "https://api.emailjs.com/api/v1.0/email/send";
  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: templateParams,
    ...(privateKey ? { accessToken: privateKey } : {}),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true, status: response.status };
    }
    const errorText = await response.text();
    return { success: false, error: errorText || `HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sends order notification email to the configured administrator email.
 *
 * @param {object} order - The created order object
 * @returns {Promise<{ success: boolean, messageId?: string, logged?: boolean, note?: string }>}
 */
async function sendOrderNotification(order) {
  const recipientEmail = process.env.ADMIN_ORDER_EMAIL || DEFAULT_ADMIN_EMAIL;
  const transporter = getTransporter();

  // 1. Try Nodemailer (SMTP / Gmail App Password) if configured
  if (transporter) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"SubhOne Orders" <${process.env.EMAIL_USER || "orders@subhone.local"}>`,
      to: recipientEmail,
      subject: `🛒 New Order #${order.id || ""} Received - ₹${order.total || 0} (${order.address?.name || "Customer"})`,
      text: generatePlainText(order),
      html: generateHtml(order),
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`\n  ✓ Order notification email sent to ${recipientEmail} via SMTP (Message ID: ${info.messageId})\n`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      console.error(`\n  ✗ SMTP email dispatch failed:`, err.message);
    }
  }

  // 2. Try EmailJS if configured
  const emailJsKey = process.env.EMAILJS_PUBLIC_KEY || "6bTlpiKEqGqGyAMaN";
  const emailJsService = process.env.EMAILJS_SERVICE_ID;
  const emailJsTemplate = process.env.EMAILJS_TEMPLATE_ID;

  if (emailJsService && emailJsTemplate) {
    const addr = order.address || {};
    const result = await sendViaEmailJS({
      serviceId: emailJsService,
      templateId: emailJsTemplate,
      publicKey: emailJsKey,
      privateKey: process.env.EMAILJS_PRIVATE_KEY,
      templateParams: {
        to_email: recipientEmail,
        order_id: order.id || "N/A",
        customer_name: addr.name || "Customer",
        customer_phone: addr.phone || "N/A",
        customer_address: formatAddress(addr),
        order_total: `₹${order.total || 0}`,
        order_subtotal: `₹${order.subtotal || 0}`,
        payment_method: order.paymentMethod || "Cash on Delivery",
        order_items: (order.items || []).map((i) => `${i.name} (x${i.quantity})`).join(", "),
        order_html: generateHtml(order),
      },
    });

    if (result.success) {
      console.log(`\n  ✓ Order notification email sent to ${recipientEmail} via EmailJS\n`);
      return { success: true, provider: "emailjs" };
    }
    console.error(`\n  ✗ EmailJS dispatch failed:`, result.error);
  }

  // 3. Fallback: Log order details to console
  console.log(`\n  ======================================================`);
  console.log(`  📧 [ORDER EMAIL NOTIFICATION] -> Target: ${recipientEmail}`);
  console.log(`  ------------------------------------------------------`);
  console.log(`  Order: #${order.id} | Amount: ₹${order.total} | Customer: ${order.address?.name || "N/A"} (${order.address?.phone || "N/A"})`);
  console.log(`  Address: ${formatAddress(order.address)}`);
  console.log(`  Payment: ${order.paymentMethod || "Cash on Delivery"}`);
  console.log(`  Items (${(order.items || []).length}): ${(order.items || []).map((i) => `${i.name} x${i.quantity}`).join(", ")}`);
  console.log(`  ℹ️  To send live emails, configure EMAIL_USER/EMAIL_PASS (SMTP) or EMAILJS_SERVICE_ID/EMAILJS_TEMPLATE_ID in server/.env`);
  console.log(`  ======================================================\n`);

  return {
    success: true,
    logged: true,
    note: "Logged to console (SMTP/EmailJS credentials not active)",
  };
}

module.exports = {
  sendOrderNotification,
  sendViaEmailJS,
  generatePlainText,
  generateHtml,
};
