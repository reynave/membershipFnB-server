const swaggerAutogen = require('swagger-autogen')();
const path = require('path');

const doc = {
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
    }
  ],
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
  path.join(__dirname, './src/routes/membership/point.routes.js')
];

const outputFile = path.join(__dirname, './swagger.json');

// Generate swagger.json
swaggerAutogen(outputFile, routes, doc);
