const pdfParse = require("pdf-parse");
const { GENERIC_ORDER_ID_PATTERNS, PRICE_PATTERNS } = require("./merchantPatterns");

/**
 * Parses PDF invoice/receipt attachment and extracts text data.
 *
 * @param {Buffer} buffer - PDF binary buffer
 * @returns {Promise<{ text: string, orderId?: string, total?: number, items?: Array }>}
 */
async function parsePdfAttachment(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text || "";

    let orderId = null;
    for (const pattern of GENERIC_ORDER_ID_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        orderId = match[1].trim();
        break;
      }
    }

    let total = 0;
    for (const pattern of PRICE_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const num = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(num) && num > total) {
          total = num;
        }
      }
    }

    return {
      success: true,
      text,
      orderId,
      total,
      pageCount: data.numpages,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

module.exports = {
  parsePdfAttachment,
};
