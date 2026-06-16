const { getDb } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const { search, id } = req.query;

      if (id) {
        const member = await sql(`SELECT * FROM members WHERE member_id=$1`, [id]);
        if (member.length === 0) return res.status(404).json({ success: false, message: 'Member not found' });
        const borrows = await sql(
          `SELECT br.*, b.title, b.author FROM borrow_records br
           JOIN books b ON br.book_isbn = b.isbn
           WHERE br.member_id=$1 ORDER BY br.borrow_date DESC`,
          [id]
        );
        return res.status(200).json({ success: true, data: { ...member[0], borrow_history: borrows } });
      }

      let query = `SELECT m.*,
        COUNT(CASE WHEN br.status='borrowed' THEN 1 END) as active_borrows,
        SUM(CASE WHEN br.fine_paid=false THEN br.fine_amount ELSE 0 END) as pending_fines
        FROM members m
        LEFT JOIN borrow_records br ON m.member_id = br.member_id
        WHERE m.is_active=true`;
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (m.name ILIKE $${params.length} OR m.member_id ILIKE $${params.length} OR m.email ILIKE $${params.length})`;
      }
      query += ` GROUP BY m.id ORDER BY m.name ASC`;

      const members = await sql(query, params);
      return res.status(200).json({ success: true, data: members });
    }

    if (req.method === 'POST') {
      const { name, email, phone, address, membership_type } = req.body;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Name and email are required' });
      }

      // Generate member ID
      const count = await sql(`SELECT COUNT(*) as cnt FROM members`);
      const nextNum = parseInt(count[0].cnt) + 1;
      const member_id = `MEM${String(nextNum).padStart(3, '0')}`;

      const result = await sql(
        `INSERT INTO members (member_id, name, email, phone, address, membership_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [member_id, name, email, phone || null, address || null, membership_type || 'standard']
      );
      return res.status(201).json({ success: true, data: result[0] });
    }

    if (req.method === 'PUT') {
      const { id } = req.query;
      const { name, email, phone, address, membership_type, is_active } = req.body;
      if (!id) return res.status(400).json({ success: false, message: 'Member ID is required' });

      const result = await sql(
        `UPDATE members SET name=$1, email=$2, phone=$3, address=$4, membership_type=$5, is_active=$6
         WHERE member_id=$7 RETURNING *`,
        [name, email, phone, address, membership_type, is_active !== false, id]
      );
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Member not found' });
      return res.status(200).json({ success: true, data: result[0] });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Members API error:', err);
    if (err.message?.includes('duplicate key')) {
      return res.status(400).json({ success: false, message: 'A member with this email already exists' });
    }
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
