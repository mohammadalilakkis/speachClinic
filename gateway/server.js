const http = require("http");
const fs = require("fs");
const path = require("path");
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

const META_WHATSAPP_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
const META_WHATSAPP_ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN || "";

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

/** For WhatsApp Cloud API: digits only, no + (e.g. 9611234567). */
function toWhatsappCloudTo(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  return digits;
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

const META_GRAPH_VERSION = "v21.0";

async function whatsappCloudRequest(phoneNumberId, accessToken, to, text) {
  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp Cloud API credentials are not configured (META_WHATSAPP_PHONE_NUMBER_ID, META_WHATSAPP_ACCESS_TOKEN).");
  }
  const recipient = toWhatsappCloudTo(to);
  if (!recipient) {
    throw new Error("Destination number is required for WhatsApp.");
  }
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: { body: text }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const responseData = await response.json().catch(() => ({}));
  const ok = response.ok;
  if (ok) {
    return { statusCode: response.status, data: responseData };
  }
  const errMsg = responseData?.error?.message || responseData?.error?.error_user_msg || JSON.stringify(responseData) || "Unknown error";
  throw new Error(`WhatsApp Cloud API failed (${response.status}): ${errMsg}`);
}

async function sendMessage(payload) {
  const channel = payload.channel;
  const message = payload.message;
  if (!channel || !message) {
    throw new Error("Channel and message are required.");
  }

  const to = (payload.to || "").trim();
  if (!to) {
    throw new Error("Destination number is required.");
  }

  if (channel !== "whatsapp") {
    throw new Error("Only WhatsApp is supported. Set channel to \"whatsapp\".");
  }

  const result = await whatsappCloudRequest(
    META_WHATSAPP_PHONE_NUMBER_ID,
    META_WHATSAPP_ACCESS_TOKEN,
    to,
    message
  );
  return { provider: "whatsapp_cloud_api", result };
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
