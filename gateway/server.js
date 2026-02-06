const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URLSearchParams } = require("url");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const contents = fs.readFileSync(envPath, "utf-8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const PORT = Number(process.env.GATEWAY_PORT || 5050);
const API_KEY = process.env.GATEWAY_API_KEY || "";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "";

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function isAuthorized(req) {
  if (!API_KEY) return true;
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7) === API_KEY;
  }
  const headerKey = req.headers["x-api-key"];
  return headerKey === API_KEY;
}

function normalizeWhatsapp(value) {
  if (!value) return "";
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

function normalizeSms(value) {
  if (!value) return "";
  return value.replace(/^whatsapp:/, "");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("Payload too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON payload."));
      }
    });
  });
}

function twilioRequest(payload) {
  return new Promise((resolve, reject) => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-sim',hypothesisId:'H3',location:'server.js:95',message:'twilioRequest entry',data:{hasAccountSid:Boolean(TWILIO_ACCOUNT_SID),hasAuthToken:Boolean(TWILIO_AUTH_TOKEN),hasTo:Boolean(payload?.To),hasFrom:Boolean(payload?.From),messageLength:typeof payload?.Body === 'string' ? payload.Body.length : 0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      reject(new Error("Twilio credentials are not configured."));
      return;
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams(payload);
    const body = params.toString();

    const request = https.request(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(responseBody);
          } catch (error) {
            // Ignore parse errors; return raw response.
          }

          const ok = response.statusCode >= 200 && response.statusCode < 300;
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-sim',hypothesisId:'H4',location:'server.js:129',message:'twilioRequest response',data:{statusCode:response.statusCode,ok},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (ok) {
            resolve({
              statusCode: response.statusCode,
              data: parsed || responseBody
            });
          } else {
            reject(
              new Error(
                `Twilio request failed (${response.statusCode}): ${
                  parsed?.message || responseBody || "Unknown error"
                }`
              )
            );
          }
        });
      }
    );

    request.on("error", (error) => {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-sim',hypothesisId:'H5',location:'server.js:148',message:'twilioRequest error',data:{errorName:error?.name || 'Error'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      reject(error);
    });
    request.write(body);
    request.end();
  });
}

async function sendMessage(payload) {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-sim',hypothesisId:'H1',location:'server.js:154',message:'sendMessage entry',data:{channel:payload?.channel || '',hasTo:Boolean(payload?.to),hasFrom:Boolean(payload?.from),messageLength:typeof payload?.message === 'string' ? payload.message.length : 0,twilioConfigured:Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN),twilioSmsFromConfigured:Boolean(TWILIO_SMS_FROM),twilioWhatsappFromConfigured:Boolean(TWILIO_WHATSAPP_FROM)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const channel = payload.channel;
  const message = payload.message;
  if (!channel || !message) {
    throw new Error("Channel and message are required.");
  }

  let to = payload.to || "";
  let from = payload.from || "";

  if (channel === "whatsapp") {
    to = normalizeWhatsapp(to);
    from = normalizeWhatsapp(from || TWILIO_WHATSAPP_FROM);
  } else {
    to = normalizeSms(to);
    from = normalizeSms(from || TWILIO_SMS_FROM);
  }

  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/0b66ba84-1f65-45ec-99ab-fa5a1865714d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-sim',hypothesisId:'H2',location:'server.js:171',message:'sendMessage normalized',data:{channel,hasTo:Boolean(to),hasFrom:Boolean(from),toLength:to.length,fromLength:from.length,toHasWhatsappPrefix:to.startsWith('whatsapp:'),fromHasWhatsappPrefix:from.startsWith('whatsapp:')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!to) {
    throw new Error("Destination number is required.");
  }
  if (!from) {
    throw new Error("Sender number is required (from).");
  }

  const twilioPayload = {
    To: to,
    From: from,
    Body: message
  };

  const result = await twilioRequest(twilioPayload);
  return {
    provider: "twilio",
    result
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    jsonResponse(res, 200, { ok: true, service: "gateway" });
    return;
  }

  if (req.method !== "POST" || req.url !== "/send") {
    jsonResponse(res, 404, { ok: false, error: "Not found." });
    return;
  }

  if (!isAuthorized(req)) {
    jsonResponse(res, 401, { ok: false, error: "Unauthorized." });
    return;
  }

  try {
    const payload = await readJson(req);
    const { channel, to, message } = payload;

    if (!channel || !to || !message) {
      jsonResponse(res, 400, {
        ok: false,
        error: "channel, to, and message are required."
      });
      return;
    }

    const response = await sendMessage(payload);
    jsonResponse(res, 200, { ok: true, response });
  } catch (error) {
    jsonResponse(res, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`[gateway] Listening on http://localhost:${PORT}`);
});
