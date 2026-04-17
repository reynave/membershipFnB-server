const io = require('socket.io-client');

const testRedeemSocket = async () => {
  // Connect to socket server
  const socket = io('http://localhost:3200', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✓ Socket connected:', socket.id);
    
    // Join member:5 room
    socket.emit('member:join', 5);
    console.log('✓ Joined member:5 room');
  });

  socket.on('socket:connected', (data) => {
    console.log('Socket connected event:', data);
  });

  // Listen for redeem success
  socket.on('redeem:success', (data) => {
    console.log('\n✓ REDEEM SUCCESS EVENT:');
    console.log(JSON.stringify(data, null, 2));
  });

  // Listen for redeem failed
  socket.on('redeem:failed', (data) => {
    console.log('\n✗ REDEEM FAILED EVENT:');
    console.log(JSON.stringify(data, null, 2));
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    process.exit(0);
  });

  // Keep connection alive for 10 seconds
  setTimeout(() => {
    socket.disconnect();
  }, 10000);
};

testRedeemSocket();
