/**
 * EmailJS Client Integration Helper
 *
 * Sends transactional notifications directly from the browser using EmailJS REST API.
 */

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "6bTlpiKEqGqGyAMaN";
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const PRESCRIPTION_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_PRESCRIPTION_TEMPLATE_ID;
const ORDER_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_ORDER_TEMPLATE_ID;

/**
 * Generic email dispatch via EmailJS REST API.
 *
 * @param {object} options
 * @param {string} options.serviceId
 * @param {string} options.templateId
 * @param {object} options.templateParams
 * @param {string} [options.publicKey]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendEmail({
  serviceId = SERVICE_ID,
  templateId,
  templateParams = {},
  publicKey = PUBLIC_KEY,
}) {
  if (!serviceId || !templateId) {
    // Graceful fallback when template/service is not yet configured
    console.debug("[EmailJS] Skipped: VITE_EMAILJS_SERVICE_ID or Template ID is not configured.");
    return { success: false, skipped: true, reason: "Missing serviceId or templateId" };
  }

  try {
    const res = await fetch(EMAILJS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: templateParams,
      }),
    });

    if (res.ok) {
      return { success: true };
    }

    const errorMsg = await res.text();
    console.warn("[EmailJS] Dispatch failed:", errorMsg);
    return { success: false, error: errorMsg };
  } catch (err) {
    console.warn("[EmailJS] Network/Dispatch error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send notification when a prescription is uploaded.
 */
export async function sendPrescriptionNotification({ fileName, notes, userPhone, userEmail }) {
  if (!PRESCRIPTION_TEMPLATE_ID) return { success: false, skipped: true };

  return sendEmail({
    templateId: PRESCRIPTION_TEMPLATE_ID,
    templateParams: {
      prescription_file: fileName,
      notes: notes || "No additional notes",
      customer_contact: userPhone || userEmail || "Anonymous",
      submitted_at: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
  });
}

/**
 * Send order confirmation notification to customer or admin.
 */
export async function sendOrderConfirmationNotification(order) {
  if (!ORDER_TEMPLATE_ID) return { success: false, skipped: true };

  return sendEmail({
    templateId: ORDER_TEMPLATE_ID,
    templateParams: {
      order_id: order.id,
      order_total: `₹${order.total || 0}`,
      customer_name: order.address?.name || "Customer",
      customer_phone: order.address?.phone || "",
      item_count: (order.items || []).length,
      placed_at: new Date(order.placedAt || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
  });
}

export default {
  sendEmail,
  sendPrescriptionNotification,
  sendOrderConfirmationNotification,
};
