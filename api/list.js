import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const sitesDir = path.join(process.cwd(), "sites");

  if (!fs.existsSync(sitesDir)) {
    return res.json({ sites: [] });
  }

  const sites = fs
    .readdirSync(sitesDir)
    .filter(f => fs.statSync(path.join(sitesDir, f)).isDirectory());

  res.json({ sites });
}
