-- Library Management System Database Schema
-- Run this in your Neon PostgreSQL database

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  member_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  membership_type VARCHAR(20) DEFAULT 'standard' CHECK (membership_type IN ('standard', 'premium', 'student')),
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  isbn VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(150) NOT NULL,
  category VARCHAR(80),
  total_copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  published_year INTEGER,
  publisher VARCHAR(150),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Borrow records table
CREATE TABLE IF NOT EXISTS borrow_records (
  id SERIAL PRIMARY KEY,
  borrow_id VARCHAR(20) UNIQUE NOT NULL,
  member_id VARCHAR(20) NOT NULL REFERENCES members(member_id),
  book_isbn VARCHAR(20) NOT NULL REFERENCES books(isbn),
  borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  fine_amount DECIMAL(10,2) DEFAULT 0.00,
  fine_paid BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fine rate configuration
CREATE TABLE IF NOT EXISTS fine_config (
  id SERIAL PRIMARY KEY,
  fine_per_day DECIMAL(10,2) DEFAULT 5.00,
  max_borrow_days INTEGER DEFAULT 14,
  grace_period_days INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default fine config
INSERT INTO fine_config (fine_per_day, max_borrow_days, grace_period_days)
VALUES (5.00, 14, 0)
ON CONFLICT DO NOTHING;

-- Sample members
INSERT INTO members (member_id, name, email, phone, membership_type) VALUES
('MEM001', 'Ahmed Rahman', 'ahmed@example.com', '01711-000001', 'premium'),
('MEM002', 'Fatima Khatun', 'fatima@example.com', '01711-000002', 'standard'),
('MEM003', 'Karim Hossain', 'karim@example.com', '01711-000003', 'student'),
('MEM004', 'Nusrat Jahan', 'nusrat@example.com', '01711-000004', 'standard'),
('MEM005', 'Rahim Uddin', 'rahim@example.com', '01711-000005', 'student')
ON CONFLICT DO NOTHING;

-- Sample books
INSERT INTO books (isbn, title, author, category, total_copies, available_copies, published_year) VALUES
('978-0-06-112008-4', 'To Kill a Mockingbird', 'Harper Lee', 'Fiction', 3, 3, 1960),
('978-0-7432-7356-5', '1984', 'George Orwell', 'Dystopia', 2, 2, 1949),
('978-0-14-028329-7', 'The Great Gatsby', 'F. Scott Fitzgerald', 'Classic', 2, 2, 1925),
('978-0-316-76948-0', 'The Catcher in the Rye', 'J.D. Salinger', 'Fiction', 2, 2, 1951),
('978-0-7432-7357-2', 'Brave New World', 'Aldous Huxley', 'Sci-Fi', 2, 2, 1932),
('978-0-06-093546-9', 'To Kill a Mockingbird 2', 'Harper Lee', 'Fiction', 1, 1, 1970),
('978-0-7432-1630-0', 'The Alchemist', 'Paulo Coelho', 'Philosophy', 3, 3, 1988),
('978-0-14-028330-3', 'Pride and Prejudice', 'Jane Austen', 'Classic', 2, 2, 1813),
('978-0-7432-7358-9', 'The Hitchhiker Guide', 'Douglas Adams', 'Sci-Fi', 2, 2, 1979),
('978-0-06-112009-1', 'Harry Potter Vol 1', 'J.K. Rowling', 'Fantasy', 4, 4, 1997)
ON CONFLICT DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_borrow_member ON borrow_records(member_id);
CREATE INDEX IF NOT EXISTS idx_borrow_book ON borrow_records(book_isbn);
CREATE INDEX IF NOT EXISTS idx_borrow_status ON borrow_records(status);
CREATE INDEX IF NOT EXISTS idx_borrow_due_date ON borrow_records(due_date);
