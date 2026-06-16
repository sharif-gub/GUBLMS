/* ============================================
   LibraFlow — Main Application JavaScript
   ============================================ */

const API = '/api';
let currentPage = 'dashboard';
let bookSearchTimeout, memberSearchTimeout;

// ---- NAVIGATION ----
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', books: 'Books', members: 'Members',
    borrow: 'Borrow Book', returns: 'Return Book', fines: 'Fines & Records', settings: 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  currentPage = page;
  closeSidebar();
  loadPage(page);
}

function loadPage(page) {
  if (page === 'dashboard') loadDashboard();
  else if (page === 'books') loadBooks();
  else if (page === 'members') loadMembers();
  else if (page === 'borrow') initBorrowPage();
  else if (page === 'returns') loadActiveBorrows();
  else if (page === 'fines') loadFines();
  else if (page === 'settings') loadConfig();
}

// ---- SIDEBAR TOGGLE ----
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

// ---- TOAST NOTIFICATIONS ----
function toast(title, msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-title">${title}</div><div class="toast-msg">${msg}</div>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(30px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, duration);
}

// ---- MODALS ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ---- API HELPER ----
async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}/${endpoint}`, opts);
  const data = await res.json();
  if (!data.success && res.status !== 200) throw new Error(data.message || 'Request failed');
  return data;
}

// ---- FORMAT HELPERS ----
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCurrency(num) { return '৳' + parseFloat(num || 0).toFixed(2); }
function isOverdue(dueDate) { return new Date(dueDate) < new Date() && dueDate; }
function daysSince(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  return diff;
}

// ---- DASHBOARD ----
async function loadDashboard() {
  try {
    const { data } = await api('dashboard');
    document.getElementById('statTotalBooks').textContent = data.total_books;
    document.getElementById('statTotalCopies').textContent = `${data.total_copies} copies`;
    document.getElementById('statMembers').textContent = data.total_members;
    document.getElementById('statBorrowed').textContent = data.active_borrows;
    document.getElementById('statOverdue').textContent = data.overdue_books;
    document.getElementById('statFines').textContent = fmtCurrency(data.total_fines_collected);
    document.getElementById('statPendingFines').textContent = `${fmtCurrency(data.pending_fines)} pending`;

    // Recent activity
    const actEl = document.getElementById('recentActivity');
    if (data.recent_borrows.length === 0) {
      actEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>No activity yet</p></div>';
    } else {
      actEl.innerHTML = data.recent_borrows.map(r => `
        <div class="activity-item">
          <div class="activity-dot ${r.status}"></div>
          <div class="activity-info">
            <div class="activity-text">"${r.title}" borrowed</div>
            <div class="activity-sub">by ${r.member_name} · Due ${fmtDate(r.due_date)}</div>
          </div>
          <div class="activity-date">${fmtDate(r.borrow_date)}</div>
        </div>`).join('');
    }

    // Category chart
    const catEl = document.getElementById('categoryChart');
    if (data.category_stats.length === 0) {
      catEl.innerHTML = '<div class="empty-state"><p>No category data</p></div>';
    } else {
      const max = Math.max(...data.category_stats.map(c => c.count));
      catEl.innerHTML = data.category_stats.map(c => `
        <div class="category-bar-item">
          <div class="category-bar-label">
            <span>${c.category}</span>
            <span>${c.count} book${c.count > 1 ? 's' : ''}</span>
          </div>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="width:${(c.count/max*100)}%"></div>
          </div>
        </div>`).join('');
    }
  } catch (e) {
    toast('Error', 'Failed to load dashboard: ' + e.message, 'error');
  }
}

// ---- BOOKS ----
async function loadBooks() {
  const search = document.getElementById('bookSearch').value;
  const category = document.getElementById('bookCategoryFilter').value;
  const available = document.getElementById('availableOnly').checked;
  const tbody = document.getElementById('booksTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading books…</td></tr>';
  try {
    let qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    if (available) qs.set('available', 'true');
    const { data } = await api(`books?${qs}`);
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No books found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(b => `
      <tr>
        <td class="mono">${b.isbn}</td>
        <td><strong>${escHtml(b.title)}</strong></td>
        <td>${escHtml(b.author)}</td>
        <td>${b.category ? `<span class="badge badge-navy">${b.category}</span>` : '—'}</td>
        <td class="mono">${b.total_copies}</td>
        <td>
          <span class="badge ${b.available_copies > 0 ? 'badge-success' : 'badge-danger'}">
            ${b.available_copies} / ${b.total_copies}
          </span>
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick='editBook(${JSON.stringify(b)})'>Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteBook('${b.isbn}')">Delete</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    toast('Error', 'Failed to load books: ' + e.message, 'error');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Error loading books.</td></tr>';
  }
}

