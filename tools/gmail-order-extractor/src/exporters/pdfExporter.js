const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

/**
 * Generates a styled PDF report from normalized orders data.
 *
 * @param {object} normalizedData - { meta, orders }
 * @param {string} outputPath - PDF destination file path
 * @returns {Promise<string>}
 */
function generatePdfReport(normalizedData, outputPath) {
  return new Promise((resolve, reject) => {
    const { meta, orders } = normalizedData;
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const primaryColor = "#006a39";
    const darkTextColor = "#0f172a";
    const mutedTextColor = "#64748b";
    const lightBg = "#f1f5f9";
    const borderColor = "#e2e8f0";

    // ──────────────────────────────────────────
    // 1. COVER / HEADER SECTION
    // ──────────────────────────────────────────
    doc.rect(40, 40, 515, 60).fill(primaryColor);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text("GMAIL ORDER DETAILS & EXPENSE REPORT", 55, 53);
    doc.fillColor("#e2e8f0").font("Helvetica").fontSize(9).text(
      `Generated on ${new Date(meta.generated_at).toLocaleString("en-IN")} • Extraction Suite`,
      55,
      78
    );

    // ──────────────────────────────────────────
    // 2. KPI SUMMARY CARDS
    // ──────────────────────────────────────────
    const cardY = 115;
    const cardWidth = 160;
    const cardHeight = 55;
    const cardGap = 17;

    // Card 1: Total Spend
    doc.roundedRect(40, cardY, cardWidth, cardHeight, 6).fill(lightBg);
    doc.fillColor(mutedTextColor).font("Helvetica").fontSize(8.5).text("TOTAL SPEND", 52, cardY + 10);
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(15).text(
      `Rs. ${meta.total_spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      52,
      cardY + 26
    );

    // Card 2: Orders Count
    doc.roundedRect(40 + cardWidth + cardGap, cardY, cardWidth, cardHeight, 6).fill(lightBg);
    doc.fillColor(mutedTextColor).font("Helvetica").fontSize(8.5).text("TOTAL ORDERS", 40 + cardWidth + cardGap + 12, cardY + 10);
    doc.fillColor(darkTextColor).font("Helvetica-Bold").fontSize(15).text(
      `${meta.order_count}`,
      40 + cardWidth + cardGap + 12,
      cardY + 26
    );

    // Card 3: Merchants
    doc.roundedRect(40 + (cardWidth + cardGap) * 2, cardY, cardWidth, cardHeight, 6).fill(lightBg);
    doc.fillColor(mutedTextColor).font("Helvetica").fontSize(8.5).text("MERCHANTS", 40 + (cardWidth + cardGap) * 2 + 12, cardY + 10);
    doc.fillColor(darkTextColor).font("Helvetica-Bold").fontSize(15).text(
      `${meta.merchants_count}`,
      40 + (cardWidth + cardGap) * 2 + 12,
      cardY + 26
    );

    doc.y = cardY + cardHeight + 20;

    // ──────────────────────────────────────────
    // 3. MERCHANT SPEND SUMMARY TABLE
    // ──────────────────────────────────────────
    doc.fillColor(darkTextColor).font("Helvetica-Bold").fontSize(12).text("Spend Distribution by Merchant", 40, doc.y);
    doc.moveDown(0.4);

    let tableY = doc.y;
    // Table Header
    doc.rect(40, tableY, 515, 18).fill("#e2e8f0");
    doc.fillColor(darkTextColor).font("Helvetica-Bold").fontSize(8.5);
    doc.text("Merchant", 50, tableY + 5);
    doc.text("Orders", 220, tableY + 5, { width: 60, align: "center" });
    doc.text("Total Spent (Rs.)", 320, tableY + 5, { width: 100, align: "right" });
    doc.text("% Share", 450, tableY + 5, { width: 90, align: "right" });

    tableY += 18;

    for (const [merchant, stats] of Object.entries(meta.merchant_breakdown || {})) {
      const pct = meta.total_spend > 0 ? ((stats.spend / meta.total_spend) * 100).toFixed(1) : "0.0";
      
      doc.rect(40, tableY, 515, 17).stroke(borderColor);
      doc.fillColor(darkTextColor).font("Helvetica").fontSize(8.5);
      doc.text(merchant, 50, tableY + 4);
      doc.text(String(stats.count), 220, tableY + 4, { width: 60, align: "center" });
      doc.text(`Rs. ${stats.spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 320, tableY + 4, { width: 100, align: "right" });
      doc.text(`${pct}%`, 450, tableY + 4, { width: 90, align: "right" });
      
      tableY += 17;
    }

    doc.y = tableY + 18;

    // ──────────────────────────────────────────
    // 4. ITEMIZED ORDERS SECTION
    // ──────────────────────────────────────────
    doc.fillColor(darkTextColor).font("Helvetica-Bold").fontSize(12).text("Itemized Order Receipts", 40, doc.y);
    doc.moveDown(0.4);

    orders.forEach((order, idx) => {
      // Estimated height for this order box
      const estimatedHeight = 35 + ((order.items || []).length * 13) + 15;
      if (doc.y + estimatedHeight > 760) {
        doc.addPage();
        doc.y = 40;
      }

      const orderStartY = doc.y;
      const dateFormatted = new Date(order.date).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // Order Card Box
      doc.rect(40, orderStartY, 515, 22).fill(lightBg);
      doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9.5).text(
        `#${idx + 1}. ${order.merchant} — Order ID: ${order.order_id}`,
        48,
        orderStartY + 6
      );
      doc.fillColor(darkTextColor).font("Helvetica-Bold").fontSize(9.5).text(
        `Rs. ${order.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        420,
        orderStartY + 6,
        { width: 125, align: "right" }
      );

      let itemY = orderStartY + 26;

      // Meta row
      doc.fillColor(mutedTextColor).font("Helvetica").fontSize(8).text(
        `Date: ${dateFormatted} | Payment: ${order.payment.method}${order.payment.last4 ? ` (${order.payment.last4})` : ""}`,
        48,
        itemY
      );

      itemY += 13;

      // Items list
      (order.items || []).forEach((item) => {
        doc.fillColor(darkTextColor).font("Helvetica").fontSize(8).text(
          `• ${item.name}`,
          55,
          itemY,
          { width: 320 }
        );
        doc.fillColor(mutedTextColor).fontSize(8).text(
          `Qty: ${item.qty}`,
          380,
          itemY,
          { width: 50 }
        );
        doc.fillColor(darkTextColor).fontSize(8).text(
          `Rs. ${(item.price * item.qty).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          440,
          itemY,
          { width: 105, align: "right" }
        );
        itemY += 12;
      });

      doc.y = itemY + 6;
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke(borderColor);
      doc.y += 8;
    });

    // ──────────────────────────────────────────
    // 5. FOOTER & PAGE NUMBERING
    // ──────────────────────────────────────────
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.fillColor(mutedTextColor).fontSize(7.5).text(
        `SubhOne Order Extractor • Page ${i + 1} of ${totalPages}`,
        40,
        doc.page.height - 20,
        { align: "center", width: 515, lineBreak: false }
      );
    }

    doc.end();

    writeStream.on("finish", () => {
      resolve(outputPath);
    });

    writeStream.on("error", (err) => {
      reject(err);
    });
  });
}

module.exports = {
  generatePdfReport,
};
