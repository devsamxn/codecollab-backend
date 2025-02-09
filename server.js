const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const tempDir = path.join(__dirname, ".temp"); // Create a temp directory
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

app.post("/run", (req, res) => {
  const { language, code } = req.body;
  const uniqueID = crypto.randomBytes(4).toString("hex");

  let fileExtension = language === "python" ? "py" : "js";
  const tempFile = path.join(tempDir, `script_${uniqueID}.${fileExtension}`);

  fs.writeFileSync(tempFile, code); // Save user code to temp file

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

    if (error) {
      console.log("❌ Error:", stderr);
      return res.json({ output: stderr });
    }

    res.json({ output: stdout || "No output" });

    // Delete the temp file after execution
    setTimeout(() => {
      fs.unlink(tempFile, (err) => {
        if (err) console.error("Error deleting temp file:", err);
      });
    }, 5000);
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