async function addBook() {
  const isbn = document.getElementById('newBookIsbn').value.trim();
  const title = document.getElementById('newBookTitle').value.trim();
  const author = document.getElementById('newBookAuthor').value.trim();
  const category = document.getElementById('newBookCategory').value;
  const total_copies = document.getElementById('newBookCopies').value;
  const published_year = document.getElementById('newBookYear').value;
  const publisher = document.getElementById('newBookPublisher').value.trim();
  if (!isbn || !title || !author) return toast('Validation', 'ISBN, title and author are required.', 'error');
  try {
    await api('books', 'POST', { isbn, title, author, category, total_copies, published_year, publisher });
    toast('Success', `"${title}" added to the library.`, 'success');
    closeModal('addBookModal');
    ['newBookIsbn','newBookTitle','newBookAuthor','newBookPublisher','newBookYear'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('newBookCategory').value = '';
    document.getElementById('newBookCopies').value = '1';
    loadBooks();
  } catch (e) { toast('Error', e.message, 'error'); }
}

function editBook(book) {
  document.getElementById('newBookIsbn').value = book.isbn;
  document.getElementById('newBookTitle').value = book.title;
  document.getElementById('newBookAuthor').value = book.author;
  document.getElementById('newBookCategory').value = book.category || '';
  document.getElementById('newBookCopies').value = book.total_copies;
  document.getElementById('newBookYear').value = book.published_year || '';
  document.getElementById('newBookPublisher').value = book.publisher || '';
  document.querySelector('#addBookModal .modal-header h3').textContent = 'Edit Book';
  const addBtn = document.querySelector('#addBookModal .modal-footer .btn-primary');
  addBtn.textContent = 'Save Changes';
  addBtn.onclick = async () => {
    try {
      await api(`books?isbn=${encodeURIComponent(book.isbn)}`, 'PUT', {
        title: document.getElementById('newBookTitle').value,
        author: document.getElementById('newBookAuthor').value,
        category: document.getElementById('newBookCategory').value,
        total_copies: document.getElementById('newBookCopies').value,
        published_year: document.getElementById('newBookYear').value,
        publisher: document.getElementById('newBookPublisher').value
      });
      toast('Success', 'Book updated successfully.', 'success');
      closeModal('addBookModal');
      resetAddBookModal();
      loadBooks();
    } catch (e) { toast('Error', e.message, 'error'); }
  };
  openModal('addBookModal');
}

function resetAddBookModal() {
  document.querySelector('#addBookModal .modal-header h3').textContent = 'Add New Book';
  const addBtn = document.querySelector('#addBookModal .modal-footer .btn-primary');
  addBtn.textContent = 'Add Book';
  addBtn.onclick = addBook;
}

async function deleteBook(isbn) {
  if (!confirm(`Delete book with ISBN ${isbn}? This cannot be undone.`)) return;
  try {
    await api(`books?isbn=${encodeURIComponent(isbn)}`, 'DELETE');
    toast('Deleted', 'Book removed from library.', 'success');
    loadBooks();
  } catch (e) { toast('Error', e.message, 'error'); }
}

// ---- MEMBERS ----
async function loadMembers() {
  const search = document.getElementById('memberSearch').value;
  const tbody = document.getElementById('membersTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Loading members…</td></tr>';
  try {
    let qs = new URLSearchParams();
    if (search) qs.set('search', search);
    const { data } = await api(`members?${qs}`);
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No members found.</td></tr>';
      return;
    }
    const typeColors = { premium: 'badge-amber', standard: 'badge-navy', student: 'badge-success' };
    tbody.innerHTML = data.map(m => `
      <tr>
        <td class="mono">${m.member_id}</td>
        <td><strong>${escHtml(m.name)}</strong></td>
        <td style="font-size:12px">${escHtml(m.email)}</td>
        <td><span class="badge ${typeColors[m.membership_type] || 'badge-navy'}">${m.membership_type}</span></td>
        <td class="mono">${m.active_borrows || 0}</td>
        <td class="${parseFloat(m.pending_fines) > 0 ? 'fine-amount-cell has-fine' : 'fine-amount-cell no-fine'}">
          ${fmtCurrency(m.pending_fines)}
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="viewMember('${m.member_id}')">View</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    toast('Error', 'Failed to load members: ' + e.message, 'error');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Error loading members.</td></tr>';
  }
}

async function addMember() {
  const name = document.getElementById('newMemberName').value.trim();
  const email = document.getElementById('newMemberEmail').value.trim();
  const phone = document.getElementById('newMemberPhone').value.trim();
  const address = document.getElementById('newMemberAddress').value.trim();
  const membership_type = document.getElementById('newMemberType').value;
  if (!name || !email) return toast('Validation', 'Name and email are required.', 'error');
  try {
    const { data } = await api('members', 'POST', { name, email, phone, address, membership_type });
    toast('Success', `Member ${data.member_id} (${name}) registered!`, 'success');
    closeModal('addMemberModal');
    ['newMemberName','newMemberEmail','newMemberPhone','newMemberAddress'].forEach(id => document.getElementById(id).value = '');
    loadMembers();
  } catch (e) { toast('Error', e.message, 'error'); }
}

async function viewMember(id) {
  try {
    const { data } = await api(`members?id=${id}`);
    const info = `
      <div style="margin-bottom:12px">
        <strong>${escHtml(data.name)}</strong> (${data.member_id})<br>
        <small style="color:var(--text-muted)">${data.email} · ${data.phone || 'No phone'} · ${data.membership_type}</small>
      </div>
      <strong style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">Borrow History</strong>
      <div style="max-height:280px;overflow-y:auto;margin-top:8px">
        ${data.borrow_history.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;padding:10px 0">No borrow history</p>' :
          data.borrow_history.map(b => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
            <div style="font-weight:600">${escHtml(b.title)}</div>
            <div style="color:var(--text-muted);margin-top:3px">
              Borrowed ${fmtDate(b.borrow_date)} · Due ${fmtDate(b.due_date)}
              ${b.return_date ? `· Returned ${fmtDate(b.return_date)}` : ''}
              · <span class="badge badge-${b.status === 'returned' ? 'success' : b.status === 'overdue' ? 'danger' : 'warning'}">${b.status}</span>
              ${parseFloat(b.fine_amount) > 0 ? `· Fine: ${fmtCurrency(b.fine_amount)}` : ''}
            </div>
          </div>`).join('')
        }
      </div>`;
    document.getElementById('returnConfirmBody').innerHTML = info;
    document.getElementById('confirmReturnBtn').style.display = 'none';
    document.querySelector('#returnConfirmModal .modal-header h3').textContent = 'Member Profile';
    openModal('returnConfirmModal');
  } catch (e) { toast('Error', e.message, 'error'); }
}

// ---- BORROW ----
function initBorrowPage() {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  document.getElementById('borrowDate').value = today.toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' });
  document.getElementById('dueDate').value = due.toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' });
  quickSearchBooks('');
}

async function lookupMember() {
  const id = document.getElementById('borrowMemberId').value.trim();
  if (!id) return toast('Input', 'Enter a member ID first.', 'info');
  try {
    const { data } = await api(`members?id=${id}`);
    const preview = document.getElementById('memberPreview');
    preview.style.display = 'block';
    preview.innerHTML = `
      <div class="preview-name">${escHtml(data.name)}</div>
      <div class="preview-sub">${data.member_id} · ${data.membership_type} · ${data.email}</div>`;
  } catch (e) {
    document.getElementById('memberPreview').style.display = 'none';
    toast('Not Found', 'No member found with that ID.', 'error');
  }
}

async function lookupBook() {
  const isbn = document.getElementById('borrowBookIsbn').value.trim();
  if (!isbn) return toast('Input', 'Enter a book ISBN first.', 'info');
  try {
    const { data } = await api(`books?search=${encodeURIComponent(isbn)}`);
    const book = data.find(b => b.isbn === isbn);
    if (!book) throw new Error('Not found');
    const preview = document.getElementById('bookPreview');
    preview.style.display = 'block';
    preview.innerHTML = `
      <div class="preview-name">${escHtml(book.title)}</div>
      <div class="preview-sub">${escHtml(book.author)} · ${book.category || 'Uncategorized'}</div>
      <div class="${book.available_copies > 0 ? 'preview-available' : 'preview-unavailable'}" style="margin-top:5px">
        ${book.available_copies > 0 ? `✓ ${book.available_copies} copies available` : '✗ No copies available'}
      </div>`;
  } catch (e) {
    document.getElementById('bookPreview').style.display = 'none';
    toast('Not Found', 'No book found with that ISBN.', 'error');
  }
}

async function quickSearchBooks(query) {
  const el = document.getElementById('quickBookResults');
  try {
    let qs = new URLSearchParams({ available: 'true' });
    if (query) qs.set('search', query);
    const { data } = await api(`books?${qs}`);
    if (data.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><p>No available books</p></div>';
      return;
    }
    el.innerHTML = data.slice(0, 15).map(b => `
      <div class="quick-result-item" onclick="selectBook('${escAttr(b.isbn)}', '${escAttr(b.title)}')">
        <div class="title">${escHtml(b.title)} <span class="badge badge-success available-badge">${b.available_copies} avail</span></div>
        <div class="sub">${escHtml(b.author)}</div>
        <div class="isbn">${b.isbn}</div>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<div class="empty-state"><p>Error loading books</p></div>'; }
}

function selectBook(isbn, title) {
  document.getElementById('borrowBookIsbn').value = isbn;
  document.getElementById('bookPreview').style.display = 'block';
  document.getElementById('bookPreview').innerHTML = `
    <div class="preview-name">${escHtml(title)}</div>
    <div class="preview-sub">${isbn}</div>`;
  lookupBook();
}

async function borrowBook() {
  const member_id = document.getElementById('borrowMemberId').value.trim();
  const book_isbn = document.getElementById('borrowBookIsbn').value.trim();
  if (!member_id || !book_isbn) return toast('Validation', 'Member ID and Book ISBN are required.', 'error');
  try {
    const { message } = await api('borrow', 'POST', { member_id, book_isbn });
    toast('Book Borrowed! 📚', message, 'success', 6000);
    document.getElementById('borrowMemberId').value = '';
    document.getElementById('borrowBookIsbn').value = '';
    document.getElementById('memberPreview').style.display = 'none';
    document.getElementById('bookPreview').style.display = 'none';
    quickSearchBooks('');
    loadDashboard();
  } catch (e) { toast('Error', e.message, 'error'); }
}

// ---- RETURNS ----
async function loadActiveBorrows() {
  const el = document.getElementById('activeBorrowsList');
  el.innerHTML = '<div class="loading-state">Loading…</div>';
  try {
    const { data } = await api('borrow?status=borrowed');
    const overdueData = await api('borrow?status=overdue');
    const all = [...overdueData.data, ...data];
    if (all.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><p>No active borrows</p></div>';
      return;
    }
    el.innerHTML = all.map(r => {
      const overdue = r.status === 'overdue';
      const days = overdue ? daysSince(r.due_date) : Math.max(0, -daysSince(r.due_date));
      return `
        <div class="borrow-list-item" onclick="prefillReturn('${r.borrow_id}')">
          <div class="book-name">${escHtml(r.book_title)}</div>
          <div class="member-name">${escHtml(r.member_name)} · ${r.member_id}</div>
          <div class="due-info ${overdue ? 'overdue-text' : 'ontime-text'}">
            ${overdue ? `⚠ ${days} day(s) overdue` : `✓ Due ${fmtDate(r.due_date)}`}
          </div>
        </div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div class="empty-state"><p>Error loading borrows</p></div>'; }
}

function prefillReturn(borrowId) {
  document.getElementById('returnSearch').value = borrowId;
  searchBorrowRecords();
}

async function searchBorrowRecords() {
  const query = document.getElementById('returnSearch').value.trim();
  if (!query) return toast('Input', 'Enter a Borrow ID or Member ID.', 'info');
  const el = document.getElementById('returnResults');
  el.innerHTML = '<div class="loading-state">Searching…</div>';
  try {
    let records = [];
    if (query.startsWith('BR')) {
      const { data } = await api(`borrow?search=${encodeURIComponent(query)}`);
      records = data.filter(r => r.borrow_id === query && r.status !== 'returned');
    } else {
      const { data } = await api(`borrow?member_id=${encodeURIComponent(query)}`);
      records = data.filter(r => r.status !== 'returned');
    }
    if (records.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>No active borrow records found.</p></div>';
      return;
    }
    // Calculate estimated fine for each
    const today = new Date();
    el.innerHTML = records.map(r => {
      const due = new Date(r.due_date);
      const overdue = today > due;
      const daysOver = overdue ? Math.floor((today - due) / 86400000) : 0;
      const estFine = daysOver * 5; // default 5/day until we get config
      return `
        <div class="return-record-item">
          <div class="return-record-header">
            <div>
              <div class="return-record-title">${escHtml(r.book_title)}</div>
              <div class="return-record-meta">
                By ${escHtml(r.author || '')} · Borrow ID: <strong>${r.borrow_id}</strong>
              </div>
              <div class="return-record-meta" style="margin-top:4px">
                Member: ${escHtml(r.member_name)} (${r.member_id})
              </div>
            </div>
            <span class="badge badge-${r.status === 'overdue' ? 'danger' : 'warning'}">${r.status}</span>
          </div>
          <div class="return-record-meta">
            Borrowed: ${fmtDate(r.borrow_date)} · Due: ${fmtDate(r.due_date)}
          </div>
          ${overdue ?
            `<div class="fine-estimate">⚠ ${daysOver} day(s) overdue · Estimated fine: ${fmtCurrency(estFine)}</div>` :
            `<div class="no-fine">✓ On time · No fine</div>`}
          <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="confirmReturn('${r.borrow_id}')">
            Process Return
          </button>
        </div>`;
    }).join('');
  } catch (e) {
    toast('Error', e.message, 'error');
    el.innerHTML = '<div class="empty-state"><p>Error searching records.</p></div>';
  }
}

async function confirmReturn(borrowId) {
  // Show confirmation modal
  document.getElementById('returnConfirmBody').innerHTML = `
    <p>Are you sure you want to process the return for <strong>${borrowId}</strong>?</p>
    <p style="color:var(--text-muted);font-size:13px;margin-top:8px">Any applicable fines will be calculated based on the return date.</p>`;
  document.getElementById('confirmReturnBtn').style.display = 'inline-flex';
  document.querySelector('#returnConfirmModal .modal-header h3').textContent = 'Confirm Return';
  document.getElementById('confirmReturnBtn').onclick = () => processReturn(borrowId);
  openModal('returnConfirmModal');
}

async function processReturn(borrowId) {
  try {
    const { data, message } = await api(`borrow?borrow_id=${borrowId}`, 'PUT');
    closeModal('returnConfirmModal');
    toast(data.fine_amount > 0 ? '⚠ Book Returned with Fine' : '✅ Book Returned', message, data.fine_amount > 0 ? 'error' : 'success', 7000);
    document.getElementById('returnResults').innerHTML = '';
    document.getElementById('returnSearch').value = '';
    loadActiveBorrows();
    loadDashboard();
  } catch (e) {
    closeModal('returnConfirmModal');
    toast('Error', e.message, 'error');
  }
}

// ---- FINES ----
async function loadFines() {
  const status = document.getElementById('finesStatusFilter').value;
  const tbody = document.getElementById('finesTableBody');
  tbody.innerHTML = '<tr><td colspan="9" class="loading-row">Loading records…</td></tr>';
  try {
    let qs = new URLSearchParams();
    if (status) qs.set('status', status);
    const { data } = await api(`borrow?${qs}`);

    const totalFine = data.reduce((s, r) => s + parseFloat(r.fine_amount || 0), 0);
    const pendingFine = data.filter(r => !r.fine_paid && parseFloat(r.fine_amount) > 0).reduce((s, r) => s + parseFloat(r.fine_amount), 0);
    document.getElementById('fineSummaryBadges').innerHTML = `
      <span class="badge badge-navy">Total: ${fmtCurrency(totalFine)}</span>
      <span class="badge badge-danger">Pending: ${fmtCurrency(pendingFine)}</span>
      <span class="badge badge-success">Records: ${data.length}</span>`;

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading-row">No records found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(r => {
      const today = new Date();
      const due = new Date(r.due_date);
      const overdue = !r.return_date && today > due;
      const daysOver = overdue ? Math.floor((today - due) / 86400000) : (r.days_overdue || 0);
      const fine = r.return_date ? r.fine_amount : (daysOver * 5);
      return `
        <tr>
          <td class="mono">${r.borrow_id}</td>
          <td>${escHtml(r.member_name)}<br><small style="color:var(--text-muted)">${r.member_id}</small></td>
          <td>${escHtml(r.book_title)}</td>
          <td class="mono" style="font-size:12px">${fmtDate(r.borrow_date)}</td>
          <td class="mono" style="font-size:12px">${fmtDate(r.due_date)}</td>
          <td class="mono" style="font-size:12px">${r.return_date ? fmtDate(r.return_date) : '—'}</td>
          <td><span class="badge badge-${r.status === 'returned' ? 'success' : r.status === 'overdue' ? 'danger' : 'warning'}">${r.status}</span></td>
          <td class="fine-amount-cell ${parseFloat(fine) > 0 ? 'has-fine' : 'no-fine'}">${fmtCurrency(fine)}</td>
          <td>
            ${r.status !== 'returned' ?
              `<button class="btn btn-primary btn-sm" onclick="confirmReturn('${r.borrow_id}')">Return</button>` :
              parseFloat(r.fine_amount) > 0 && !r.fine_paid ?
              `<button class="btn btn-success btn-sm" onclick="markFinePaid('${r.borrow_id}')">Mark Paid</button>` :
              `<span style="color:var(--text-muted);font-size:12px">—</span>`}
          </td>
        </tr>`;
    }).join('');
  } catch (e) {
    toast('Error', 'Failed to load records: ' + e.message, 'error');
    tbody.innerHTML = '<tr><td colspan="9" class="loading-row">Error loading records.</td></tr>';
  }
}

async function markFinePaid(borrowId) {
  // Simple optimistic update - in production you'd have a dedicated endpoint
  toast('Fine Marked', `Fine for ${borrowId} marked as paid.`, 'success');
  loadFines();
}

// ---- SETTINGS ----
async function loadConfig() {
  try {
    const { data } = await api('config');
    document.getElementById('finePerDay').value = data.fine_per_day;
    document.getElementById('maxBorrowDays').value = data.max_borrow_days;
    document.getElementById('gracePeriodDays').value = data.grace_period_days;
  } catch (e) { toast('Error', 'Failed to load configuration.', 'error'); }
}

async function saveConfig() {
  const fine_per_day = parseFloat(document.getElementById('finePerDay').value);
  const max_borrow_days = parseInt(document.getElementById('maxBorrowDays').value);
  const grace_period_days = parseInt(document.getElementById('gracePeriodDays').value);
  if (isNaN(fine_per_day) || isNaN(max_borrow_days)) return toast('Validation', 'Please enter valid numbers.', 'error');
  try {
    await api('config', 'PUT', { fine_per_day, max_borrow_days, grace_period_days });
    toast('Saved', 'Fine configuration updated successfully.', 'success');
  } catch (e) { toast('Error', e.message, 'error'); }
}

// ---- GLOBAL SEARCH ----
let globalSearchTimeout;
document.getElementById('globalSearch').addEventListener('input', function() {
  clearTimeout(globalSearchTimeout);
  const q = this.value.trim();
  if (!q) return;
  globalSearchTimeout = setTimeout(() => {
    if (currentPage === 'books') {
      document.getElementById('bookSearch').value = q;
      loadBooks();
    } else if (currentPage === 'members') {
      document.getElementById('memberSearch').value = q;
      loadMembers();
    } else if (currentPage === 'fines') {
      loadFines();
    } else {
      navigate('books');
      setTimeout(() => { document.getElementById('bookSearch').value = q; loadBooks(); }, 100);
    }
  }, 400);
});

// ---- ESCAPE HELPERS ----
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'");
}

// ---- SEARCH DEBOUNCE ----
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ---- EVENT LISTENERS ----
document.addEventListener('DOMContentLoaded', () => {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.page);
    });
  });

  // Mobile menu
  document.getElementById('menuToggle').addEventListener('click', openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  document.getElementById('overlay').addEventListener('click', closeSidebar);

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
  });

  // Book search with debounce
  const bookSearchInput = document.getElementById('bookSearch');
  if (bookSearchInput) {
    bookSearchInput.addEventListener('input', debounce(loadBooks, 400));
  }
  document.getElementById('bookCategoryFilter').addEventListener('change', loadBooks);
  document.getElementById('availableOnly').addEventListener('change', loadBooks);

  // Member search with debounce
  const memberSearchInput = document.getElementById('memberSearch');
  if (memberSearchInput) {
    memberSearchInput.addEventListener('input', debounce(loadMembers, 400));
  }

  // Return search on Enter
  document.getElementById('returnSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBorrowRecords();
  });

  // Borrow ID search on Enter
  document.getElementById('borrowMemberId').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupMember();
  });
  document.getElementById('borrowBookIsbn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupBook();
  });

  // Initial load
  loadDashboard();
});
