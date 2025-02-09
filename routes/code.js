import express from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import crypto from "crypto";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempDir = path.join(__dirname, "../.temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

router.post("/run", (req, res) => {
  const { language, code } = req.body;
  const uniqueID = crypto.randomBytes(4).toString("hex");

  let fileExtension = language === "python" ? "py" : "js";
  const tempFile = path.join(tempDir, `script_${uniqueID}.${fileExtension}`);

  fs.writeFileSync(tempFile, code);

  let dockerCommand;
  if (language === "javascript") {
    dockerCommand = `docker run --rm -v ${tempFile}:/app/script.js node node /app/script.js`;
  } else if (language === "python") {
    dockerCommand = `docker run --rm -v ${tempFile}:/app/script.py python python3 /app/script.py`;
  } else {
    return res.status(400).json({ output: "Unsupported language" });
  }
  console.log("🔹 Executing Docker command:", dockerCommand);
  exec(dockerCommand, (error, stdout, stderr) => {
    console.log("🔹 Docker execution completed!");

    if (error) return res.json({ output: stderr });

    res.json({ output: stdout || "No output" });

    setTimeout(() => fs.unlink(tempFile, (err) => {}), 5000);
  });
});

export default router;
