# POS Machine Integration Guide

This document describes how an external POS machine integrates with the Membership Loyalty API.

---

## 1. Overview

The POS API allows a physical POS machine to:
- Look up a member's point balance
- Add loyalty points after a transaction (point-in)
- Redeem points on behalf of a member (redeem)
- View today's point transactions for a member

All requests must be authenticated with an **opaque bearer token** issued per merchant by a system admin.

---

## 2. Getting a POS Token

Tokens are managed by a system administrator through the Admin Panel.

1. Admin logs in to the Admin Panel → **Admin** menu → select the staff user
2. Under **Merchant Token (POS Access)**, click **Create Token**
3. Select the merchant outlet, then click **Generate Opaque Token**
4. Copy the generated token (it is only shown once on creation)
5. Configure the token on the POS machine as a static Bearer token

Token format: `pos_live_<64 hex characters>`  
Example: `pos_live_2cac7909999abc123...`

> **Note:** Tokens do not expire. They are immediately revoked when deleted by an admin.

---

## 3. Base URL

```
http://<server-host>:3200/api/v1/pos
```

Replace `<server-host>` with your server's IP or domain.

---

## 4. Authentication

Include the POS token in every request as a Bearer token in the `Authorization` header:

```
Authorization: Bearer pos_live_2cac7909999abc123...
```

If the token is missing, invalid, or has been revoked, the API returns:

```json
HTTP 401
{
  "success": false,
  "message": "Invalid or inactive POS token"
}
```

---

## 5. Member Identifier

All POS endpoints identify a member using **exactly one** of the following fields:

| Field   | Description              | Example                  |
|---------|--------------------------|--------------------------|
| `id`    | Internal member ID       | `42`                     |
| `phone` | Member's phone number    | `08123456789`            |
| `email` | Member's email address   | `john@example.com`       |

> You must provide exactly one identifier. Providing more than one returns a 422 error.

---

## 6. Endpoints

### 6.1 Get Member Balance

Retrieve a member's point balance.

**Request**
```
GET /api/v1/pos/members/balance?id=42
Authorization: Bearer pos_live_...
```

Query parameters (pick one):
- `id` — member ID
- `phone` — member phone
- `email` — member email

**Response 200**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": 42,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "08123456789",
    "tierName": "gold",
    "totalPointIn": 1500,
    "totalPointOut": 200,
    "balance": 1300
  }
}
```

---

### 6.2 Get Today's Point History

Retrieve all point transactions for a member recorded today.

**Request**
```
GET /api/v1/pos/members/history/today?phone=08123456789
Authorization: Bearer pos_live_...
```

**Response 200**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "member": {
      "id": 42,
      "name": "John Doe"
    },
    "history": [
      {
        "id": 101,
        "bill": "TXN-20260421-001",
        "totalAmount": 250000,
        "pointIn": 125,
        "pointOut": 0,
        "merchantName": "Main Branch",
        "transactionDate": "2026-04-21 10:30:00"
      }
    ]
  }
}
```

---

### 6.3 Add Loyalty Points (Point-In)

Record a purchase transaction and award loyalty points to the member.

**Request**
```
POST /api/v1/pos/points/in
Authorization: Bearer pos_live_...
Content-Type: application/json
```

**Request Body**
```json
{
  "id": 42,
  "bill": "TXN-20260421-001",
  "totalAmount": 250000,
  "billDate": "2026-04-21 10:30:00",
  "note": "Dine-in lunch"
}
```

| Field         | Type    | Required | Description                                     |
|---------------|---------|----------|-------------------------------------------------|
| `id`          | number  | *        | Member ID (use one identifier)                  |
| `phone`       | string  | *        | Member phone (use one identifier)               |
| `email`       | string  | *        | Member email (use one identifier)               |
| `bill`        | string  | Yes      | Bill/receipt number, max 50 chars               |
| `totalAmount` | number  | Yes      | Transaction amount (must be > 0)                |
| `billDate`    | string  | Yes      | Transaction datetime, format: `YYYY-MM-DD HH:MM:SS` |
| `note`        | string  | No       | Optional transaction note, max 250 chars        |

