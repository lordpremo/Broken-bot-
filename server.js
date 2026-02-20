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
    if (connection === "open") console.log("🤖 BROKEN LORD BOT CONNECTED");
    if (connection === "close") {
      console.log("⚠️ Connection closed. Restarting...");
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

      // ========== MENU ==========
      if (cmd === "menu") {
        return sock.sendMessage(jid, {
          text:
            `🐍 *BROKEN LORD BOT*\n\n` +
            `🧾 GENERAL:\n.menu\n.owner\n\n` +
            `🎵 MEDIA & AI:\n.yt\n.ytsearch\n.mp3\n.ai\n.suno\n.logo\n.math\n.img2prompt\n.creart\n.quote\n.anime\n.pinterest\n.tiktok\n.weather\n\n` +
            `💳 TOOLS:\n.vcc\n.bin\n\n` +
            `👥 GROUP (ADMIN):\n.tagall\n.hidetag\n.kickall\n.kick\n.add\n.promote\n.demote\n.lock\n.unlock\n.ginfo\n.setname\n.setdesc\n`
        });
      }

      if (cmd === "owner") {
        return sock.sendMessage(jid, {
          text: "👑 BROKEN LORD BOT\nOwner: LORD PREMO"
        });
      }

      // ========== GROUP COMMANDS ==========
      if (cmd === "tagall") {
        if (!isGroup || !(await isUserAdmin())) return;
        const meta = await sock.groupMetadata(jid);
        const members = meta.participants;
        return sock.sendMessage(jid, {
          text: members.map((m) => `@${m.id.split("@")[0]}`).join("\n"),
          mentions: members.map((m) => m.id)
        });
      }

      if (cmd === "hidetag") {
        if (!isGroup || !(await isUserAdmin())) return;
        const meta = await sock.groupMetadata(jid);
        const members = meta.participants;
        return sock.sendMessage(jid, {
          text: arg || "Hidetag message",
          mentions: members.map((m) => m.id)
        });
      }

      if (cmd === "kickall") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        const meta = await sock.groupMetadata(jid);
        const members = meta.participants.filter((m) => !m.admin);
        if (!members.length)
          return sock.sendMessage(jid, { text: "Hakuna member wa kawaida." });
        await sock.groupParticipantsUpdate(
          jid,
          members.map((m) => m.id),
          "remove"
        );
        return sock.sendMessage(jid, { text: "Done." });
      }

      if (cmd === "kick") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mention) return;
        await sock.groupParticipantsUpdate(jid, mention, "remove");
        return sock.sendMessage(jid, { text: "User removed." });
      }

      if (cmd === "add") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        if (!arg) return;
        await sock.groupParticipantsUpdate(jid, [`${arg}@s.whatsapp.net`], "add");
        return sock.sendMessage(jid, { text: "User added." });
      }

      if (cmd === "promote") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mention) return;
        await sock.groupParticipantsUpdate(jid, mention, "promote");
        return sock.sendMessage(jid, { text: "Promoted." });
      }

      if (cmd === "demote") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        const mention = m.message.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mention) return;
        await sock.groupParticipantsUpdate(jid, mention, "demote");
        return sock.sendMessage(jid, { text: "Demoted." });
      }

      if (cmd === "lock") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        await sock.groupSettingUpdate(jid, "announcement");
        return sock.sendMessage(jid, { text: "Group locked." });
      }

      if (cmd === "unlock") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        await sock.groupSettingUpdate(jid, "not_announcement");
        return sock.sendMessage(jid, { text: "Group unlocked." });
      }

      if (cmd === "ginfo") {
        if (!isGroup) return;
        const meta = await sock.groupMetadata(jid);
        return sock.sendMessage(jid, {
          text:
            `📌 *GROUP INFO*\n\n` +
            `Name: ${meta.subject}\n` +
            `Members: ${meta.participants.length}\n` +
            `ID: ${jid}\n`
        });
      }

      if (cmd === "setname") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        if (!arg) return;
        await sock.groupUpdateSubject(jid, arg);
        return sock.sendMessage(jid, { text: "Group name updated." });
      }

      if (cmd === "setdesc") {
        if (!isGroup || !(await isUserAdmin()) || !(await isBotAdmin())) return;
        if (!arg) return;
        await sock.groupUpdateDescription(jid, arg);
        return sock.sendMessage(jid, { text: "Group description updated." });
      }

      // ========== MEDIA & AI & TOOLS ==========
      if (cmd === "ai") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/ai/turbochat?text=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, { text: r.data.result || "No response" });
      }

      if (cmd === "yt") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/downloader/ytplay?q=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, {
          image: { url: r.data.thumbnail },
          caption: `${r.data.title}\n${r.data.url}`
        });
      }

      if (cmd === "ytsearch") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/search/youtube?q=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, {
          text: JSON.stringify(r.data, null, 2)
        });
      }

      if (cmd === "mp3") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/downloader/v1/ytmp3?url=${encodeURIComponent(
            arg
          )}`
        );
        return sock.sendMessage(jid, {
          audio: { url: r.data.download_url },
          mimetype: "audio/mpeg"
        });
      }

      if (cmd === "logo") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/ai/sologo?prompt=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, {
          image: { url: r.data.url },
          caption: "Logo generated ✔"
        });
      }

      if (cmd === "math") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/ai/mathgpt?text=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, { text: r.data.answer || "No answer" });
      }

      if (cmd === "img2prompt") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/ai/image2prompt?url=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, { text: r.data.prompt || "No prompt" });
      }

      if (cmd === "creart") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/ai/creart?prompt=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, {
          image: { url: r.data.url },
          caption: "Image generated ✔"
        });
      }

      if (cmd === "suno") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/ai/suno?prompt=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, {
          audio: { url: r.data.audio_url },
          mimetype: "audio/mpeg"
        });
      }

      if (cmd === "vcc") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/tools/vcc?type=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, { text: JSON.stringify(r.data, null, 2) });
      }

      if (cmd === "bin") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/tools/bin?bin=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, { text: JSON.stringify(r.data, null, 2) });
      }

      if (cmd === "quote") {
        const r = await axios.get(`https://api.nexray.web.id/tools/quote`);
        return sock.sendMessage(jid, { text: r.data.quote || "No quote" });
      }

      if (cmd === "anime") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/search/anime?q=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, { text: JSON.stringify(r.data, null, 2) });
      }

      if (cmd === "pinterest") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/search/pinterest?q=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, {
          image: { url: r.data.result?.[0] || r.data.result },
          caption: "Pinterest result"
        });
      }

      if (cmd === "tiktok") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/downloader/tiktok?url=${encodeURIComponent(
            arg
          )}`
        );
        return sock.sendMessage(jid, {
          video: { url: r.data.video },
          mimetype: "video/mp4"
        });
      }

      if (cmd === "weather") {
        if (!arg) return;
        const r = await axios.get(
          `https://api.nexray.web.id/tools/weather?city=${encodeURIComponent(arg)}`
        );
        return sock.sendMessage(jid, { text: JSON.stringify(r.data, null, 2) });
      }
    } catch (err) {
      console.log("ERROR:", err);
    }
  });
}

startBot();
app.listen(3000, () => console.log("🔥 BROKEN LORD BACKEND RUNNING ON 3000"));
