import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import codeRoutes from "./routes/code.js";
import roomRoutes from "./routes/rooms.js";

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

// API Routes
app.use("/code", codeRoutes);
app.use("/rooms", roomRoutes);

// In-memory store for real-time collaboration
let roomCodeState = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("joinRoom", ({ roomId }) => {
    console.log(`User ${socket.id} joined room ${roomId}`);

    // Ensure the socket joins the correct room
    socket.join(roomId);

    // Send current code state to new user
    if (roomCodeState[roomId]) {
      socket.emit("codeUpdate", roomCodeState[roomId]);
    }
  });

  socket.on("codeChange", ({ roomId, code }) => {
    roomCodeState[roomId] = code;

    // Broadcast changes only to users in the same room
    socket.to(roomId).emit("codeUpdate", code);
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
