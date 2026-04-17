const ping = (_req, res) => {
  res.json({ success: true, source: 'admin' });
};

module.exports = { ping };
