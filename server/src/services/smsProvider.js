const AppError = require("../utils/AppError");

// The provider boundary. Everything upstream of getProvider() knows only
// `{ name, send({ to, message }) }`; swapping in a real gateway is a new object in
// PROVIDERS below and an SMS_PROVIDER value in the environment, nothing more.
//
// Dev provider: prints the code to the server console. The only place in the codebase
// allowed to know a code's plaintext value.
const devLoggerProvider = {
  name: "dev",
  async send({ to, message }) {
    // Belt to getProvider's braces: even a direct caller cannot leak a code into
    // production logs.
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n  [dev-sms] -> ${to}\n     ${message}\n`);
    }
    return { id: `dev-${Date.now()}`, provider: "dev" };
  },
};

function getProvider() {
  const configured = process.env.SMS_PROVIDER || "dev";

  if (configured === "dev") {
    // A production deployment that still points at the dev logger would either print
    // one-time codes to stdout or, with the guard above, silently deliver nothing at
    // all. Both are worse than refusing to start the flow.
    if (process.env.NODE_ENV === "production") {
      throw new AppError(500, "SMS_PROVIDER_MISSING",
        'The "dev" SMS provider cannot be used in production. Configure a real gateway.');
    }
    return devLoggerProvider;
  }

  // Real providers register here in a later phase. Failing loudly beats silently
  // logging OTPs to stdout in an environment that expected real delivery.
  throw new AppError(500, "SMS_PROVIDER_MISSING",
    `SMS provider "${configured}" is not configured.`);
}

module.exports = { getProvider, devLoggerProvider };
