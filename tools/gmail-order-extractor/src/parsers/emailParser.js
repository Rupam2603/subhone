const { simpleParser } = require("mailparser");
const cheerio = require("cheerio");
const {
  identifyMerchant,
  GENERIC_ORDER_ID_PATTERNS,
  PRICE_PATTERNS,
  TRACKING_PATTERNS,
  PAYMENT_PATTERNS,
} = require("./merchantPatterns");
const { parsePdfAttachment } = require("./pdfAttachmentParser");

/**
 * Parses raw Gmail message data into structured order candidate.
 *
 * @param {object} msgData - { id, threadId, raw, snippet, internalDate }
 * @returns {Promise<object>}
 */
async function parseEmail(msgData) {
  let parsedMail = null;

  if (msgData.raw) {
    // Decode base64url to Buffer
    const base64 = msgData.raw.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(base64, "base64");
    parsedMail = await simpleParser(buffer);
  } else {
    parsedMail = {
      subject: msgData.snippet || "Order Email",
      from: { text: "unknown" },
      date: new Date(Number(msgData.internalDate) || Date.now()),
      text: msgData.snippet || "",
      html: `<p>${msgData.snippet || ""}</p>`,
      attachments: [],
    };
  }

  const subject = parsedMail.subject || "";
  const fromText = parsedMail.from?.text || "";
  const emailDate = parsedMail.date || new Date(Number(msgData.internalDate) || Date.now());
  const bodyText = parsedMail.text || "";
  const bodyHtml = parsedMail.html || "";

  // 1. Identify Merchant
  const merchantInfo = identifyMerchant(fromText, subject, bodyText);

  // 2. Extract Order ID
  let orderId = null;
  if (merchantInfo.orderIdRegex) {
    const match = bodyText.match(merchantInfo.orderIdRegex) || subject.match(merchantInfo.orderIdRegex);
    if (match && match[1]) orderId = match[1].trim();
  }
  if (!orderId && merchantInfo.fallbackOrderIdRegex) {
    const match = bodyText.match(merchantInfo.fallbackOrderIdRegex) || subject.match(merchantInfo.fallbackOrderIdRegex);
    if (match && match[1]) orderId = match[1].trim();
  }
  if (!orderId) {
    for (const pattern of GENERIC_ORDER_ID_PATTERNS) {
      const match = bodyText.match(pattern) || subject.match(pattern);
      if (match && match[1]) {
        orderId = match[1].trim();
        break;
      }
    }
  }
  if (!orderId) {
    orderId = `MSG-${msgData.id.slice(0, 10)}`;
  }

  // 3. Extract Tracking Numbers
  const trackingList = [];
  for (const trackRule of TRACKING_PATTERNS) {
    const match = bodyText.match(trackRule.regex);
    if (match && match[1]) {
      trackingList.push({
        carrier: trackRule.carrier,
        number: match[1],
        url: `${trackRule.url}${match[1]}`,
      });
    }
  }

  // 4. Extract Payment Method
  let paymentMethod = "Online Payment";
  let cardLast4 = "";
  for (const payRule of PAYMENT_PATTERNS) {
    const match = bodyText.match(payRule.regex);
    if (match) {
      paymentMethod = payRule.method;
      if (match[2]) cardLast4 = match[2];
      break;
    }
  }

  // 5. Extract Line Items & Amounts via HTML Parsing
  const items = [];
  let total = 0;
  let subtotal = 0;
  let tax = 0;
  let shipping = 0;

  if (bodyHtml) {
    const $ = cheerio.load(bodyHtml);

    // Look for table rows containing item info
    $("table tr").each((_, row) => {
      const rowText = $(row).text();
      // If row contains price pattern and reasonable item text
      const cols = $(row).find("td, th");
      if (cols.length >= 2) {
        const firstColText = $(cols[0]).text().trim();
        const lastColText = $(cols[cols.length - 1]).text().trim();

        const priceMatch = lastColText.match(/[₹$€£Rs\.]*\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/);
        if (priceMatch && priceMatch[1] && firstColText.length > 2 && firstColText.length < 120) {
          const colPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
          if (!isNaN(colPrice) && colPrice > 0 && !/total|subtotal|tax|discount|shipping|fee|gst/i.test(firstColText)) {
            // Check for qty in middle column
            let qty = 1;
            if (cols.length >= 3) {
              const qtyText = $(cols[1]).text().trim();
              const parsedQty = parseInt(qtyText, 10);
              if (!isNaN(parsedQty) && parsedQty > 0 && parsedQty < 100) {
                qty = parsedQty;
              }
            }

            items.push({
              name: firstColText.replace(/\s+/g, " ").trim(),
              qty,
              price: colPrice,
            });
          }
        }
      }
    });

    // Check specific Total fields in text
    $("tr, div, p").each((_, el) => {
      const text = $(el).text().trim();
      if (/^(grand\s*total|order\s*total|total\s*amount|total)[:\s]*/i.test(text)) {
        const match = text.match(/[₹$€£Rs\.]*\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)/);
        if (match && match[1]) {
          const parsed = parseFloat(match[1].replace(/,/g, ""));
          if (!isNaN(parsed) && parsed > total) {
            total = parsed;
          }
        }
      }
    });
  }

  // 6. Fallback total calculation if HTML parsing didn't find explicit total
  if (total === 0) {
    for (const pattern of PRICE_PATTERNS) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(parsed) && parsed > total) {
          total = parsed;
        }
      }
    }
  }

  // 7. Parse PDF attachments if available
  if (parsedMail.attachments && parsedMail.attachments.length) {
    for (const att of parsedMail.attachments) {
      if (att.contentType === "application/pdf" || (att.filename && att.filename.endsWith(".pdf"))) {
        const pdfRes = await parsePdfAttachment(att.content);
        if (pdfRes.success) {
          if (pdfRes.orderId && (!orderId || orderId.startsWith("MSG-"))) {
            orderId = pdfRes.orderId;
          }
          if (pdfRes.total && pdfRes.total > total) {
            total = pdfRes.total;
          }
        }
      }
    }
  }

  // 8. If no items extracted, create a general line item
  if (items.length === 0 && total > 0) {
    items.push({
      name: `${merchantInfo.name} Order Item(s)`,
      qty: 1,
      price: total,
    });
  }

  if (subtotal === 0 && items.length > 0) {
    subtotal = items.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  }

  return {
    email_id: msgData.id,
    thread_id: msgData.threadId,
    subject,
    sender: fromText,
    merchant: merchantInfo.name,
    order_id: orderId,
    date: emailDate.toISOString(),
    items,
    subtotal: subtotal || total,
    tax,
    shipping,
    total: total || subtotal,
    tracking: trackingList,
    payment: {
      method: paymentMethod,
      last4: cardLast4,
    },
  };
}

module.exports = {
  parseEmail,
};
