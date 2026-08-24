const fs = require("fs");
const path = require("path");

/**
 * Generates a clean Markdown and text summary report from normalized orders data.
 *
 * @param {object} normalizedData - { meta, orders }
 * @param {string} outputPath - Output file path
 * @returns {string}
 */
function generateMarkdownReport(normalizedData, outputPath) {
  const { meta, orders } = normalizedData;

  const lines = [];
  lines.push(`# 📦 Gmail Order Details & Expense Report`);
  lines.push(`\n**Generated On**: ${new Date(meta.generated_at).toLocaleString("en-IN")}`);
  lines.push(`**Total Orders Extracted**: ${meta.order_count}`);
  lines.push(`**Total Amount Spent**: ₹${meta.total_spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`);
  lines.push(`**Unique Merchants**: ${meta.merchants_count}`);
  lines.push(`\n---\n`);

  // 1. Merchant Breakdown Table
  lines.push(`## 📊 Spend by Merchant`);
  lines.push(`| Merchant | Order Count | Total Spent (₹) | % of Total |`);
  lines.push(`| :--- | :---: | :---: | :---: |`);
  for (const [merchant, stats] of Object.entries(meta.merchant_breakdown || {})) {
    const pct = meta.total_spend > 0 ? ((stats.spend / meta.total_spend) * 100).toFixed(1) : "0.0";
    lines.push(`| **${merchant}** | ${stats.count} | ₹${stats.spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })} | ${pct}% |`);
  }
  lines.push(`\n---\n`);

  // 2. Monthly Summary Table
  lines.push(`## 📅 Monthly Breakdown`);
  lines.push(`| Month | Orders | Total Spend (₹) |`);
  lines.push(`| :--- | :---: | :---: |`);
  for (const [month, stats] of Object.entries(meta.monthly_breakdown || {})) {
    lines.push(`| ${month} | ${stats.count} | ₹${stats.spend.toLocaleString("en-IN", { minimumFractionDigits: 2 })} |`);
  }
  lines.push(`\n---\n`);

  // 3. Itemized Orders List
  lines.push(`## 🧾 Itemized Order Details`);

  orders.forEach((order, idx) => {
    const dateFormatted = new Date(order.date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    lines.push(`\n### ${idx + 1}. ${order.merchant} — Order #${order.order_id}`);
    lines.push(`- **Date**: ${dateFormatted}`);
    lines.push(`- **Total Amount**: **₹${order.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}**`);
    lines.push(`- **Payment**: ${order.payment.method}${order.payment.last4 ? ` (ending in ${order.payment.last4})` : ""}`);

    if (order.tracking && order.tracking.length > 0) {
      const trackingStr = order.tracking.map((t) => `[${t.carrier}: ${t.number}](${t.url})`).join(", ");
      lines.push(`- **Tracking**: ${trackingStr}`);
    }

    lines.push(`\n**Items:**`);
    lines.push(`| Item Name | Qty | Unit Price (₹) | Line Total (₹) |`);
    lines.push(`| :--- | :---: | :---: | :---: |`);
    for (const item of order.items || []) {
      const lineTotal = (item.price * item.qty).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      lines.push(`| ${item.name} | ${item.qty} | ₹${item.price.toLocaleString("en-IN")} | ₹${lineTotal} |`);
    }
    lines.push(`\n`);
  });

  const markdownContent = lines.join("\n");

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, markdownContent, "utf8");
  }

  return markdownContent;
}

module.exports = {
  generateMarkdownReport,
};
