import express from "express";
import crypto from "crypto";

const router = express.Router();
let rooms = {}; // Temporary in-memory storage

// Create Room
router.post("/create", (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });

  const roomId = crypto.randomBytes(4).toString("hex");
  rooms[roomId] = { password, users: [], code: "// Start coding..." };
  return res.json({ roomId });
});

// Join Room (Now Tracks Users)
router.post("/join", (req, res) => {
  const { roomId, password } = req.body;

  if (!rooms[roomId]) return res.status(404).json({ error: "Room not found" });
  if (rooms[roomId].password !== password)
    return res.status(401).json({ error: "Incorrect password" });

  // Add user to room if not already in
  // if (!rooms[roomId].users.includes(username)) {
  //   rooms[roomId].users.push(username);
  // }

  return res.json({ success: true, roomId, users: rooms[roomId].users });
});

export default router;
