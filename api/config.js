const { getDb } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const config = await sql(`SELECT * FROM fine_config LIMIT 1`);
      return res.status(200).json({ success: true, data: config[0] });
    }

    if (req.method === 'PUT') {
      const { fine_per_day, max_borrow_days, grace_period_days } = req.body;
      const result = await sql(
        `UPDATE fine_config SET fine_per_day=$1, max_borrow_days=$2, grace_period_days=$3, updated_at=NOW()
         WHERE id=1 RETURNING *`,
        [fine_per_day, max_borrow_days, grace_period_days]
      );
      return res.status(200).json({ success: true, data: result[0] });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Config API error:', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
