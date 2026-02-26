// main.js
const axios = require("axios");
const FormData = require("form-data");
const {
  downloadContentFromMessage,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const config = require("./config");
const settings = require("./settings");

let badWords = [];

function getBody(msg) {
  const m = msg.message || {};
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage) return m.extendedTextMessage.text;
  if (m.imageMessage && m.imageMessage.caption) return m.imageMessage.caption;
  if (m.videoMessage && m.videoMessage.caption) return m.videoMessage.caption;
  return "";
}

async function reply(sock, msg, text) {
  return sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
}

async function downloadMedia(msg, type = "image") {
  const m = msg.message?.imageMessage
    ? msg.message.imageMessage
    : msg.message?.videoMessage
    ? msg.message.videoMessage
    : null;
  if (!m) return null;
  const stream = await downloadContentFromMessage(m, type);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

function isOwnerJid(jid) {
  return config.ownerNumber.some((n) =>
    jid.replace(/[^0-9]/g, "").includes(n.replace(/[^0-9]/g, ""))
  );
}

async function handleMessages(sock, upsert) {
  try {
    const msg = upsert.messages && upsert.messages[0];
    if (!msg || !msg.message) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const sender = jidNormalizedUser(
      msg.key.fromMe ? sock.user.id : msg.key.participant || msg.key.remoteJid
    );

    let body = getBody(msg);
    const prefix = settings.prefix || ".";
    if (!body.startsWith(prefix)) return;

    const args = body.slice(prefix.length).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();
    const text = args.join(" ");

    const isOwner = isOwnerJid(sender);

    if (settings.mode === "private" && !isOwner) return;

    if (badWords.length) {
      for (const w of badWords) {
        if (body.toLowerCase().includes(w.toLowerCase())) {
          await reply(sock, msg, "⚠️ Neno lisiloruhusiwa limetumika.");
          break;
        }
      }
    }

    // BASIC
    if (command === "alive") {
      return reply(
        sock,
        msg,
        `🌺 BROKEN LORD MD is alive!\n👑 Owner: ${config.ownerName}\n📞 wa.me/${config.ownerNumber[0]}`
      );
    }

    if (command === "ping") {
      const start = Date.now();
      await reply(sock, msg, "🏓 Pinging...");
      const ms = Date.now() - start;
      return reply(sock, msg, `🏓 Pong! ${ms}ms`);
    }

    if (command === "info") {
      return reply(
        sock,
        msg,
        `🤖 *${config.botName}*\n👑 Owner: ${config.ownerName}\n📞 wa.me/${config.ownerNumber[0]}\n⚙️ Mode: ${settings.mode.toUpperCase()}\n🔣 Prefix: ${prefix}`
      );
    }

    // MENU
    if (command === "menu" || command === "help") {
      const menuText =
        "🌺🌺🌺 *🌺 BROKEN LORD MD 🌺* 🌺🌺🌺\n" +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        `🌸 ʜᴇʟʟᴏ @${(sender || "").split("@")[0]}\n` +
        `🌼 ᴏᴡɴᴇʀ : 💠 ${config.ownerName} 💠\n` +
        `🌷 ᴘʀᴇғɪx : [ ${prefix} ]\n` +
        `🌻 ᴍᴏᴅᴇ : ${settings.mode.toUpperCase()}\n` +
        "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
        "🌺 *AI MENU* 🌺\n" +
        "✨ .gpt <text>\n" +
        "✨ .turbochat <text>\n" +
        "✨ .mathgpt <question>\n" +
        "✨ .suno <prompt>\n" +
        "✨ .sologo <prompt>\n" +
        "✨ .image2prompt <image url>\n" +
        "✨ .creart <prompt>\n" +
        "✨ .gptimage <image + param>\n" +
        "✨ .creartimage <image + param>\n\n" +
        "🌸 *DOWNLOADER MENU* 🌸\n" +
        "🎵 .ytplay <song>\n\n" +
        "🌼 *TOOLS MENU* 🌼\n" +
        "💳 .vcc visa\n" +
        "💳 .vcc mastercard\n" +
        "💳 .vcc amex\n\n" +
        "🌺 *GROUP MENU (MUHIMU)* 🌺\n" +
        ".tagall <text>\n" +
        ".hidetag <text>\n" +
        ".kick @tag\n" +
        ".add 2557xxxx\n" +
        ".promote @tag\n" +
        ".demote @tag\n" +
        ".link\n\n" +
        "🌸 *OWNER MENU* 🌸\n" +
        ".owner\n" +
        ".mode public\n" +
        ".mode private\n" +
        ".restart\n" +
        ".broadcast <text>\n\n" +
        "🌼 *SETTINGS MENU* 🌼\n" +
        ".setprefix <char>\n" +
        ".addbadword <word>\n" +
        ".delbadword <word>\n" +
        ".listbadword\n\n" +
        "🌿 *EXTRA* 🌿\n" +
        ".alive\n" +
        ".ping\n" +
        ".info\n" +
        ".sticker (reply image/video)\n\n" +
        "━━━━━━━━━━━━━━━━━━━━━━\n" +
        "🌺 *Power by BROKEN LORD* 🌺\n" +
        "━━━━━━━━━━━━━━━━━━━━━━";

      await sock.sendMessage(
        from,
        {
          image: {
            url: "https://upcdn.io/kW2K8mM/raw/uploads/2026/02/17/4j9r7q8N7G-5c9c8c2f-632f-4d7d-b783-9480ad265013.png",
          },
          caption: menuText,
          mentions: [sender],
        },
        { quoted: msg }
      );
      return;
    }

    // AI & DOWNLOADER & TOOLS
    if (command === "gpt" || command === "turbochat") {
      if (!text) return reply(sock, msg, "✏️ Andika ujumbe: .gpt hi");
      const url =
        "https://api.nexray.web.id/ai/turbochat?text=" +
        encodeURIComponent(text);
      const { data } = await axios.get(url);
      const out = data.result || data.response || JSON.stringify(data);
      return reply(sock, msg, out);
    }

    if (command === "mathgpt") {
      if (!text) return reply(sock, msg, "✏️ Andika swali: .mathgpt 2+2");
      const url =
        "https://api.nexray.web.id/ai/mathgpt?text=" +
        encodeURIComponent(text);
      const { data } = await axios.get(url);
      const out = data.result || data.answer || JSON.stringify(data);
      return reply(sock, msg, out);
    }

    if (command === "suno") {
      if (!text) return reply(sock, msg, "✏️ Andika prompt: .suno love");
      const url =
        "https://api.nexray.web.id/ai/suno?prompt=" +
        encodeURIComponent(text);
      const { data } = await axios.get(url);
      const out = data.result || data.url || JSON.stringify(data);
      return reply(sock, msg, "🎵 Suno:\n" + out);
    }

    if (command === "sologo") {
      if (!text) return reply(sock, msg, "✏️ Andika prompt: .sologo spider");
      const url =
        "https://api.nexray.web.id/ai/sologo?prompt=" +
        encodeURIComponent(text);
      const { data } = await axios.get(url);
      const out = data.result || data.url || JSON.stringify(data);
      return reply(sock, msg, "🎨 Logo:\n" + out);
    }

    if (command === "image2prompt") {
      if (!text)
        return reply(
          sock,
          msg,
          "✏️ Weka image URL: .image2prompt https://..."
        );
      const url =
        "https://api.nexray.web.id/ai/image2prompt?url=" +
        encodeURIComponent(text);
      const { data } = await axios.get(url);
      const out = data.result || data.prompt || JSON.stringify(data);
      return reply(sock, msg, out);
    }

    if (command === "creart") {
      if (!text)
        return reply(sock, msg, "✏️ Andika prompt: .creart beautiful");
      const url =
        "https://api.nexray.web.id/ai/creart?prompt=" +
        encodeURIComponent(text);
      const { data } = await axios.get(url);
      const out = data.result || data.url || JSON.stringify(data);
      return reply(sock, msg, "🎨 CreArt:\n" + out);
    }

    if (command === "gptimage") {
      const param = text || "Change skin color";
      const buffer = await downloadMedia(msg, "image");
      if (!buffer)
        return reply(
          sock,
          msg,
          "📷 Tuma au reply kwenye picha ukitumia: .gptimage <param>"
        );
      const form = new FormData();
      form.append("image", buffer, { filename: "image.jpg" });
      form.append("param", param);
      const { data } = await axios.post(
        "https://api.nexray.web.id/ai/gptimage",
        form,
        { headers: form.getHeaders() }
      );
      const out = data.result || data.url || JSON.stringify(data);
      return reply(sock, msg, "🖼 GPT Image:\n" + out);
    }

    if (command === "creartimage") {
      const param = text || "Cartoon";
      const buffer = await downloadMedia(msg, "image");
      if (!buffer)
        return reply(
          sock,
          msg,
          "📷 Tuma au reply kwenye picha ukitumia: .creartimage <param>"
        );
      const form = new FormData();
      form.append("image", buffer, { filename: "image.jpg" });
      form.append("param", param);
      const { data } = await axios.post(
        "https://api.nexray.web.id/ai/creartimage",
        form,
        { headers: form.getHeaders() }
      );
      const out = data.result || data.url || JSON.stringify(data);
      return reply(sock, msg, "🎨 CreArt Image:\n" + out);
    }

    if (command === "ytplay") {
      if (!text) return reply(sock, msg, "✏️ Andika jina la wimbo: .ytplay Zuchu");
      const url =
        "https://api.nexray.web.id/downloader/ytplay?q=" +
        encodeURIComponent(text);
      const { data } = await axios.get(url);
      const audioUrl =
        data.result?.audio || data.result?.url || data.url || null;
      if (!audioUrl) {
        return reply(sock, msg, "❌ Imeshindikana kupata audio.\n" + JSON.stringify(data));
      }
      await sock.sendMessage(
        from,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
        },
        { quoted: msg }
      );
      return;
    }

    if (command === "vcc") {
      const type = (args[0] || "").toLowerCase();
      if (!["visa", "mastercard", "amex"].includes(type)) {
        return reply(sock, msg, "💳 Tumia: .vcc visa | .vcc mastercard | .vcc amex");
      }
      const url =
        "https://api.nexray.web.id/tools/vcc?type=" +
        encodeURIComponent(type);
      const { data } = await axios.get(url);
      const out = data.result || JSON.stringify(data);
      return reply(sock, msg, "💳 VCC (" + type.toUpperCase() + "):\n" + out);
    }

    // STICKER
    if (command === "sticker" || command === "s") {
      const buffer =
        (await downloadMedia(msg, "image")) ||
        (await downloadMedia(msg, "video"));
      if (!buffer)
        return reply(
          sock,
          msg,
          "📷 Tuma au reply kwenye picha/video ukitumia: .sticker"
        );
      await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
      return;
    }

    // GROUP
    if (["tagall", "hidetag", "kick", "add", "promote", "demote", "link"].includes(command)) {
      if (!isGroup) return reply(sock, msg, "❌ Hii command ni ya group tu.");
    }

    if (command === "tagall") {
      const meta = await sock.groupMetadata(from);
      const textTag = text || "TAGALL by BROKEN LORD MD";
      const mentions = meta.participants.map((p) => p.id);
      await sock.sendMessage(
        from,
        { text: textTag, mentions },
        { quoted: msg }
      );
      return;
    }

    if (command === "hidetag") {
      const meta = await sock.groupMetadata(from);
      const textTag = text || "HIDETAG by BROKEN LORD MD";
      const mentions = meta.participants.map((p) => p.id);
      await sock.sendMessage(
        from,
        { text: textTag, mentions },
        { quoted: msg }
      );
      return;
    }

    if (command === "kick") {
      const target =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!target) return reply(sock, msg, "🔨 Tag mtu: .kick @user");
      await sock.groupParticipantsUpdate(from, [target], "remove");
      return reply(sock, msg, "✅ Ameondolewa.");
    }

    if (command === "add") {
      if (!text) return reply(sock, msg, "➕ Andika namba: .add 2557xxxxxxx");
      const jid = text.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      await sock.groupParticipantsUpdate(from, [jid], "add");
      return reply(sock, msg, "✅ Ameongezwa (kama namba ipo WhatsApp).");
    }

    if (command === "promote") {
      const target =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!target) return reply(sock, msg, "⬆️ Tag mtu: .promote @user");
      await sock.groupParticipantsUpdate(from, [target], "promote");
      return reply(sock, msg, "✅ Amepewa admin.");
    }

    if (command === "demote") {
      const target =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!target) return reply(sock, msg, "⬇️ Tag mtu: .demote @user");
      await sock.groupParticipantsUpdate(from, [target], "demote");
      return reply(sock, msg, "✅ Ameondolewa admin.");
    }

    if (command === "link") {
      const code = await sock.groupInviteCode(from);
      return reply(
        sock,
        msg,
        "🔗 Group Link:\nhttps://chat.whatsapp.com/" + code
      );
    }

    // OWNER & SETTINGS
    if (command === "owner") {
      return reply(
        sock,
        msg,
        `👑 OWNER: ${config.ownerName}\n📞 Number: wa.me/${config.ownerNumber[0]}`
      );
    }

    if (command === "mode") {
      if (!isOwner) return reply(sock, msg, "❌ Hii ni ya OWNER tu.");
      const m = (args[0] || "").toLowerCase();
      if (!["public", "private"].includes(m)) {
        return reply(sock, msg, "⚙️ Tumia: .mode public au .mode private");
      }
      settings.mode = m;
      return reply(sock, msg, "✅ Mode imebadilishwa kuwa: " + m.toUpperCase());
    }

    if (command === "restart") {
      if (!isOwner) return reply(sock, msg, "❌ Hii ni ya OWNER tu.");
      await reply(sock, msg, "♻️ Restarting BROKEN LORD MD...");
      process.exit(1);
    }

    if (command === "setprefix") {
      if (!isOwner) return reply(sock, msg, "❌ Hii ni ya OWNER tu.");
      if (!text || text.length > 2)
        return reply(sock, msg, "✏️ Tumia: .setprefix !  (herufi 1 au 2)");
      settings.prefix = text;
      return reply(sock, msg, "✅ Prefix mpya: " + text);
    }

    if (command === "addbadword") {
      if (!isOwner) return reply(sock, msg, "❌ Hii ni ya OWNER tu.");
      if (!text) return reply(sock, msg, "✏️ Tumia: .addbadword neno");
      badWords.push(text);
      return reply(sock, msg, "✅ Neno limeongezwa.");
    }

    if (command === "delbadword") {
      if (!isOwner) return reply(sock, msg, "❌ Hii ni ya OWNER tu.");
      if (!text) return reply(sock, msg, "✏️ Tumia: .delbadword neno");
      badWords = badWords.filter(
        (w) => w.toLowerCase() !== text.toLowerCase()
      );
      return reply(sock, msg, "✅ Neno limeondolewa.");
    }

    if (command === "listbadword") {
      if (!badWords.length) return reply(sock, msg, "📃 Hakuna badword yoyote.");
      return reply(
        sock,
        msg,
        "📃 Badwords:\n" + badWords.map((w) => "• " + w).join("\n")
      );
    }

    if (command === "broadcast" || command === "bc") {
      if (!isOwner) return reply(sock, msg, "❌ Hii ni ya OWNER tu.");
      if (!text) return reply(sock, msg, "✏️ Tumia: .broadcast ujumbe");
      const chats = await sock.groupFetchAllParticipating().catch(() => ({}));
      const ids = Object.keys(chats);
      for (const id of ids) {
        await sock.sendMessage(id, { text: `📢 *BROADCAST*\n\n${text}` });
      }
      return reply(sock, msg, "✅ Broadcast imetumwa kwenye magroup yote.");
    }
  } catch (e) {
    console.error("Error in handleMessages:", e);
  }
}

async function handleGroupParticipantUpdate(sock, update) {}
async function handleStatus(sock, upsert) {}

module.exports = {
  handleMessages,
  handleGroupParticipantUpdate,
  handleStatus,
};
