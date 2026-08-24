const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { parseEmail } = require("../src/parsers/emailParser");
const { normalizeOrders } = require("../src/normalizer");
const { generateMarkdownReport } = require("../src/exporters/textExporter");
const { generatePdfReport } = require("../src/exporters/pdfExporter");

async function runTests() {
  console.log("▶ Running Gmail Order Extractor parser tests...\n");

  // Test 1: SubhOne Order Email
  const subhoneHtml = `
    <h1>SubhOne Health Order Confirmation</h1>
    <p>Order Reference: #SUBH-89218</p>
    <table>
      <tr><td>Item</td><td>Qty</td><td>Price</td></tr>
      <tr><td>Cetirizine 10mg Box (10 Strips)</td><td>2</td><td>₹120.00</td></tr>
      <tr><td>Amoxicillin 500mg Capsules</td><td>1</td><td>₹240.00</td></tr>
    </table>
    <p>Grand Total: ₹480.00</p>
    <p>Paid via Cash on Delivery</p>
  `;

  const parsedSubhone = await parseEmail({
    id: "msg_subhone_01",
    snippet: "SubhOne Health Order Confirmation #SUBH-89218",
    internalDate: String(Date.now()),
    raw: Buffer.from(
      `From: orders@subhone.local\nSubject: Order Confirmation #SUBH-89218\nContent-Type: text/html\n\n${subhoneHtml}`
    ).toString("base64"),
  });

  assert.strictEqual(parsedSubhone.merchant, "SubhOne Health");
  assert.strictEqual(parsedSubhone.order_id, "SUBH-89218");
  assert.strictEqual(parsedSubhone.total, 480);
  assert.strictEqual(parsedSubhone.items.length >= 2, true);
  console.log("✓ SubhOne HTML Email Parsing Passed");

  // Test 2: Amazon Order Email
  const amazonHtml = `
    <div>
      <p>Details for Order #403-1928491-9281048</p>
      <table>
        <tr>
          <td>Dr. Morepen GlucoOne Blood Glucose Monitor</td>
          <td>1</td>
          <td>₹649.00</td>
        </tr>
      </table>
      <p>Order Total: ₹649.00</p>
      <p>Paid with Visa ending in 9102</p>
    </div>
  `;

  const parsedAmazon = await parseEmail({
    id: "msg_amazon_02",
    snippet: "Your Amazon.in order #403-1928491-9281048 of Dr. Morepen...",
    internalDate: String(Date.now()),
    raw: Buffer.from(
      `From: auto-confirm@amazon.in\nSubject: Your Amazon.in order #403-1928491-9281048\nContent-Type: text/html\n\n${amazonHtml}`
    ).toString("base64"),
  });

  assert.strictEqual(parsedAmazon.merchant, "Amazon");
  assert.strictEqual(parsedAmazon.order_id, "403-1928491-9281048");
  assert.strictEqual(parsedAmazon.total, 649);
  console.log("✓ Amazon Order Regex and DOM Parsing Passed");

  // Test 3: Normalizer & Metrics
  const normalized = normalizeOrders([parsedSubhone, parsedAmazon]);
  assert.strictEqual(normalized.orders.length, 2);
  assert.strictEqual(normalized.meta.total_spend, 480 + 649);
  assert.strictEqual(normalized.meta.merchants_count, 2);
  console.log("✓ Normalizer & Aggregate Analytics Passed");

  // Test 4: PDF & Markdown Exporters
  const outDir = path.join(__dirname, "../output/test_run");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const mdOut = path.join(outDir, "test_report.md");
  const pdfOut = path.join(outDir, "test_report.pdf");

  generateMarkdownReport(normalized, mdOut);
  assert.strictEqual(fs.existsSync(mdOut), true);
  console.log("✓ Markdown Report Generation Passed");

  await generatePdfReport(normalized, pdfOut);
  assert.strictEqual(fs.existsSync(pdfOut), true);
  console.log("✓ PDF Report Generation Passed");

  console.log("\n🎉 All 5 Tests Passed Successfully!");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
