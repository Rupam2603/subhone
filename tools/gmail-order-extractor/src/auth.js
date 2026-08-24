const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");
const readline = require("readline");
const { google } = require("googleapis");
const chalk = require("chalk");

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

/**
 * Loads credentials from file.
 */
function loadCredentials(credentialsPath) {
  const resolvedPath = path.resolve(credentialsPath || "credentials.json");
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Credentials file not found at: ${resolvedPath}\n` +
      `Please download OAuth2 Client Credentials (JSON) from Google Cloud Console and save as credentials.json`
    );
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  const keys = JSON.parse(content);
  const creds = keys.installed || keys.web;

  if (!creds) {
    throw new Error("Invalid credentials.json format. Expected 'installed' or 'web' client configuration.");
  }

  return creds;
}

/**
 * Creates OAuth2 client instance.
 */
function createOAuth2Client(credentialsPath, redirectUri = "http://localhost:3000/oauth2callback") {
  const creds = loadCredentials(credentialsPath);
  const client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    redirectUri
  );
  return client;
}

/**
 * Gets authenticated OAuth2 client with cached or newly requested tokens.
 */
async function getAuthenticatedClient(options = {}) {
  const credentialsPath = options.credentialsPath || "credentials.json";
  const tokenPath = path.resolve(options.tokenPath || "token.json");

  const oauth2Client = createOAuth2Client(credentialsPath);

  // 1. Check if token.json exists
  if (fs.existsSync(tokenPath)) {
    try {
      const tokenContent = fs.readFileSync(tokenPath, "utf8");
      const tokens = JSON.parse(tokenContent);
      oauth2Client.setCredentials(tokens);

      // Check if token is expired and refresh if possible
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        if (tokens.refresh_token) {
          console.log(chalk.yellow("  ⟳ Access token expired. Refreshing token..."));
          const refreshRes = await oauth2Client.refreshAccessToken();
          const refreshedTokens = refreshRes.credentials;
          fs.writeFileSync(tokenPath, JSON.stringify(refreshedTokens, null, 2));
          oauth2Client.setCredentials(refreshedTokens);
        }
      }
      return oauth2Client;
    } catch (err) {
      console.warn(chalk.yellow(`  ⚠ Failed to read existing token.json: ${err.message}. Prompting re-auth...`));
    }
  }

  // 2. Perform interactive authentication
  return await authenticateInteractive(oauth2Client, tokenPath);
}

/**
 * Interactive authentication flow with local server or CLI code prompt.
 */
function authenticateInteractive(oauth2Client, tokenPath) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    console.log(chalk.cyan("\n================ GMAIL API AUTHENTICATION ================"));
    console.log("Authorize this app by visiting this URL:\n");
    console.log(chalk.bold.blue(authUrl));
    console.log(chalk.cyan("==========================================================\n"));

    // Start local server to capture callback
    let server;
    const timeout = setTimeout(() => {
      if (server) server.close();
    }, 180000); // 3 minutes timeout

    server = http.createServer(async (req, res) => {
      try {
        if (req.url.startsWith("/oauth2callback")) {
          const qs = new url.URL(req.url, "http://localhost:3000").searchParams;
          const code = qs.get("code");

          if (code) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("<h2>Authentication successful! You may close this tab and return to the terminal.</h2>");
            server.close();
            clearTimeout(timeout);

            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
            console.log(chalk.green(`\n✓ Token successfully saved to ${tokenPath}`));
            resolve(oauth2Client);
          } else {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end("<h2>Authentication failed: No authorization code received.</h2>");
          }
        }
      } catch (err) {
        reject(err);
      }
    }).listen(3000, () => {
      console.log(chalk.gray("Waiting for authorization callback on http://localhost:3000/oauth2callback ..."));
      console.log(chalk.gray("Or paste the authorization code below if redirect fails:\n"));
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("Enter the authorization code: ", async (code) => {
        rl.close();
        if (code && code.trim()) {
          try {
            server.close();
            clearTimeout(timeout);
            const { tokens } = await oauth2Client.getToken(code.trim());
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
            console.log(chalk.green(`\n✓ Token successfully saved to ${tokenPath}`));
            resolve(oauth2Client);
          } catch (err) {
            reject(err);
          }
        }
      });
    });

    server.on("error", (err) => {
      console.warn(chalk.yellow(`Local server error (port 3000 might be in use): ${err.message}`));
    });
  });
}

/**
 * Gets Gmail API instance.
 */
async function getGmailService(options = {}) {
  const auth = await getAuthenticatedClient(options);
  return google.gmail({ version: "v1", auth });
}

module.exports = {
  loadCredentials,
  createOAuth2Client,
  getAuthenticatedClient,
  getGmailService,
  SCOPES,
};
