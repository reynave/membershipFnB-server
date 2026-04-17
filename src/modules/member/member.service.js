const { query } = require("../../config/db");

const getPointHistory = async (userId) => {
  // Placeholder history until points table is finalized from business flowchart.
  const users = await query("SELECT id, name FROM users WHERE id = ? LIMIT 1", [userId]);

  if (users.length === 0) {
    const error = new Error("Member not found");
    error.statusCode = 404;
    throw error;
  }

  return [
    {
      id: 1,
      memberId: userId,
      type: "WELCOME_BONUS",
      points: 100,
      createdAt: new Date().toISOString()
    }
  ];
};

module.exports = {
  getPointHistory
};