**Response 200**
```json
{
  "success": true,
  "message": "Point transaction recorded",
  "data": {
    "transactionId": 201,
    "memberId": 42,
    "memberName": "John Doe",
    "merchantName": "Main Branch",
    "bill": "TXN-20260421-001",
    "totalAmount": 250000,
    "pointIn": 125,
    "tierName": "gold",
    "balance": 1425
  }
}
```

---

### 6.4 Redeem Points

Deduct points from a member's balance for a redemption.

**Request**
```
POST /api/v1/pos/redeem
Authorization: Bearer pos_live_...
Content-Type: application/json
```

**Request Body**
```json
{
  "phone": "08123456789",
  "redeemCode": "RDM-ABCD-1234",
  "amount": 100,
  "transactionId": "TXN-20260421-002",
  "phone": "08123456789"
}
```

| Field           | Type    | Required | Description                                       |
|-----------------|---------|----------|---------------------------------------------------|
| `id`            | number  | *        | Member ID (use one identifier)                    |
| `phone`         | string  | *        | Member phone (use one identifier)                 |
| `email`         | string  | *        | Member email (use one identifier)                 |
| `redeemCode`    | string  | Yes      | Redemption code provided by the member            |
| `amount`        | number  | Yes      | Number of points to redeem (must be > 0)          |
| `transactionId` | string  | Yes      | POS transaction reference, max 50 chars           |
| `phone`         | string  | No       | Confirmation phone number (optional)              |

**Response 200**
```json
{
  "success": true,
  "message": "Redeem successful",
  "data": {
    "redeemId": 55,
    "memberId": 42,
    "memberName": "John Doe",
    "merchantName": "Main Branch",
    "redeemCode": "RDM-ABCD-1234",
    "amount": 100,
    "approvalCode": "APV-XYZ-9876",
    "remainingBalance": 1325
  }
}
```

---

## 7. Error Responses

All errors follow the same envelope format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "totalAmount", "message": "totalAmount must be a number greater than 0" }
  ]
}
```

| HTTP Status | Meaning                                             |
|-------------|-----------------------------------------------------|
| 400         | Bad request / business rule violation               |
| 401         | Missing, invalid, or revoked POS token              |
| 404         | Member not found                                    |
| 422         | Validation error (see `errors` array)               |
| 500         | Internal server error                               |

---

## 8. Sample cURL Commands

### Check balance by phone
```bash
curl -X GET "http://localhost:3200/api/v1/pos/members/balance?phone=08123456789" \
  -H "Authorization: Bearer pos_live_2cac7909999abc123..."
```

### Add points after a purchase
```bash
curl -X POST "http://localhost:3200/api/v1/pos/points/in" \
  -H "Authorization: Bearer pos_live_2cac7909999abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "08123456789",
    "bill": "TXN-20260421-001",
    "totalAmount": 250000,
    "billDate": "2026-04-21 10:30:00",
    "note": "Dine-in"
  }'
```

### Redeem points
```bash
curl -X POST "http://localhost:3200/api/v1/pos/redeem" \
  -H "Authorization: Bearer pos_live_2cac7909999abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "08123456789",
    "redeemCode": "RDM-ABCD-1234",
    "amount": 100,
    "transactionId": "TXN-20260421-002"
  }'
```

---

## 9. Important Notes

- Each POS token is **tied to a specific merchant outlet**. Points and redemptions are automatically attributed to that merchant — no extra field is needed in the request body.
- If a token is deleted by admin, all subsequent requests using that token will immediately return 401.
- `billDate` must be in `YYYY-MM-DD HH:MM:SS` format (24-hour), matching your server timezone.
- `bill` and `transactionId` values are stored as-is; use your POS machine's native receipt/transaction number.
