const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

/**
 * Builds Gmail search query string based on criteria.
 */
function buildSearchQuery(options = {}) {
  const parts = [];

  // 1. Custom query override
  if (options.query) {
    parts.push(options.query);
  } else {
    // Subject criteria
    const subjects = options.subjects || ["order", "confirmation", "receipt", "invoice", "bill", "shipped"];
    parts.push(`subject:(${subjects.join(" OR ")})`);

    // Merchant criteria
    if (options.merchants && options.merchants.length) {
      parts.push(`from:(${options.merchants.join(" OR ")})`);
    }
  }

  // 2. Date filters (format: YYYY/MM/DD)
  if (options.afterDate) {
    const d = new Date(options.afterDate);
    const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    parts.push(`after:${dateStr}`);
  } else if (options.days) {
    const past = new Date();
    past.setDate(past.getDate() - Number(options.days));
    const dateStr = `${past.getFullYear()}/${String(past.getMonth() + 1).padStart(2, "0")}/${String(past.getDate()).padStart(2, "0")}`;
    parts.push(`after:${dateStr}`);
  }

  if (options.beforeDate) {
    const d = new Date(options.beforeDate);
    const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    parts.push(`before:${dateStr}`);
  }

  if (options.hasAttachment) {
    parts.push("has:attachment");
  }

  return parts.join(" ");
}

/**
 * Fetches matching messages from Gmail and stores raw copies locally.
 */
async function fetchOrderEmails(gmail, options = {}) {
  const query = buildSearchQuery(options);
  const maxResults = options.maxResults || 200;
  const rawDir = path.resolve(options.dataDir || "./data", "raw_emails");

  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
  }

  console.log(chalk.cyan("\n🔍 Searching Gmail with query:"), chalk.bold(query));
  console.log(chalk.gray(`Max messages to fetch: ${maxResults}`));

  const messagesList = [];
  let pageToken = null;

  do {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(maxResults - messagesList.length, 100),
      pageToken,
    });

    if (listRes.data.messages && listRes.data.messages.length) {
      messagesList.push(...listRes.data.messages);
    }
    pageToken = listRes.data.nextPageToken;
  } while (pageToken && messagesList.length < maxResults);

  console.log(chalk.green(`✓ Found ${messagesList.length} matching emails.`));

  if (!messagesList.length) {
    return [];
  }

  // Fetch full message details for each
  const fetchedEmails = [];
  console.log(chalk.cyan(`⬇ Downloading ${messagesList.length} messages...`));

  for (let i = 0; i < messagesList.length; i++) {
    const msgMeta = messagesList[i];
    const cacheFile = path.join(rawDir, `${msgMeta.id}.json`);

    let msgData;
    if (fs.existsSync(cacheFile) && !options.forceRefresh) {
      msgData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } else {
      const fullRes = await gmail.users.messages.get({
        userId: "me",
        id: msgMeta.id,
        format: "raw", // Raw format includes entire MIME structure & attachments
      });
      msgData = {
        id: msgMeta.id,
        threadId: msgMeta.threadId,
        raw: fullRes.data.raw,
        snippet: fullRes.data.snippet,
        internalDate: fullRes.data.internalDate,
      };
      fs.writeFileSync(cacheFile, JSON.stringify(msgData, null, 2));
    }

    fetchedEmails.push(msgData);
    if ((i + 1) % 10 === 0 || i === messagesList.length - 1) {
      process.stdout.write(`\r  Progress: ${i + 1}/${messagesList.length} emails saved`);
    }
  }
  console.log("\n");

  return fetchedEmails;
}

module.exports = {
  buildSearchQuery,
  fetchOrderEmails,
};
