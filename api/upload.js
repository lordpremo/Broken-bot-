import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  const form = Object.fromEntries(new URLSearchParams(body));
  let name = (form.name || "").toLowerCase().trim();
  const html = form.html || "";

  name = name.replace(/[^a-z0-9\-]/g, "-");

  if (!name || !html) {
    return res.status(400).json({ error: "Weka jina na HTML" });
  }

  const siteDir = path.join(process.cwd(), "sites", name);

  if (!fs.existsSync(siteDir)) {
    fs.mkdirSync(siteDir, { recursive: true });
  }

  fs.writeFileSync(path.join(siteDir, "index.html"), html);

  const url = `https://${req.headers.host}/sites/${name}/`;

  res.status(200).json({ url });
}
