const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { getGmailService, getAuthenticatedClient } = require("./auth");
const { fetchOrderEmails } = require("./fetcher");
const { parseEmail } = require("./parsers/emailParser");
const { normalizeOrders } = require("./normalizer");
const { generateMarkdownReport } = require("./exporters/textExporter");
const { generatePdfReport } = require("./exporters/pdfExporter");

/**
 * End-to-end pipeline to fetch, parse, and export orders.
 */
async function runExtractionPipeline(options = {}) {
  const dataDir = path.resolve(options.dataDir || "./data");
  const outputDir = path.resolve(options.outputDir || "./output");

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(chalk.bold.green("\n🚀 Starting Gmail Order Details Extractor Pipeline"));

  // 1. Authenticate
  const gmail = await getGmailService(options);

  // 2. Fetch Emails
  const rawEmails = await fetchOrderEmails(gmail, { ...options, dataDir });

  // 3. Parse Emails
  console.log(chalk.cyan(`\n⚙ Parsing ${rawEmails.length} order emails...`));
  const parsedOrders = [];
  for (const raw of rawEmails) {
    try {
      const parsed = await parseEmail(raw);
      parsedOrders.push(parsed);
    } catch (err) {
      console.warn(chalk.yellow(`  ⚠ Error parsing email ${raw.id}: ${err.message}`));
    }
  }

  // 4. Normalize & Deduplicate
  const normalized = normalizeOrders(parsedOrders);
  const jsonPath = path.join(dataDir, "orders.json");
  fs.writeFileSync(jsonPath, JSON.stringify(normalized, null, 2));
  console.log(chalk.green(`✓ Normalized ${normalized.orders.length} orders saved to ${jsonPath}`));

  // 5. Export Reports
  const format = options.format || "both";
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === "text" || format === "both") {
    const mdPath = path.join(outputDir, `order_report_${timestamp}.md`);
    generateMarkdownReport(normalized, mdPath);
    console.log(chalk.bold.blue(`📄 Markdown Report generated: ${mdPath}`));
  }

  if (format === "pdf" || format === "both") {
    const pdfPath = path.join(outputDir, `order_report_${timestamp}.pdf`);
    await generatePdfReport(normalized, pdfPath);
    console.log(chalk.bold.blue(`📑 PDF Report generated: ${pdfPath}`));
  }

  console.log(chalk.bold.green("\n✨ Pipeline Completed Successfully!\n"));
  return normalized;
}

module.exports = {
  getGmailService,
  getAuthenticatedClient,
  fetchOrderEmails,
  parseEmail,
  normalizeOrders,
  generateMarkdownReport,
  generatePdfReport,
  runExtractionPipeline,
};
