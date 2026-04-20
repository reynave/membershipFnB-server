const swaggerAutogen = require('swagger-autogen')();
const path = require('path');

const doc = {
  host: 'localhost:3200',
  info: {
    title: 'Membership API',
    description: 'REST API untuk aplikasi Membership dengan autentikasi JWT, manajemen point transaksi POS, dan balance point member',
    version: '1.0.0',
    contact: {
      name: 'API Support'
    },
    license: {
      name: 'MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3200',
      description: 'Development Server'
    },
    {
      url: 'https://api.membership.local',
      description: 'Production Server'
    }
  ],
  tags: [
    {
      name: 'Membership',
      description: 'Endpoint health check dan informasi umum Membership'
    },
    {
      name: 'Authentication',
      description: 'Endpoint registrasi dan login member'
    },
    {
      name: 'Points',
      description: 'Endpoint manajemen point transaksi dan balance'
    },
    {
      name: 'Redeem',
      description: 'Endpoint redeem point dari POS merchant'
    },
    {
      name: 'V1 POS',
      description: 'Endpoint POS v1 tanpa JWT (sementara)'
    }
  ],
  paths: {
    '/api/v1/pos/members/balance': {
      get: {
        tags: ['V1 POS'],
        summary: 'Check member balance for POS (no JWT)',
        description: 'Cek balance member untuk POS v1 tanpa JWT token. Wajib kirim salah satu query: id, phone, atau email.',
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Member ID. Gunakan salah satu dari id/phone/email.',
            example: '1'
          },
          {
            name: 'phone',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Nomor phone member. Gunakan salah satu dari id/phone/email.',
            example: '081234567890'
          },
          {
            name: 'email',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Email member. Gunakan salah satu dari id/phone/email.',
            example: 'member@example.com'
          }
        ],
        responses: {
          200: { description: 'Balance member berhasil diambil' },
          404: { description: 'Member tidak ditemukan atau tidak aktif' },
          422: { description: 'Query id/phone/email tidak valid' }
        }
      }
    },
    '/api/v1/pos/members/history/today': {
      get: {
        tags: ['V1 POS'],
        summary: 'Check member history today for POS (no JWT)',
        description: 'Cek history point member per hari ini untuk POS v1 tanpa JWT token. Wajib kirim salah satu query: id, phone, atau email.',
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Member ID. Gunakan salah satu dari id/phone/email.',
            example: '1'
          },
          {
            name: 'phone',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Nomor phone member. Gunakan salah satu dari id/phone/email.',
            example: '081234567890'
          },
          {
            name: 'email',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Email member. Gunakan salah satu dari id/phone/email.',
            example: 'member@example.com'
          }
        ],
        responses: {
          200: { description: 'History point hari ini berhasil diambil' },
          404: { description: 'Member tidak ditemukan atau tidak aktif' },
          422: { description: 'Query id/phone/email tidak valid' }
        }
      }
    },
    '/api/v1/pos/points/in': {
      post: {
        tags: ['V1 POS'],
        summary: 'Post point in for POS (no JWT)',
        description: 'Post point masuk dari POS v1 tanpa JWT token. Member dicari dari query id/phone/email, dan user POS bisa dikirim via x-pos-user-id atau userId.',
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Member ID. Gunakan salah satu dari id/phone/email.',
            example: '1'
          },
          {
            name: 'phone',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Nomor phone member. Gunakan salah satu dari id/phone/email.',
            example: '081234567890'
          },
          {
            name: 'email',
            in: 'query',
            required: false,
            type: 'string',
            description: 'Email member. Gunakan salah satu dari id/phone/email.',
            example: 'member@example.com'
          },
          {
            name: 'x-pos-user-id',
            in: 'header',
            required: false,
            type: 'string',
            description: 'Optional userId POS di header. Jika tidak ada, bisa kirim userId di body/query.',
            example: '1'
          }
        ],
        responses: {
          201: { description: 'Point in berhasil dibuat' },
          401: { description: 'POS user tidak terhubung ke merchant token' },
          404: { description: 'Member atau tier tidak ditemukan' },
          422: { description: 'Validasi request gagal' }
        }
      }
    },
    '/api/v1/pos/redeem': {
      post: {
        tags: ['V1 POS'],
        summary: 'Redeem point for POS (no JWT)',
        description: 'Redeem point dari POS v1 tanpa JWT token. userId POS bisa dikirim via x-pos-user-id atau userId di body/query.',
        parameters: [
          {
            name: 'x-pos-user-id',
            in: 'header',
            required: false,
            type: 'string',
            description: 'Optional userId POS di header. Jika tidak ada, bisa kirim userId di body/query.',
            example: '1'
          }
        ],
        responses: {
          200: { description: 'Redeem berhasil' },
          400: { description: 'Insufficient balance atau member tidak aktif' },
          401: { description: 'POS user tidak terhubung ke merchant token' },
          404: { description: 'Redeem code/member tidak ditemukan' },
          410: { description: 'Redeem code sudah digunakan atau expired' },
          422: { description: 'Validasi request gagal' }
        }
      }
    },
    '/api/membership/points/balance': {
      get: {
        tags: ['Points'],
        summary: 'Get member point balance',
        description: 'Mengambil total point masuk, point keluar, dan saldo point member. Endpoint ini memerlukan JWT token pada header Authorization.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'query',
            required: false,
            type: 'string',
            description: 'ID member. Jika tidak diisi, API akan memakai id dari JWT token.',
            example: '1'
          }
        ],
        responses: {
          200: {
            description: 'Balance point berhasil diambil',
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Total points fetched' },
                data: {
                  type: 'object',
                  properties: {
                    memberId: { type: 'string', example: '1' },
                    totalPointIn: { type: 'number', example: 120 },
                    totalPointOut: { type: 'number', example: 40 },
                    balancePoint: { type: 'number', example: 80 }
                  }
                }
              }
            }
          },
          401: { description: 'JWT token tidak valid atau tidak ada' },
          422: { description: 'Parameter member id tidak valid atau tidak tersedia' }
        }
      }
    },
    '/api/membership/redeem/redeem': {
      post: {
        tags: ['Redeem'],
        summary: 'Redeem member point from POS',
        description: 'Memproses redeem point berdasarkan redeemCode dari app membership dan token dari sistem POS merchant.',
        parameters: [
          {
            name: 'token',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description: 'Merchant token dari tabel users_token',
            example: 'tokensimpan.database'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['redeemCode', 'amount', 'transactionId'],
                properties: {
                  redeemCode: { type: 'string', example: 'BLUE-CODE-100' },
                  amount: { type: 'number', example: 50000 },
                  transactionId: { type: 'string', example: 'POS-TRX-001' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Redeem berhasil',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Point redeemed successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        point: { type: 'number', example: 50000 },
                        approvalCode: { type: 'string', example: '57ADD8B9879304AE5A7BE858A94D28DB' },
                        status: { type: 'string', example: 'success' }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { description: 'Validation business gagal (insufficient balance/member tidak aktif)' },
          401: { description: 'Token merchant tidak valid' },
          404: { description: 'Redeem code/member tidak ditemukan' },
          410: { description: 'Redeem code expired atau sudah digunakan' },
          422: { description: 'Validation request body gagal' }
        }
      }
    }
  },
  securityDefinitions: {
    BearerAuth: {
      type: 'apiKey',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
      description: 'JWT token dari endpoint login'
    }
  }
};

const routes = [
  path.join(__dirname, './src/routes/membership/index.js'),
  path.join(__dirname, './src/routes/membership/auth.routes.js'),
  path.join(__dirname, './src/routes/membership/point.routes.js'),
  path.join(__dirname, './src/routes/membership/redeem.routes.js')
  // Keep V1 POS docs in doc.paths.
  // swagger-autogen route scanning can regress to short paths in this repo.
];

const outputFile = path.join(__dirname, './swagger.json');

// Generate swagger.json
swaggerAutogen(outputFile, routes, doc);
