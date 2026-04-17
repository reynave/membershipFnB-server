# Socket Integration - Redeem Point Notification

## Overview
Socket.IO events telah terintegrasi dengan API redeem point untuk memberikan notifikasi real-time ke app membership ketika redeem point berhasil atau gagal.

## Architecture

### 1. Socket Setup (server.js)
- Socket.IO instance di-create dan register dengan handler
- Socket middleware `attachIoToRequest` menginject `io` instance ke setiap request
- Ini memungkinkan service layer untuk emit socket events

### 2. Socket Handler (sockets/index.js)
- **member:join** event: Member bergabung ke room `member:${memberId}` untuk menerima notifikasi personal
- Socket room naming: `member:${memberId}` - hanya member specific yang receive event

### 3. Redeem Service Integration (modules/membership/redeem.service.js)
- Accept `io` parameter dari controller
- Track `memberId` throughout validation flow
- **On Success:** emit `redeem:success` event
- **On Failure:** emit `redeem:failed` event (setelah validasi code berhasil, untuk error saat calculation/validation)

### 4. Events Definition

#### redeem:success
```javascript
{
  point: 50000,                                    // amount yang diredeem
  approvalCode: "57ADD8B9879304AE5A7BE858A94D28DB", // unique approval code
  status: "success",
  redeemCode: "BLUE-CODE-100",
  timestamp: "2026-04-17T12:30:45.123Z"
}
```

#### redeem:failed
```javascript
{
  status: "failed",
  message: "Insufficient point balance",          // error message
  redeemCode: "LOW-POINT-CODE",
  timestamp: "2026-04-17T12:30:45.123Z"
}
```

## Client Implementation (App Membership)

### Socket Connection & Join
```javascript
// Connect ke server socket
const socket = io('http://api-url:3200');

// Join member room saat login
socket.emit('member:join', memberId);

// Listen for redeem events
socket.on('redeem:success', (data) => {
  // Show success notification
  // Update local point balance
});

socket.on('redeem:failed', (data) => {
  // Show error notification
  // Inform user: insufficient points, expired code, etc
});
```

## Error Scenarios & Socket Notifications

| Error | Status | Socket Event | Description |
|-------|--------|--------------|-------------|
| Invalid Token | 401 | ✗ No event | Token validation fails sebelum get memberId |
| Code Not Found | 404 | ✗ No event | Code tidak ada di DB |
| Code Already Used | 410 | ✓ redeem:failed | Code sudah di-redeem |
| Code Expired | 410 | ✓ redeem:failed | Code sudah expired |
| Member Not Active | 400 | ✓ redeem:failed | Member status != 1 |
| Insufficient Balance | 400 | ✓ redeem:failed | Member point < amount |
| Success | 200 | ✓ redeem:success | Redeem successful |

## Files Modified

- `src/server.js` - Export io, setup attachIoToRequest middleware
- `src/middleware/attachIo.js` - NEW: Middleware untuk inject io ke request
- `src/controllers/membership/redeem.controller.js` - Pass io dari req ke service
- `src/modules/membership/redeem.service.js` - Emit socket events after transaction
- `src/sockets/index.js` - Socket handler dengan member:join room

## Testing

### Server Logs
Check nodemon terminal untuk verify events di-emit:
```
POST /api/membership/redeem/redeem 200 118ms - 148
```

### Client Listener
Buat socket listener di app untuk terima events:
```javascript
socket.on('redeem:success', (data) => console.log(data));
socket.on('redeem:failed', (data) => console.log(data));
```

## Benefits

1. **Real-time Notification** - Member langsung tahu result redeem tanpa polling
2. **Personal Targeting** - Event hanya dikirim ke member yang bersangkutan (room-based)
3. **Error Feedback** - Clear error messages untuk user
4. **Clean Architecture** - Socket layer terpisah dari business logic
