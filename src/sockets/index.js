const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    socket.emit("socket:connected", {
      socketId: socket.id,
      at: new Date().toISOString()
    });

    socket.on("member:join", (memberId) => {
      if (!memberId) {
        return;
      }

      socket.join(`member:${memberId}`);
    });

    socket.on("ping", () => {
      socket.emit("pong", { at: new Date().toISOString() });
    });

    socket.on("disconnect", () => {
      // Place for future cleanup logic per member room.
    });
  });
};

module.exports = {
  registerSocketHandlers
};
