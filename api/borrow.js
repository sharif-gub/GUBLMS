const { getDb } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const { status, member_id, search } = req.query;

      // Update overdue status first
      await sql(`
        UPDATE borrow_records SET status='overdue'
        WHERE status='borrowed' AND due_date < CURRENT_DATE
      `);

      let query = `
        SELECT br.*, m.name as member_name, m.email as member_email,
               b.title as book_title, b.author as book_author,
               CASE WHEN br.return_date IS NULL AND br.due_date < CURRENT_DATE
                    THEN (CURRENT_DATE - br.due_date) ELSE 0 END as days_overdue
        FROM borrow_records br
        JOIN members m ON br.member_id = m.member_id
        JOIN books b ON br.book_isbn = b.isbn
        WHERE 1=1`;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND br.status=$${params.length}`;
      }
      if (member_id) {
        params.push(member_id);
        query += ` AND br.member_id=$${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (m.name ILIKE $${params.length} OR b.title ILIKE $${params.length} OR br.borrow_id ILIKE $${params.length})`;
      }
      query += ` ORDER BY br.created_at DESC LIMIT 200`;

      const records = await sql(query, params);
      return res.status(200).json({ success: true, data: records });
    }

    // BORROW a book
    if (req.method === 'POST') {
      const { member_id, book_isbn } = req.body;
      if (!member_id || !book_isbn) {
        return res.status(400).json({ success: false, message: 'Member ID and Book ISBN are required' });
      }

      // Check member exists and is active
      const member = await sql(`SELECT * FROM members WHERE member_id=$1 AND is_active=true`, [member_id]);
      if (member.length === 0) {
        return res.status(404).json({ success: false, message: 'Member not found or inactive' });
      }

      // Check book availability
      const book = await sql(`SELECT * FROM books WHERE isbn=$1`, [book_isbn]);
      if (book.length === 0) return res.status(404).json({ success: false, message: 'Book not found' });
      if (book[0].available_copies <= 0) {
        return res.status(400).json({ success: false, message: 'No copies available for this book' });
      }

      // Check if member already borrowed this book
      const existing = await sql(
        `SELECT id FROM borrow_records WHERE member_id=$1 AND book_isbn=$2 AND status IN ('borrowed','overdue')`,
        [member_id, book_isbn]
      );
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Member already has this book borrowed' });
      }

      // Check member borrow limit (max 3 active borrows)
      const activeBorrows = await sql(
        `SELECT COUNT(*) as cnt FROM borrow_records WHERE member_id=$1 AND status IN ('borrowed','overdue')`,
        [member_id]
      );
      if (parseInt(activeBorrows[0].cnt) >= 3) {
        return res.status(400).json({ success: false, message: 'Member has reached maximum borrow limit (3 books)' });
      }

      // Get fine config for borrow days
      const config = await sql(`SELECT * FROM fine_config LIMIT 1`);
      const maxDays = config[0]?.max_borrow_days || 14;

      // Generate borrow ID
      const count = await sql(`SELECT COUNT(*) as cnt FROM borrow_records`);
      const borrow_id = `BR${String(parseInt(count[0].cnt) + 1).padStart(5, '0')}`;

      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + maxDays);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      // Create borrow record & update book availability
      const result = await sql(
        `INSERT INTO borrow_records (borrow_id, member_id, book_isbn, borrow_date, due_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [borrow_id, member_id, book_isbn, todayStr, dueDateStr]
      );
      await sql(`UPDATE books SET available_copies = available_copies - 1 WHERE isbn=$1`, [book_isbn]);

      return res.status(201).json({
        success: true,
        data: {
          ...result[0],
          member_name: member[0].name,
          book_title: book[0].title,
          book_author: book[0].author
        },
        message: `Book borrowed successfully. Due date: ${dueDateStr}`
      });
    }

    // RETURN a book
    if (req.method === 'PUT') {
      const { borrow_id } = req.query;
      if (!borrow_id) return res.status(400).json({ success: false, message: 'Borrow ID is required' });

      const record = await sql(
        `SELECT br.*, b.title, b.author, m.name as member_name
         FROM borrow_records br
         JOIN books b ON br.book_isbn = b.isbn
         JOIN members m ON br.member_id = m.member_id
         WHERE br.borrow_id=$1`,
        [borrow_id]
      );
      if (record.length === 0) return res.status(404).json({ success: false, message: 'Borrow record not found' });

      const rec = record[0];
      if (rec.status === 'returned') {
        return res.status(400).json({ success: false, message: 'This book has already been returned' });
      }

      // Calculate fine
      const config = await sql(`SELECT * FROM fine_config LIMIT 1`);
      const finePerDay = parseFloat(config[0]?.fine_per_day || 5.00);
      const gracePeriod = parseInt(config[0]?.grace_period_days || 0);

      const today = new Date();
      const dueDate = new Date(rec.due_date);
      const todayStr = today.toISOString().split('T')[0];

      let fine = 0;
      let daysOverdue = 0;
      if (today > dueDate) {
        const diff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        daysOverdue = Math.max(0, diff - gracePeriod);
        fine = daysOverdue * finePerDay;
      }

      const updated = await sql(
        `UPDATE borrow_records SET return_date=$1, fine_amount=$2, status='returned'
         WHERE borrow_id=$3 RETURNING *`,
        [todayStr, fine, borrow_id]
      );
      await sql(`UPDATE books SET available_copies = available_copies + 1 WHERE isbn=$1`, [rec.book_isbn]);

      return res.status(200).json({
        success: true,
        data: {
          ...updated[0],
          book_title: rec.title,
          member_name: rec.member_name,
          days_overdue: daysOverdue,
          fine_amount: fine
        },
        message: fine > 0
          ? `Book returned. Fine of ৳${fine.toFixed(2)} for ${daysOverdue} day(s) overdue.`
          : 'Book returned successfully. No fine.'
      });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Borrow API error:', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
