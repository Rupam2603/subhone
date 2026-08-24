#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const chalk = require("chalk");
require("dotenv").config();

const {
  getGmailService,
  fetchOrderEmails,
  parseEmail,
  normalizeOrders,
  generateMarkdownReport,
  generatePdfReport,
  runExtractionPipeline,
} = require("../src/index");

const program = new Command();

program
  .name("gmail-orders")
  .description("Extract order details from Gmail and generate formatted PDF/Markdown expense reports")
  .version("1.0.0");

// Command: AUTH
program
  .command("auth")
  .description("Authenticate with Gmail API via OAuth2")
  .option("-c, --credentials <path>", "Path to credentials.json", process.env.GOOGLE_APPLICATION_CREDENTIALS || "credentials.json")
  .option("-t, --token <path>", "Path to token.json", process.env.GMAIL_TOKEN_PATH || "token.json")
  .action(async (options) => {
    try {
      console.log(chalk.cyan("Starting Gmail OAuth2 Authentication..."));
      await getGmailService({
        credentialsPath: options.credentials,
        tokenPath: options.token,
      });
      console.log(chalk.green("✓ Authenticated successfully with Gmail."));
    } catch (err) {
      console.error(chalk.red("Authentication failed:"), err.message);
      process.exit(1);
    }
  });

// Command: FETCH
program
  .command("fetch")
  .description("Search and download raw order emails from Gmail")
  .option("-d, --days <number>", "Fetch orders from the last N days", "30")
  .option("--after <date>", "Fetch orders after date (YYYY-MM-DD)")
  .option("--before <date>", "Fetch orders before date (YYYY-MM-DD)")
  .option("-q, --query <string>", "Custom Gmail search query")
  .option("-m, --merchants <list>", "Comma-separated merchant keywords (e.g. amazon,flipkart,subhone)")
  .option("--max <number>", "Maximum emails to fetch", "100")
  .option("--data-dir <dir>", "Directory to cache raw emails", "./data")
  .action(async (options) => {
    try {
      const gmail = await getGmailService();
      const merchants = options.merchants ? options.merchants.split(",").map((s) => s.trim()) : undefined;
      const emails = await fetchOrderEmails(gmail, {
        days: options.days,
        afterDate: options.after,
        beforeDate: options.before,
        query: options.query,
        merchants,
        maxResults: parseInt(options.max, 10),
        dataDir: options.dataDir,
      });
      console.log(chalk.green(`✓ Successfully fetched and cached ${emails.length} emails.`));
    } catch (err) {
      console.error(chalk.red("Fetch failed:"), err.message);
      process.exit(1);
    }
  });

// Command: PARSE
program
  .command("parse")
  .description("Parse cached raw emails into structured orders JSON")
  .option("--data-dir <dir>", "Directory containing raw_emails", "./data")
  .action(async (options) => {
    try {
      const rawDir = path.join(path.resolve(options.dataDir), "raw_emails");
      if (!fs.existsSync(rawDir)) {
        throw new Error(`Raw emails directory not found: ${rawDir}. Run 'fetch' command first.`);
      }

      const files = fs.readdirSync(rawDir).filter((f) => f.endsWith(".json"));
      console.log(chalk.cyan(`Found ${files.length} cached emails. Parsing...`));

      const parsedOrders = [];
      for (const file of files) {
        const rawData = JSON.parse(fs.readFileSync(path.join(rawDir, file), "utf8"));
        const parsed = await parseEmail(rawData);
        parsedOrders.push(parsed);
      }

      const normalized = normalizeOrders(parsedOrders);
      const outPath = path.join(path.resolve(options.dataDir), "orders.json");
      fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2));

      console.log(chalk.green(`✓ Parsed and normalized ${normalized.orders.length} orders saved to: ${outPath}`));
      console.log(chalk.bold(`  Total Spend: ₹${normalized.meta.total_spend.toLocaleString("en-IN")}`));
      console.log(chalk.bold(`  Merchants: ${normalized.meta.merchants_count}`));
    } catch (err) {
      console.error(chalk.red("Parse failed:"), err.message);
      process.exit(1);
    }
  });

