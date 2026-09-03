import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

const distDir = path.join(process.cwd(), "dist");
const publicDir = path.join(process.cwd(), "public");

const cleanRoutes: Record<string, string> = {
  "/privacy-policy": "privacy-policy/index.html",
  "/terms-of-service": "terms-of-service/index.html",
  "/contact": "contact/index.html",
  "/about": "about/index.html",
  "/color-mix": "color-mix/index.html"
};

for (const [routePath, relativeFilePath] of Object.entries(cleanRoutes)) {
  app.get([routePath, `${routePath}/`], (_req, res) => {
    const inDist = path.join(distDir, relativeFilePath);
    if (fs.existsSync(inDist)) {
      return res.sendFile(inDist);
    }
    const inRoot = path.join(process.cwd(), relativeFilePath);
    if (fs.existsSync(inRoot)) {
      return res.sendFile(inRoot);
    }
    const fallback = path.join(distDir, "index.html");
    res.sendFile(fs.existsSync(fallback) ? fallback : path.join(process.cwd(), "index.html"));
  });
}

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use("/public", express.static(publicDir));
}
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  const distPublic = path.join(distDir, "public");
  if (fs.existsSync(distPublic)) {
    app.use("/public", express.static(distPublic));
  }
}
app.use(express.static(path.join(process.cwd()), { redirect: false }));

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
