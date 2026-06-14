module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.status(200).json({ ok: true, url: req.url, headers: req.headers });
};