// Command: EXPORT
program
  .command("export")
  .description("Export normalized orders data to PDF / Markdown")
  .option("-f, --format <format>", "Export format: pdf, text, or both", "both")
  .option("-i, --input <path>", "Path to orders.json", "./data/orders.json")
  .option("-o, --output-dir <dir>", "Output directory", "./output")
  .action(async (options) => {
    try {
      const inputPath = path.resolve(options.input);
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}. Run 'parse' first.`);
      }

      const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
      const outputDir = path.resolve(options.outputDir);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().slice(0, 10);

      if (options.format === "text" || options.format === "both") {
        const mdPath = path.join(outputDir, `order_report_${timestamp}.md`);
        generateMarkdownReport(data, mdPath);
        console.log(chalk.green(`✓ Markdown Report: ${mdPath}`));
      }

      if (options.format === "pdf" || options.format === "both") {
        const pdfPath = path.join(outputDir, `order_report_${timestamp}.pdf`);
        await generatePdfReport(data, pdfPath);
        console.log(chalk.green(`✓ PDF Report: ${pdfPath}`));
      }
    } catch (err) {
      console.error(chalk.red("Export failed:"), err.message);
      process.exit(1);
    }
  });

// Command: RUN (End-to-End)
program
  .command("run")
  .description("Run complete pipeline (fetch -> parse -> export)")
  .option("-d, --days <number>", "Fetch orders from the last N days", "30")
  .option("-f, --format <format>", "Export format: pdf, text, or both", "both")
  .option("-o, --output-dir <dir>", "Output directory", "./output")
  .action(async (options) => {
    try {
      await runExtractionPipeline(options);
    } catch (err) {
      console.error(chalk.red("\nExecution error:"), err.message);
      process.exit(1);
    }
  });

// Command: DEMO / TEST-RUN
program
  .command("demo")
  .description("Generate sample PDF and Markdown reports using mock order emails for instant verification")
  .option("-o, --output-dir <dir>", "Output directory", "./output")
  .action(async (options) => {
    try {
      console.log(chalk.cyan("\n🧪 Generating Demo Order Extraction & PDF/Markdown Report..."));
      
      const sampleOrders = [
        {
          order_id: "ORD-94821-IN",
          merchant: "SubhOne Health",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
          items: [
            { name: "Paracetamol 650mg (Dolo)", qty: 2, price: 65 },
            { name: "Vitamin C 500mg Chewable", qty: 1, price: 180 },
            { name: "First Aid Antiseptic Liquid 100ml", qty: 1, price: 95 },
          ],
          subtotal: 405,
          tax: 0,
          shipping: 0,
          total: 405,
          tracking: [{ carrier: "BlueDart", number: "7749210948", url: "https://www.bluedart.com/tracking?trackNumber=7749210948" }],
          payment: { method: "UPI (Google Pay)", last4: "" },
        },
        {
          order_id: "402-8921844-3918274",
          merchant: "Amazon",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
          items: [
            { name: "Omron Blood Pressure Monitor HEM 7120", qty: 1, price: 1999 },
            { name: "Digital Thermometer with Fever Alert", qty: 1, price: 299 },
          ],
          subtotal: 2298,
          tax: 0,
          shipping: 0,
          total: 2298,
          tracking: [{ carrier: "Amazon Shipping", number: "AMZIN84920194", url: "https://amazon.in/progress-tracker/package/" }],
          payment: { method: "Credit / Debit Card", last4: "4092" },
        },
        {
          order_id: "OD3948201958291048",
          merchant: "Flipkart",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
          items: [
            { name: "Accu-Chek Active Blood Glucose Glucometer Kit", qty: 1, price: 849 },
            { name: "Test Strips 50 Count Box", qty: 1, price: 750 },
          ],
          subtotal: 1599,
          tax: 0,
          shipping: 40,
          total: 1639,
          tracking: [{ carrier: "Delhivery", number: "192849102948", url: "https://www.delhivery.com/track/package/192849102948" }],
          payment: { method: "Net Banking", last4: "" },
        },
        {
          order_id: "W894210492",
          merchant: "Apple",
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
          items: [
            { name: "Apple Watch Series 9 GPS 45mm", qty: 1, price: 44900 },
          ],
          subtotal: 44900,
          tax: 0,
          shipping: 0,
          total: 44900,
          tracking: [{ carrier: "BlueDart", number: "994029104", url: "https://www.bluedart.com/tracking" }],
          payment: { method: "Credit / Debit Card", last4: "8821" },
        },
      ];

      const normalized = normalizeOrders(sampleOrders);
      const outputDir = path.resolve(options.outputDir || "./output");
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().slice(0, 10);
      const mdPath = path.join(outputDir, `sample_order_report_${timestamp}.md`);
      const pdfPath = path.join(outputDir, `sample_order_report_${timestamp}.pdf`);

      generateMarkdownReport(normalized, mdPath);
      await generatePdfReport(normalized, pdfPath);

      console.log(chalk.bold.green("\n✨ Demo Generated Successfully:"));
      console.log(chalk.cyan(`  📄 Markdown Report: ${mdPath}`));
      console.log(chalk.cyan(`  📑 PDF Report:      ${pdfPath}\n`));
      console.log(chalk.gray(`  Summary: ${normalized.orders.length} orders totaling ₹${normalized.meta.total_spend.toLocaleString("en-IN")}`));
    } catch (err) {
      console.error(chalk.red("Demo error:"), err.message);
    }
  });

program.parse(process.argv);
