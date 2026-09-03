import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

const distDir = path.join(process.cwd(), "dist");
const publicDir = path.join(process.cwd(), "public");

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}
app.use(express.static(path.join(process.cwd())));

app.get("*", (req, res) => {
  const indexInDist = path.join(distDir, "index.html");
  if (fs.existsSync(indexInDist)) {
    res.sendFile(indexInDist);
  } else {
    res.sendFile(path.join(process.cwd(), "index.html"));
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Color Library server running on http://0.0.0.0:${PORT}`);
});
