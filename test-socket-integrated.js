const io = require('socket.io-client');
const fetch = require('node-fetch');

const testRedeemWithSocket = async () => {
  return new Promise((resolve) => {
    // Connect to socket server
    const socket = io('http://localhost:3200', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    let receivedEvent = false;

    socket.on('connect', async () => {
      console.log('✓ Socket connected:', socket.id);
      
      // Join member:1 room to listen for redeem events
      socket.emit('member:join', 1);
      console.log('✓ Joined member:1 room\n');

      // Listen for redeem success
      socket.on('redeem:success', (data) => {
        receivedEvent = true;
        console.log('✓✓✓ REDEEM SUCCESS EVENT RECEIVED ✓✓✓');
        console.log(JSON.stringify(data, null, 2));
        cleanup();
      });

      // Listen for redeem failed
      socket.on('redeem:failed', (data) => {
        receivedEvent = true;
        console.log('✗✗✗ REDEEM FAILED EVENT RECEIVED ✗✗✗');
        console.log(JSON.stringify(data, null, 2));
        cleanup();
      });

      // Give a moment for socket to be ready, then trigger API
      setTimeout(() => {
        console.log('Triggering redeem API...\n');
        triggerRedeemAPI();
      }, 500);
    });

    const triggerRedeemAPI = async () => {
      try {
        const response = await fetch('http://localhost:3200/api/membership/redeem/redeem', {
          method: 'POST',
          headers: {
            'token': 'tokensimpan.database',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            redeemCode: 'LOW-POINT-CODE',
            amount: 10000,
            transactionId: 'SOCKET-TEST-TRX-001'
          })
        });

        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2), '\n');

        // Wait for socket event
        setTimeout(() => {
          if (!receivedEvent) {
            console.log('⚠️  No socket event received within timeout');
            cleanup();
          }
        }, 2000);
      } catch (error) {
        console.error('API Error:', error.message);
        cleanup();
      }
    };

    const cleanup = () => {
      socket.disconnect();
      resolve();
    };

    socket.on('disconnect', () => {
      console.log('\nSocket disconnected');
      resolve();
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (socket.connected) {
        socket.disconnect();
      }
      resolve();
    }, 15000);
  });
};

testRedeemWithSocket().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
