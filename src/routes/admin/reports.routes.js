const express = require("express");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const auth = require('../../middleware/auth');
const { query } = require('../../config/db');

const router = express.Router();

router.get("/members", auth, async (req, res, next) => {
  try {
    const users = await query(
      "SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 100"
    );

    const templatePath = path.join(__dirname, '..', '..', 'reports', 'templates', 'members-report.hbs');
    const templateSource = fs.readFileSync(templatePath, "utf8");
    const template = handlebars.compile(templateSource);

    const html = template({
      generatedAt: new Date().toISOString(),
      total: users.length,
      members: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: new Date(user.created_at).toISOString()
      }))
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
