const { getDb } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const { search, category, available } = req.query;
      let query = `SELECT * FROM books WHERE 1=1`;
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length} OR isbn ILIKE $${params.length})`;
      }
      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }
      if (available === 'true') {
        query += ` AND available_copies > 0`;
      }
      query += ` ORDER BY title ASC`;

      const books = await sql(query, params);
      return res.status(200).json({ success: true, data: books });
    }

    if (req.method === 'POST') {
      const { isbn, title, author, category, total_copies, published_year, publisher } = req.body;
      if (!isbn || !title || !author) {
        return res.status(400).json({ success: false, message: 'ISBN, title, and author are required' });
      }
      const copies = parseInt(total_copies) || 1;
      const result = await sql(
        `INSERT INTO books (isbn, title, author, category, total_copies, available_copies, published_year, publisher)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7) RETURNING *`,
        [isbn, title, author, category || null, copies, published_year || null, publisher || null]
      );
      return res.status(201).json({ success: true, data: result[0] });
    }

    if (req.method === 'PUT') {
      const { isbn } = req.query;
      const { title, author, category, total_copies, published_year, publisher } = req.body;
      if (!isbn) return res.status(400).json({ success: false, message: 'ISBN is required' });

      const result = await sql(
        `UPDATE books SET title=$1, author=$2, category=$3, total_copies=$4, published_year=$5, publisher=$6
         WHERE isbn=$7 RETURNING *`,
        [title, author, category, total_copies, published_year, publisher, isbn]
      );
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Book not found' });
      return res.status(200).json({ success: true, data: result[0] });
    }

    if (req.method === 'DELETE') {
      const { isbn } = req.query;
      if (!isbn) return res.status(400).json({ success: false, message: 'ISBN is required' });

      const active = await sql(`SELECT id FROM borrow_records WHERE book_isbn=$1 AND status='borrowed'`, [isbn]);
      if (active.length > 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete book with active borrows' });
      }
      await sql(`DELETE FROM books WHERE isbn=$1`, [isbn]);
      return res.status(200).json({ success: true, message: 'Book deleted successfully' });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Books API error:', err);
    if (err.message?.includes('duplicate key')) {
      return res.status(400).json({ success: false, message: 'A book with this ISBN already exists' });
    }
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
