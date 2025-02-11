import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import redis from "./redisClient.js"; // Redis Client

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "./.temp");

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

let rooms = {}; // In-memory storage for real-time collaboration

console.log(rooms);

// 🔹 Get List of Available Rooms from Redis
app.get("/rooms/list", async (req, res) => {
  const keys = await redis.keys("room:*");
  const roomList = await Promise.all(
    keys.map(async (key) => {
      const room = await redis.hgetall(key);
      return { roomId: key.replace("room:", ""), ...room };
    })
  );

  res.json(roomList);
});

// API Endpoint to manually save code
app.post("/rooms/save", async (req, res) => {
  const { roomId, code } = req.body;

  if (!roomId || !code || code=="") {
    return res.status(400).json({ error: "Room ID and code are required" });
  }

  try {
    // Save code in Redis
    await redis.hset(`room:${roomId}`, { code });
    return res.json({ success: true, message: "Code saved successfully" });
  } catch (error) {
    console.error("❌ Error saving code:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 🔹 WebSocket Logic for Real-time Collaboration
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  // ({ roomId, error })
  socket.on("createRoom", async ({ password }, callback) => {
    if (!password) callback({ error: "Password required" });
    const roomId = crypto.randomBytes(4).toString("hex");
    let start = Date.now();
    console.log(Date.now() - start);
    socket.join(roomId);
    rooms[roomId] = {
      password,
      users: [socket.id],
      code: "// Start coding...",
      output: "No output",
    };
    callback({ roomId });
    await redis.hset(`room:${roomId}`, {
      password,
      code: "// Start coding...",
      createdAt: Date.now(),
    });
    await redis.expire(`room:${roomId}`, 86400); // Auto-delete after 24 hours
  });

  socket.on("joinRoom", async ({ roomId, password }, callback) => {
    console.log(rooms);
    let roomData = rooms[roomId];
    if (roomData === undefined)
      roomData = await redis.hgetall(`room:${roomId}`);
    console.log(roomData);
    if (!roomData) return callback({ error: "Room not found" });
    if (String(roomData.password) !== password)
      return callback({ error: "Incorrect password" });

    console.log(`🔗 User ${socket.id} joining room: ${roomId}`);
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = { ...roomData, users: [] };
    if (!rooms[roomId].users.includes(socket.id))
      rooms[roomId].users.push(socket.id);

    console.log("🛠️ Room state after join:", rooms[roomId]);

    socket.emit("codeUpdate", rooms[roomId].code);
    console.log(rooms[roomId].code);
    socket.emit("outputUpdate", rooms[roomId].output);
    callback({ success: true, code: rooms[roomId].code });
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms[roomId]) {
      rooms[roomId].code = code;
      socket.to(roomId).emit("codeUpdate", code);
    }
  });

  socket.on("codeRun", ({ roomId, language, code }) => {
    io.to(roomId).emit("runningUpdate", true);
    console.log(`Executing code for room: ${roomId} using Docker`);

    const uniqueID = Date.now();
    const extension = language === "python" ? "py" : "js";
    const tempFile = path.join(tempDir, `script_${uniqueID}.${extension}`);

    fs.writeFileSync(tempFile, code);

    let dockerCommand;
    if (language === "javascript") {
      dockerCommand = `docker run --rm -v ${tempFile}:/app/script.js node node /app/script.js`;
    } else if (language === "python") {
      dockerCommand = `docker run --rm -v ${tempFile}:/app/script.py python python3 /app/script.py`;
    } else {
      return io.to(roomId).emit("outputUpdate", "Unsupported language");
    }

    exec(dockerCommand, (error, stdout, stderr) => {
      const output = error ? stderr : stdout || "No Output";
      rooms[roomId].output = output;
      console.log(`Execution done for room: ${roomId}`);

      io.to(roomId).emit("outputUpdate", output);
      io.to(roomId).emit("runningUpdate", false);

      setTimeout(() => fs.unlink(tempFile, (err) => {}), 5000);
    });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.id} disconnected`);

    for (const roomId in rooms) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (user) => user !== socket.id
      );
      if (rooms[roomId].users.length === 0) delete rooms[roomId];
    }
  });
});

// 🔹 Auto-save Code to Redis Every 2 Minutes
setInterval(async () => {
  for (const [roomId, roomData] of Object.entries(rooms)) {
    await redis.hset(`room:${roomId}`, { code: roomData.code });
    console.log(`💾 Auto-saved code for Room: ${roomId}`);
  }
}, 60000 * 10); // Saves every 10 minutes

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
