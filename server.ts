import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

app.use(express.static(path.join(process.cwd())));

app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Color Library server running on http://0.0.0.0:${PORT}`);
});
