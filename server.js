import express from "express";
import cors from "cors";
import axios from "axios";
import pino from "pino";
import * as baileys from "@whiskeysockets/baileys";

// UNIVERSAL IMPORT (WORKS ON BAILEYS 6.x)
const makeWASocket = baileys.default;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
const jidNormalizedUser = baileys.jidNormalizedUser;

const app = express();
app.use(cors());
app.use(express.json());

let sock;
const PREFIX = ".";

// ===============================
// API: GENERATE PAIRING CODE
// ===============================
app.post("/pair", async (req, res) => {
  const { number } = req.body;

  if (!number || !number.startsWith("255")) {
    return res.json({ status: false, message: "Namba lazima ianze na 255" });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");
    const { version } = await fetchLatestBaileysVersion();

    const s = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" })
    });

    const code = await s.requestPairingCode(number);

    res.json({
      status: true,
      code
    });

    s.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.log("PAIR ERROR:", err);
    res.json({
      status: false,
      message: "Pairing code imekataa. Jaribu tena."
    });
  }
});

// ===============================
// BOT ENGINE
// ===============================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") console.log("BROKEN LORD BOT CONNECTED");
    if (connection === "close") {
      console.log("Connection closed. Restarting...");
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (msg) => {
    try {
      const m = msg.messages[0];
      if (!m?.message) return;

      const jid = m.key.remoteJid;
      const isGroup = jid.endsWith("@g.us");
      const sender = jidNormalizedUser(
        m.key.fromMe ? sock.user.id : m.key.participant || m.key.remoteJid
      );

      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.imageMessage?.caption ||
        "";

      if (!text.startsWith(PREFIX)) return;

      const body = text.slice(PREFIX.length).trim();
      const [cmdRaw, ...rest] = body.split(" ");
      const cmd = cmdRaw.toLowerCase();
      const arg = rest.join(" ").trim();

      const isBotAdmin = async () => {
        if (!isGroup) return false;
        const meta = await sock.groupMetadata(jid);
        const me = jidNormalizedUser(sock.user.id);
        return meta.participants.some((p) => p.admin && p.id === me);
      };

      const isUserAdmin = async () => {
        if (!isGroup) return false;
        const meta = await sock.groupMetadata(jid);
        return meta.participants.some((p) => p.admin && p.id === sender);
      };

      if (cmd === "menu") {
        return sock.sendMessage(jid, {
          text: "BROKEN LORD BOT\n\nCommands:\n.menu\n.owner\n.tagall\n.hidetag\n.kick\n.add\n.promote\n.demote\n.lock\n.unlock\n"
        });
      }

      if (cmd === "owner") {
        return sock.sendMessage(jid, { text: "Owner: LORD PREMO" });
      }

      if (cmd === "tagall") {
        if (!isGroup || !(await isUserAdmin())) return;
        const meta = await sock.groupMetadata(jid);
        const members = meta.participants;
        return sock.sendMessage(jid, {
          text: members.map((m) => `@${m.id.split("@")[0]}`).join("\n"),
          mentions: members.map((m) => m.id)
        });
      }

    } catch (err) {
      console.log("ERROR:", err);
    }
  });
}

startBot();
app.listen(3000, () => console.log("BROKEN LORD BACKEND RUNNING ON 3000"));
