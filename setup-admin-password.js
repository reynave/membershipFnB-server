/**
 * setup-admin-password.js
 * Run once to hash the admin password in the users table.
 * Usage: node setup-admin-password.js
 *        node setup-admin-password.js admin@admin.com newpassword
 */
require('./src/config/loadEnv');
const bcrypt = require('bcryptjs');
const { query } = require('./src/config/db');

const email    = process.argv[2] || 'admin@admin.com';
const password = process.argv[3] || 'admin123';

(async () => {
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hash, email]
    );
    if (result.affectedRows === 0) {
      console.log(`[!] User not found: ${email}`);
    } else {
      console.log(`[✓] Password updated for ${email}`);
      console.log(`    Email   : ${email}`);
      console.log(`    Password: ${password}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('[✗] Error:', err.message);
    process.exit(1);
  }
})();
