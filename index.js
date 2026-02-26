// index.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const {
  handleMessages,
  handleGroupParticipantUpdate,
  handleStatus,
} = require("./main");
const config = require("./config");

// PHONE NUMBER KWA PAIRING CODE
// Railway env: PHONE_NUMBER=2557xxxxxxx
const phoneNumber = process.env.PHONE_NUMBER || "255773002107";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: [config.botName, "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  if (!sock.authState.creds.registered && phoneNumber) {
    try {
      const num = phoneNumber.replace(/[^0-9]/g, "");
      console.log("📞 Pairing number:", num);
      let code = await sock.requestPairingCode(num);
      if (code) {
        code = code.match(/.{1,4}/g)?.join("-") || code;
        console.log("🔐 Your Pairing Code:");
        console.log("================================");
        console.log("   " + code);
        console.log("================================");
        console.log(
          "\n👉 Fungua WhatsApp > Settings > Linked Devices > Link a Device > Ingiza hii code."
        );
      }
    } catch (e) {
      console.error("Error requesting pairing code:", e);
    }
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("🤖 BROKEN LORD MD Connected as:", sock.user.id);
    }

    if (connection === "close") {
      const reason =
        lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error;
      console.log("Connection closed:", reason);
      if (reason === DisconnectReason.loggedOut || reason === 401) {
        console.log("Session imefutwa. Futa folder 'session' upya upair.");
      } else {
        console.log("Reconnecting...");
        startBot();
      }
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    await handleMessages(sock, m);
  });

  sock.ev.on("group-participants.update", async (u) => {
    await handleGroupParticipantUpdate(sock, u);
  });

  sock.ev.on("status.update", async (s) => {
    await handleStatus(sock, s);
  });
}

startBot().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
