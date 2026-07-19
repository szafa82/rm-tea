import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 8080;
const distPath = path.join(__dirname, "dist");

app.use("/assets", express.static(path.join(distPath, "assets"), {
  immutable: true,
  maxAge: "1y"
}));

app.use(express.static(distPath, {
  index: false,
  etag: true,
  maxAge: 0
}));

app.get("*", (req, res) => {
  if (req.path.startsWith("/assets/")) return res.status(404).send("Asset not found");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  return res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`RM Tea Club V9 running on port ${port}`);
});
