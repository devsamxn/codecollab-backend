import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "./.temp");

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// In-memory store for real-time collaboration
let rooms = {};
console.log(rooms);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createRoom", ({ password }, callback) => {
    const roomId = crypto.randomBytes(4).toString("hex");
    console.log(roomId, password);
    rooms[roomId] = {
      password,
      users: [socket.id],
      code: "// Start coding...",
      output: "",
    };
    console.log(rooms);
    socket.join(roomId);
    callback({ roomId });
  });

  socket.on("joinRoom", ({ roomId, password }, callback) => {
    if (!rooms[roomId]) {
      return callback({ error: "Room not found" });
    }

    if (rooms[roomId].password !== password) {
      return callback({ error: "Incorrect password" });
    }

    console.log(`🔗 User ${socket.id} joining room: ${roomId}`);
    socket.join(roomId);
    console.log(
      `users inside the room ${roomId}:`,
      io.sockets.adapter.rooms.get(roomId)
    );
    // Ensure user is not already in the room
    if (!rooms[roomId].users.includes(socket.id)) {
      rooms[roomId].users.push(socket.id);
    }

    console.log("🛠️ Room state after join:", rooms[roomId]);

    // Send the latest code and output **only to the user who joined**
    socket.emit("codeUpdate", rooms[roomId].code);
    socket.emit("outputUpdate", rooms[roomId].output);

    callback({ success: true });
  });

  const getUsersInRoom = (roomId) => {
    const users = io.sockets.adapter.rooms.get(roomId);
    return users ? [...users] : [];
  };

  socket.on("codeChange", ({ roomId, code }) => {
    console.log(`👥 Users in Room ${roomId}:`, getUsersInRoom(roomId));

    console.log(
      `📥 Received "codeChange" from ${socket.id} in Room: ${roomId}`
    );

    if (rooms[roomId]) {
      rooms[roomId].code = code;

      console.log(`📤 Sending "codeUpdate" to Room: ${roomId}`);
      io.to(roomId).emit("codeUpdate", code);
    } else {
      console.error(`❌ Room ${roomId} not found!`);
    }
  });
  socket.on("codeRun", ({ roomId, language, code }) => {
    io.to(roomId).emit("runningUpdate", true);
    console.log(`Executing code for room: ${roomId}`);

    const uniqueID = Date.now();
    const extension = language === "python" ? "py" : "js";
    const tempFile = path.join(tempDir, `script_${uniqueID}.${extension}`);

    fs.writeFileSync(tempFile, code);

    const command =
      language === "javascript" ? `node ${tempFile}` : `python3 ${tempFile}`;

    exec(command, (error, stdout, stderr) => {
      const output = error ? stderr : stdout || "No Output";
      rooms[roomId].output = output;
      console.log("output: ", output);
      console.log(`Execution done for room: ${roomId}`);

      io.to(roomId).emit("outputUpdate", output);
      io.to(roomId).emit("runningUpdate", false);
      console.log(`Output update emitted: ${roomId}`);

      setTimeout(() => fs.unlink(tempFile, (err) => {}), 5000);
    });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.id} disconnected`);

    for (const roomId in rooms) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (user) => user !== socket.id
      );

      if (rooms[roomId].users.length === 0) {
        console.log(`Deleting empty room: ${roomId}`);
        delete rooms[roomId];
      }
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
