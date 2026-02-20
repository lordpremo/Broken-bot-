import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: "Missing name" });
  }

  const siteDir = path.join(process.cwd(), "sites", name);

  if (fs.existsSync(siteDir)) {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }

  res.json({ deleted: name });
}
