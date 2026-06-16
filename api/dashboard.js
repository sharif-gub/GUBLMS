const { getDb } = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    // Update overdue records
    await sql(`UPDATE borrow_records SET status='overdue' WHERE status='borrowed' AND due_date < CURRENT_DATE`);

    const [
      totalBooks,
      totalMembers,
      activeBorrows,
      overdueBooks,
      totalFines,
      recentBorrows,
      categoryStats
    ] = await Promise.all([
      sql(`SELECT COUNT(*) as count, SUM(total_copies) as total_copies FROM books`),
      sql(`SELECT COUNT(*) as count FROM members WHERE is_active=true`),
      sql(`SELECT COUNT(*) as count FROM borrow_records WHERE status='borrowed'`),
      sql(`SELECT COUNT(*) as count FROM borrow_records WHERE status='overdue'`),
      sql(`SELECT SUM(fine_amount) as total, SUM(CASE WHEN fine_paid=false AND status='returned' THEN fine_amount ELSE 0 END) as pending FROM borrow_records`),
      sql(`SELECT br.*, b.title, m.name as member_name
           FROM borrow_records br
           JOIN books b ON br.book_isbn = b.isbn
           JOIN members m ON br.member_id = m.member_id
           ORDER BY br.created_at DESC LIMIT 5`),
      sql(`SELECT category, COUNT(*) as count FROM books WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 6`)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total_books: parseInt(totalBooks[0].count),
        total_copies: parseInt(totalBooks[0].total_copies) || 0,
        total_members: parseInt(totalMembers[0].count),
        active_borrows: parseInt(activeBorrows[0].count),
        overdue_books: parseInt(overdueBooks[0].count),
        total_fines_collected: parseFloat(totalFines[0].total) || 0,
        pending_fines: parseFloat(totalFines[0].pending) || 0,
        recent_borrows: recentBorrows,
        category_stats: categoryStats
      }
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};
