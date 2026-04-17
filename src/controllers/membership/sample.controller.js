const ping = (_req, res) => {
  res.json({ success: true, source: 'membership' });
};

module.exports = { ping };
