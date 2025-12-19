let libraryState = {
    user: null,
    activeTab: 'catalog',
    books: [],
    loans: [],
    reservations: [],
    students: [],
    teachers: [],
    settings: { fineRatePerDay: 10, defaultLoanDays: 14 },
    returnContext: null
};

function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

function parseCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (e) {
        return null;
    }
}

async function ensureLibraryUser() {
    const authUser = firebase.auth().currentUser;
    const cached = parseCurrentUser();
    if (cached && authUser && cached.uid === authUser.uid) {
        libraryState.user = cached;
        return cached;
    }
    if (!authUser) {
        libraryState.user = cached;
        return cached;
    }

    let role = cached?.role || 'student';
    let name = cached?.name || (authUser.email ? authUser.email.split('@')[0] : 'User');
    try {
        const doc = await db.collection('users').doc(authUser.uid).get();
        if (doc.exists && doc.data()?.role) role = doc.data().role;
        if (doc.exists && doc.data()?.name) name = doc.data().name;
    } catch (e) { }

    const fresh = { uid: authUser.uid, email: authUser.email || '', role, name };
    localStorage.setItem('currentUser', JSON.stringify(fresh));
    libraryState.user = fresh;
    return fresh;
}

function roleLower(role) {
    return (role || '').toLowerCase();
}

function isStaffRole(role) {
    const r = roleLower(role);
    return r === 'owner' || r === 'admin' || r === 'principal' || r === 'teacher' || r === 'accountant' || r === 'clerk';
}

function isLibraryManager(role) {
    const r = roleLower(role);
    return r === 'owner' || r === 'admin' || r === 'principal' || r === 'clerk';
}

function escapeHtml(text) {
    return (text || '').toString().replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[ch]));
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    const form = modal.querySelector('form');
    if (form) form.reset();
    if (id === 'returnModal') libraryState.returnContext = null;
}

function addDaysISO(iso, days) {
    const base = iso ? new Date(iso + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + (Number(days) || 0));
    return base.toISOString().slice(0, 10);
}

function parseISODate(iso) {
    if (!iso) return null;
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
}

function daysBetween(dueISO, returnISO) {
    const due = parseISODate(dueISO);
    const ret = parseISODate(returnISO);
    if (!due || !ret) return 0;
    const ms = ret.getTime() - due.getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function formatTimestamp(ts) {
    if (!ts) return '-';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString();
    } catch (e) {
        return '-';
    }
}

function filterTenant(docs) {
    const tenantId = getTenantId();
    const scoped = docs.filter(d => d && d.tenantId === tenantId);
    return scoped.length ? scoped : docs;
}

async function fetchCollectionDocs(collectionName) {
    const snap = await db.collection(collectionName).get();
    const docs = [];
    snap.forEach(doc => docs.push({ id: doc.id, ...(doc.data() || {}) }));
    return filterTenant(docs);
}

function applyRoleGating() {
    const canManage = isLibraryManager(libraryState.user?.role);

    ['addBookBtn', 'issueLoanBtn', 'addReservationBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = canManage ? '' : 'none';
    });

    const settingsForm = document.getElementById('librarySettingsForm');
    if (settingsForm) {
        const submitBtn = settingsForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = !canManage;
        settingsForm.querySelectorAll('input').forEach(el => {
            if (!canManage) el.setAttribute('readonly', 'true');
            else el.removeAttribute('readonly');
        });
    }
}

function switchLibraryTab(tab) {
    const valid = ['catalog', 'loans', 'reservations', 'settings'];
    const target = valid.includes(tab) ? tab : 'catalog';
    libraryState.activeTab = target;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[onclick="switchLibraryTab('${target}')"]`);
    if (btn) btn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(div => div.classList.remove('active'));
    const content = document.getElementById(`${target}-tab`);
    if (content) content.classList.add('active');

    if (target === 'catalog') renderBooks();
    if (target === 'loans') renderLoans();
    if (target === 'reservations') renderReservations();
}

async function reloadLibrarySettings() {
    try {
        const tenantId = getTenantId();
        const doc = await db.collection('library_settings').doc(tenantId).get();
        const data = doc.exists ? (doc.data() || {}) : {};
        libraryState.settings = {
            fineRatePerDay: Number.isFinite(Number(data.fineRatePerDay)) ? Number(data.fineRatePerDay) : 10,
            defaultLoanDays: Number.isFinite(Number(data.defaultLoanDays)) ? Number(data.defaultLoanDays) : 14
        };

        const fineInput = document.getElementById('fineRatePerDay');
        const daysInput = document.getElementById('defaultLoanDays');
        if (fineInput) fineInput.value = String(libraryState.settings.fineRatePerDay);
        if (daysInput) daysInput.value = String(libraryState.settings.defaultLoanDays);
    } catch (err) {
        console.error(err);
        alert('Failed to load library settings.');
    }
}

async function saveLibrarySettings(e) {
    e.preventDefault();
    if (!isLibraryManager(libraryState.user?.role)) {
        alert('You do not have permission to update settings.');
        return;
}

async function loadBorrowers() {
    try {
        const [studentsSnap, teachersSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('teachers').get()
        ]);

        const students = [];
        studentsSnap.forEach(doc => {
            const s = doc.data() || {};
            const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || doc.id;
            const extra = [s.className, s.department, s.rollNumber].filter(Boolean).join(' / ');
            students.push({
                id: doc.id,
                tenantId: s.tenantId,
                name,
                label: extra ? `${name} (${extra})` : name
            });
        });

        const teachers = [];
        teachersSnap.forEach(doc => {
            const t = doc.data() || {};
            const name = `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.name || doc.id;
            const extra = [t.subject].filter(Boolean).join(' / ');
            teachers.push({
                id: doc.id,
                tenantId: t.tenantId,
                name,
                label: extra ? `${name} (${extra})` : name
            });
        });

        libraryState.students = filterTenant(students).sort((a, b) => a.label.localeCompare(b.label));
        libraryState.teachers = filterTenant(teachers).sort((a, b) => a.label.localeCompare(b.label));
    } catch (err) {
        console.error(err);
        alert('Failed to load borrowers.');
    }
}

function populateBorrowerSelect(selectEl, type) {
    if (!selectEl) return;
    const list = type === 'teacher' ? libraryState.teachers : libraryState.students;
    selectEl.innerHTML = list.length
        ? `<option value="">Select ${type === 'teacher' ? 'Teacher' : 'Student'}</option>` + list.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`).join('')
        : `<option value="">No borrowers found</option>`;
}

function populateIssueBorrowers() {
    const type = document.getElementById('issueBorrowerType')?.value || 'student';
    populateBorrowerSelect(document.getElementById('issueBorrower'), type);
}

function populateReservationBorrowers() {
    const type = document.getElementById('reservationBorrowerType')?.value || 'student';
    populateBorrowerSelect(document.getElementById('reservationBorrower'), type);
}

function populateBookSelect(selectEl, { onlyAvailable = false } = {}) {
    if (!selectEl) return;
    const books = (onlyAvailable ? libraryState.books.filter(b => Number(b.availableCopies || 0) > 0) : libraryState.books)
        .slice()
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    if (!books.length) {
        selectEl.innerHTML = '<option value="">No books found</option>';
        return;
    }

    selectEl.innerHTML = '<option value="">Select Book</option>' + books.map(b => {
        const avail = Number(b.availableCopies || 0);
        const total = Number(b.totalCopies || 0);
        const label = `${b.title || 'Untitled'} (${avail}/${total})${b.isbn ? ' - ' + b.isbn : ''}`;
        return `<option value="${escapeHtml(b.id)}">${escapeHtml(label)}</option>`;
    }).join('');
}

async function loadBooks() {
    try {
        libraryState.books = (await fetchCollectionDocs('library_books'))
            .map(b => ({
                ...b,
                totalCopies: Number.isFinite(Number(b.totalCopies)) ? Number(b.totalCopies) : 0,
                availableCopies: Number.isFinite(Number(b.availableCopies)) ? Number(b.availableCopies) : 0
            }))
            .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        renderBooks();
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('booksBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="muted">Failed to load books.</td></tr>';
    }
}

function renderBooks() {
    const tbody = document.getElementById('booksBody');
    if (!tbody) return;

    const query = (document.getElementById('bookSearch')?.value || '').trim().toLowerCase();
    const canManage = isLibraryManager(libraryState.user?.role);

    const books = libraryState.books.filter(b => {
        if (!query) return true;
        const hay = `${b.title || ''} ${b.author || ''} ${b.isbn || ''}`.toLowerCase();
        return hay.includes(query);
    });

    if (!books.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="muted">No books found.</td></tr>';
        return;
    }

    tbody.innerHTML = books.map(b => {
        const avail = Number(b.availableCopies || 0);
        const total = Number(b.totalCopies || 0);
        let badge = 'badge-off';
        if (avail > 1) badge = 'badge-ok';
        else if (avail === 1) badge = 'badge-warn';
        const copiesHtml = `<span class="badge ${badge}">${avail}/${total}</span>`;

        const actions = canManage
            ? `<button class="btn-sm" onclick="editBook('${b.id}')">Edit</button>
               <button class="btn-sm" onclick="deleteBook('${b.id}')">Delete</button>`
            : `<span class="muted">Read-only</span>`;

        return `
            <tr>
                <td>${escapeHtml(b.title || '')}</td>
                <td>${escapeHtml(b.author || '')}</td>
                <td>${escapeHtml(b.isbn || '')}</td>
                <td>${copiesHtml}</td>
                <td>${escapeHtml(b.category || '')}</td>
                <td>${escapeHtml(b.shelf || '')}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

function openBookModal() {
    if (!isLibraryManager(libraryState.user?.role)) return alert('Read-only access.');
    const form = document.getElementById('bookForm');
    if (form) form.reset();
    const title = document.getElementById('bookModalTitle');
    if (title) title.innerText = 'Add Book';
    openModal('bookModal');
}

function editBook(id) {
    if (!isLibraryManager(libraryState.user?.role)) return;
    const book = libraryState.books.find(b => b.id === id);
    if (!book) return;

    const form = document.getElementById('bookForm');
    if (!form) return;
    form.querySelector('input[name="docId"]').value = id;
    document.getElementById('bookIsbn').value = book.isbn || '';
    document.getElementById('bookTitle').value = book.title || '';
    document.getElementById('bookAuthor').value = book.author || '';
    document.getElementById('bookPublisher').value = book.publisher || '';
    document.getElementById('bookYear').value = book.year || '';
    document.getElementById('bookCategory').value = book.category || '';
    document.getElementById('bookLanguage').value = book.language || '';
    document.getElementById('bookShelf').value = book.shelf || '';
    document.getElementById('bookTotalCopies').value = String(Number(book.totalCopies || 0));

    const title = document.getElementById('bookModalTitle');
    if (title) title.innerText = 'Edit Book';
    openModal('bookModal');
}

async function saveBook(e) {
    e.preventDefault();
    if (!isLibraryManager(libraryState.user?.role)) return alert('You do not have permission to modify the catalog.');

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const formData = new FormData(e.target);
        const docId = (formData.get('docId') || '').toString();

        const isbn = (formData.get('isbn') || '').toString().trim();
        const title = (formData.get('title') || '').toString().trim();
        const author = (formData.get('author') || '').toString().trim();
        const publisher = (formData.get('publisher') || '').toString().trim();
        const year = (formData.get('year') || '').toString().trim();
        const category = (formData.get('category') || '').toString().trim();
        const language = (formData.get('language') || '').toString().trim();
        const shelf = (formData.get('shelf') || '').toString().trim();
        const totalCopies = Math.max(0, Math.floor(Number(formData.get('totalCopies') || 0)));

        if (!title || !author) return alert('Title and Author are required.');

        const tenantId = getTenantId();
        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');

        if (docId) {
            const bookRef = db.collection('library_books').doc(docId);
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(bookRef);
                if (!snap.exists) throw new Error('Book not found.');
                const prev = snap.data() || {};
                const prevTotal = Number(prev.totalCopies || 0);
                const prevAvail = Number(prev.availableCopies || 0);
                const borrowed = Math.max(0, prevTotal - prevAvail);
                if (totalCopies < borrowed) throw new Error(`Cannot set total copies below borrowed copies (${borrowed}).`);
                const nextAvail = Math.max(0, totalCopies - borrowed);
                tx.set(bookRef, {
                    isbn, title, author, publisher, year, category, language, shelf,
                    totalCopies,
                    availableCopies: nextAvail,
                    tenantId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: uid
                }, { merge: true });
            });
            if (typeof logAudit === 'function') logAudit('library_book_update', `library_books/${docId}`, { title, isbn, totalCopies });
        } else {
            const ref = await db.collection('library_books').add({
                isbn, title, author, publisher, year, category, language, shelf,
                totalCopies,
                availableCopies: totalCopies,
                tenantId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            });
            if (typeof logAudit === 'function') logAudit('library_book_create', `library_books/${ref.id}`, { title, isbn, totalCopies });
        }

        closeModal('bookModal');
        await loadBooks();
        populateBookSelect(document.getElementById('issueBook'), { onlyAvailable: true });
        populateBookSelect(document.getElementById('reservationBook'), { onlyAvailable: false });
    } catch (err) {
        console.error(err);
        alert('Failed to save book: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function deleteBook(id) {
    if (!isLibraryManager(libraryState.user?.role)) return;
    const book = libraryState.books.find(b => b.id === id);
    if (!book) return;

    const borrowed = Math.max(0, Number(book.totalCopies || 0) - Number(book.availableCopies || 0));
    if (borrowed > 0) return alert('Cannot delete a book that has active loans.');
    if (!confirm(`Delete "${book.title || 'this book'}"?`)) return;

    try {
        await db.collection('library_books').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('library_book_delete', `library_books/${id}`, { title: book.title || '' });
        await loadBooks();
    } catch (err) {
        console.error(err);
        alert('Failed to delete: ' + (err.message || err));
    }
}

async function lookupIsbn() {
    if (!isLibraryManager(libraryState.user?.role)) return;
    const isbn = (document.getElementById('bookIsbn')?.value || '').trim();
    if (!isbn) return alert('Enter an ISBN first.');

    const btn = document.getElementById('isbnLookupBtn');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Looking...'; }

    try {
        const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
        const data = await res.json();
        const record = data[`ISBN:${isbn}`];
        if (!record) throw new Error('No record found for this ISBN.');

        const title = record.title || '';
        const author = Array.isArray(record.authors) ? record.authors.map(a => a?.name).filter(Boolean).join(', ') : '';
        const publisher = Array.isArray(record.publishers) ? record.publishers.map(p => p?.name).filter(Boolean).join(', ') : '';
        const publishDate = record.publish_date || '';
        const yearMatch = publishDate.match(/\\b(19|20)\\d{2}\\b/);
        const year = yearMatch ? yearMatch[0] : '';

        if (title) document.getElementById('bookTitle').value = title;
        if (author) document.getElementById('bookAuthor').value = author;
        if (publisher) document.getElementById('bookPublisher').value = publisher;
        if (year) document.getElementById('bookYear').value = year;
    } catch (err) {
        console.error(err);
        alert('ISBN lookup failed: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function loadLoans() {
    try {
        libraryState.loans = await fetchCollectionDocs('library_loans');
        renderLoans();
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('loansBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="muted">Failed to load loans.</td></tr>';
    }
}

function loanIsReturned(l) {
    const status = (l.status || '').toLowerCase();
    return status === 'returned' || !!l.returnDate;
}

function loanIsOverdue(l) {
    if (loanIsReturned(l)) return false;
    const due = parseISODate(l.dueDate);
    if (!due) return false;
    const today = parseISODate(todayISO());
    return today && due.getTime() < today.getTime();
}

function renderLoans() {
    const tbody = document.getElementById('loansBody');
    if (!tbody) return;

    const filter = (document.getElementById('loanFilter')?.value || 'all').toLowerCase();
    const canManage = isLibraryManager(libraryState.user?.role);

    let loans = libraryState.loans.slice();
    if (filter === 'active') loans = loans.filter(l => !loanIsReturned(l));
    if (filter === 'returned') loans = loans.filter(l => loanIsReturned(l));
    if (filter === 'overdue') loans = loans.filter(l => loanIsOverdue(l));
    loans.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (!loans.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="muted">No loans found.</td></tr>';
        return;
    }

    const today = todayISO();
    const rate = Number.isFinite(Number(libraryState.settings.fineRatePerDay)) ? Number(libraryState.settings.fineRatePerDay) : 10;

    tbody.innerHTML = loans.map(l => {
        const returned = loanIsReturned(l);
        const overdue = loanIsOverdue(l);
        const statusBadge = returned
            ? `<span class="badge badge-ok">Returned</span>`
            : overdue
                ? `<span class="badge badge-off">Overdue</span>`
                : `<span class="badge badge-info">Active</span>`;

        const fineDays = returned ? daysBetween(l.dueDate, l.returnDate) : daysBetween(l.dueDate, today);
        const computedFine = Math.max(0, fineDays * rate);
        const storedFine = Number.isFinite(Number(l.fineAmount)) ? Number(l.fineAmount) : null;
        const fineAmount = returned ? (storedFine ?? computedFine) : computedFine;
        const finePaid = !!l.finePaid;

        const fineHtml = fineAmount > 0
            ? returned
                ? `${escapeHtml(String(fineAmount))} ${finePaid ? '<span class=\"badge badge-ok\">Paid</span>' : '<span class=\"badge badge-warn\">Unpaid</span>'}`
                : `${escapeHtml(String(fineAmount))} <span class=\"badge badge-warn\">Accruing</span>`
            : '<span class="muted">-</span>';

        let actions = '<span class="muted">-</span>';
        if (canManage) {
            const btns = [];
            if (!returned) btns.push(`<button class="btn-sm" onclick="openReturnModal('${l.id}')">Return</button>`);
            if (returned && fineAmount > 0 && !finePaid) btns.push(`<button class="btn-sm" onclick="markFinePaid('${l.id}')">Mark Paid</button>`);
            actions = btns.length ? btns.join(' ') : '<span class="muted">-</span>';
        }

        const borrower = l.borrowerLabel || l.borrowerName || l.borrowerId || '';
        const bookLabel = l.bookLabel || l.bookTitle || l.bookId || '';

        return `
            <tr>
                <td>${escapeHtml(bookLabel)}</td>
                <td>${escapeHtml(borrower)}</td>
                <td>${escapeHtml(l.issueDate || '-')}</td>
                <td>${escapeHtml(l.dueDate || '-')}</td>
                <td>${statusBadge}</td>
                <td>${fineHtml}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

function openIssueModal() {
    if (!isLibraryManager(libraryState.user?.role)) return alert('Read-only access.');
    const form = document.getElementById('issueForm');
    if (form) form.reset();

    populateIssueBorrowers();
    populateBookSelect(document.getElementById('issueBook'), { onlyAvailable: true });

    const base = todayISO();
    const issueDate = document.getElementById('issueDate');
    const dueDate = document.getElementById('dueDate');
    if (issueDate) issueDate.value = base;
    if (dueDate) dueDate.value = addDaysISO(base, libraryState.settings.defaultLoanDays || 14);

    openModal('issueModal');
}

async function issueBook(e) {
    e.preventDefault();
    if (!isLibraryManager(libraryState.user?.role)) return alert('You do not have permission to issue loans.');

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Issuing...'; }

    try {
        const borrowerType = document.getElementById('issueBorrowerType').value;
        const borrowerId = document.getElementById('issueBorrower').value;
        const bookId = document.getElementById('issueBook').value;
        const issueDateVal = document.getElementById('issueDate').value;
        const dueDateVal = document.getElementById('dueDate').value;
        const notes = (document.getElementById('issueNotes').value || '').trim();

        if (!borrowerId || !bookId || !issueDateVal || !dueDateVal) return alert('Please complete all required fields.');

        const borrowerList = borrowerType === 'teacher' ? libraryState.teachers : libraryState.students;
        const borrower = borrowerList.find(b => b.id === borrowerId);
        const borrowerLabel = borrower?.label || borrowerId;

        const book = libraryState.books.find(b => b.id === bookId);
        const bookLabel = book ? `${book.title || 'Untitled'}${book.isbn ? ' - ' + book.isbn : ''}` : bookId;
        const tenantId = getTenantId();
        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');

        const loanRef = db.collection('library_loans').doc();
        const bookRef = db.collection('library_books').doc(bookId);

        await db.runTransaction(async (tx) => {
            const bookSnap = await tx.get(bookRef);
            if (!bookSnap.exists) throw new Error('Book not found.');
            const b = bookSnap.data() || {};
            const avail = Number(b.availableCopies || 0);
            if (avail <= 0) throw new Error('No copies available for this book.');
            tx.update(bookRef, {
                availableCopies: avail - 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            });
            tx.set(loanRef, {
                bookId,
                bookTitle: b.title || (book?.title || ''),
                bookIsbn: b.isbn || (book?.isbn || ''),
                bookLabel,
                borrowerType,
                borrowerId,
                borrowerName: borrower?.name || '',
                borrowerLabel,
                issueDate: issueDateVal,
                dueDate: dueDateVal,
                returnDate: '',
                status: 'issued',
                fineAmount: 0,
                finePaid: false,
                notes,
                tenantId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            });
        });

        if (typeof logAudit === 'function') logAudit('library_loan_issue', `library_loans/${loanRef.id}`, { bookId, borrowerId, borrowerType });
        closeModal('issueModal');
        await Promise.all([loadBooks(), loadLoans()]);
    } catch (err) {
        console.error(err);
        alert('Failed to issue: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

function openReturnModal(loanId) {
    if (!isLibraryManager(libraryState.user?.role)) return;
    const loan = libraryState.loans.find(l => l.id === loanId);
    if (!loan) return;

    libraryState.returnContext = loan;
    document.getElementById('returnLoanId').value = loanId;

    const base = todayISO();
    const returnDate = document.getElementById('returnDate');
    const rate = document.getElementById('returnFineRate');
    const paid = document.getElementById('returnFinePaid');
    if (returnDate) returnDate.value = base;
    if (rate) rate.value = String(libraryState.settings.fineRatePerDay || 10);
    if (paid) paid.checked = false;

    const summary = document.getElementById('returnSummary');
    if (summary) {
        const borrower = loan.borrowerLabel || loan.borrowerName || loan.borrowerId || '';
        const bookLabel = loan.bookLabel || loan.bookTitle || loan.bookId || '';
        summary.innerHTML = `<div><strong>Book:</strong> ${escapeHtml(bookLabel)}</div>
            <div><strong>Borrower:</strong> ${escapeHtml(borrower)}</div>
            <div><strong>Issued:</strong> ${escapeHtml(loan.issueDate || '-')} &nbsp; <strong>Due:</strong> ${escapeHtml(loan.dueDate || '-')}</div>`;
    }

    recalcReturnFine();
    openModal('returnModal');
}

function recalcReturnFine() {
    const loan = libraryState.returnContext;
    if (!loan) return;
    const returnISO = document.getElementById('returnDate')?.value || todayISO();
    const rate = Math.max(0, Math.floor(Number(document.getElementById('returnFineRate')?.value || 0)));
    const overdueDays = daysBetween(loan.dueDate, returnISO);
    const fine = overdueDays * rate;
    const amountEl = document.getElementById('returnFineAmount');
    if (amountEl) amountEl.value = String(fine);
}

async function confirmReturn(e) {
    e.preventDefault();
    if (!isLibraryManager(libraryState.user?.role)) return alert('You do not have permission to return loans.');

    const loan = libraryState.returnContext;
    if (!loan) return alert('Loan not found.');
    const loanId = document.getElementById('returnLoanId').value;

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const returnDateVal = document.getElementById('returnDate').value;
        const fineAmount = Math.max(0, Math.floor(Number(document.getElementById('returnFineAmount').value || 0)));
        const finePaid = !!document.getElementById('returnFinePaid').checked;
        const notes = (document.getElementById('returnNotes').value || '').trim();

        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');
        const loanRef = db.collection('library_loans').doc(loanId);
        const bookRef = db.collection('library_books').doc(loan.bookId);

        await db.runTransaction(async (tx) => {
            const loanSnap = await tx.get(loanRef);
            if (!loanSnap.exists) throw new Error('Loan not found.');
            const loanData = loanSnap.data() || {};
            const alreadyReturned = (loanData.status || '').toLowerCase() === 'returned' || !!loanData.returnDate;
            if (alreadyReturned) throw new Error('This loan is already returned.');

            const bookSnap = await tx.get(bookRef);
            if (bookSnap.exists) {
                const b = bookSnap.data() || {};
                const avail = Number(b.availableCopies || 0);
                const total = Number(b.totalCopies || 0);
                const nextAvail = total > 0 ? Math.min(total, avail + 1) : (avail + 1);
                tx.update(bookRef, {
                    availableCopies: nextAvail,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: uid
                });
            }

            const updates = {
                status: 'returned',
                returnDate: returnDateVal,
                returnedAt: firebase.firestore.FieldValue.serverTimestamp(),
                returnedBy: uid,
                fineAmount,
                finePaid,
                notes,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            };
            updates.finePaidAt = (finePaid && fineAmount > 0)
                ? firebase.firestore.FieldValue.serverTimestamp()
                : firebase.firestore.FieldValue.delete();
            tx.set(loanRef, updates, { merge: true });
        });

        if (typeof logAudit === 'function') logAudit('library_loan_return', `library_loans/${loanId}`, { bookId: loan.bookId, fineAmount, finePaid });
        closeModal('returnModal');
        await Promise.all([loadBooks(), loadLoans()]);
    } catch (err) {
        console.error(err);
        alert('Failed to return: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function markFinePaid(loanId) {
    if (!isLibraryManager(libraryState.user?.role)) return;
    if (!confirm('Mark fine as paid?')) return;

    try {
        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');
        await db.collection('library_loans').doc(loanId).set({
            finePaid: true,
            finePaidAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        }, { merge: true });
        if (typeof logAudit === 'function') logAudit('library_fine_paid', `library_loans/${loanId}`, {});
        await loadLoans();
    } catch (err) {
        console.error(err);
        alert('Failed to update fine: ' + (err.message || err));
    }
}

async function loadReservations() {
    try {
        libraryState.reservations = await fetchCollectionDocs('library_reservations');
        renderReservations();
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('reservationsBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="muted">Failed to load reservations.</td></tr>';
    }
}

function reservationStatusBadge(status) {
    const s = (status || '').toLowerCase();
    if (s === 'fulfilled') return '<span class="badge badge-ok">Fulfilled</span>';
    if (s === 'cancelled') return '<span class="badge badge-off">Cancelled</span>';
    return '<span class="badge badge-info">Active</span>';
}

function renderReservations() {
    const tbody = document.getElementById('reservationsBody');
    if (!tbody) return;
    const canManage = isLibraryManager(libraryState.user?.role);

    const reservations = libraryState.reservations
        .slice()
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (!reservations.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="muted">No reservations found.</td></tr>';
        return;
    }

    tbody.innerHTML = reservations.map(r => {
        const status = (r.status || 'active').toLowerCase();
        const borrower = r.borrowerLabel || r.borrowerName || r.borrowerId || '';
        const bookLabel = r.bookLabel || r.bookTitle || r.bookId || '';
        const created = r.createdAt ? formatTimestamp(r.createdAt) : '-';
        const expires = r.expiresOn || '-';

        let actions = '<span class="muted">-</span>';
        if (canManage) {
            const btns = [];
            if (status === 'active') {
                btns.push(`<button class="btn-sm" onclick="fulfillReservation('${r.id}')">Fulfill</button>`);
                btns.push(`<button class="btn-sm" onclick="cancelReservation('${r.id}')">Cancel</button>`);
            } else if (status === 'cancelled') {
                btns.push(`<button class="btn-sm" onclick="editReservation('${r.id}')">Edit</button>`);
            }
            if (btns.length) actions = btns.join(' ');
        }

        return `
            <tr>
                <td>${escapeHtml(bookLabel)}</td>
                <td>${escapeHtml(borrower)}</td>
                <td>${reservationStatusBadge(status)}</td>
                <td>${escapeHtml(created)}</td>
                <td>${escapeHtml(expires)}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

function openReservationModal() {
    if (!isLibraryManager(libraryState.user?.role)) return alert('Read-only access.');
    const form = document.getElementById('reservationForm');
    if (form) form.reset();
    const idField = document.querySelector('#reservationForm input[name="docId"]');
    if (idField) idField.value = '';
    const statusEl = document.getElementById('reservationStatus');
    if (statusEl) statusEl.value = 'active';

    populateReservationBorrowers();
    populateBookSelect(document.getElementById('reservationBook'), { onlyAvailable: false });

    const expiresEl = document.getElementById('reservationExpiresOn');
    if (expiresEl) expiresEl.value = addDaysISO(todayISO(), 7);

    openModal('reservationModal');
}

function editReservation(id) {
    if (!isLibraryManager(libraryState.user?.role)) return;
    const r = libraryState.reservations.find(x => x.id === id);
    if (!r) return;

    const form = document.getElementById('reservationForm');
    if (!form) return;
    form.querySelector('input[name="docId"]').value = id;

    document.getElementById('reservationBorrowerType').value = r.borrowerType || 'student';
    populateReservationBorrowers();
    document.getElementById('reservationBorrower').value = r.borrowerId || '';

    populateBookSelect(document.getElementById('reservationBook'), { onlyAvailable: false });
    document.getElementById('reservationBook').value = r.bookId || '';
    document.getElementById('reservationExpiresOn').value = r.expiresOn || addDaysISO(todayISO(), 7);
    document.getElementById('reservationStatus').value = (r.status || 'active').toLowerCase();
    document.getElementById('reservationNotes').value = r.notes || '';

    openModal('reservationModal');
}

async function saveReservation(e) {
    e.preventDefault();
    if (!isLibraryManager(libraryState.user?.role)) return alert('You do not have permission to manage reservations.');

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const formData = new FormData(e.target);
        const docId = (formData.get('docId') || '').toString();
        const borrowerType = document.getElementById('reservationBorrowerType').value;
        const borrowerId = document.getElementById('reservationBorrower').value;
        const bookId = document.getElementById('reservationBook').value;
        const expiresOn = document.getElementById('reservationExpiresOn').value;
        const status = document.getElementById('reservationStatus').value;
        const notes = (document.getElementById('reservationNotes').value || '').trim();

        if (!borrowerId || !bookId || !expiresOn) return alert('Please complete all required fields.');

        const borrowerList = borrowerType === 'teacher' ? libraryState.teachers : libraryState.students;
        const borrower = borrowerList.find(b => b.id === borrowerId);
        const borrowerLabel = borrower?.label || borrowerId;

        const book = libraryState.books.find(b => b.id === bookId);
        const bookLabel = book ? `${book.title || 'Untitled'}${book.isbn ? ' - ' + book.isbn : ''}` : bookId;

        const tenantId = getTenantId();
        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');

        const payload = {
            borrowerType,
            borrowerId,
            borrowerName: borrower?.name || '',
            borrowerLabel,
            bookId,
            bookTitle: book?.title || '',
            bookIsbn: book?.isbn || '',
            bookLabel,
            status: (status || 'active').toLowerCase(),
            expiresOn,
            notes,
            tenantId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        if (docId) {
            await db.collection('library_reservations').doc(docId).set(payload, { merge: true });
            if (typeof logAudit === 'function') logAudit('library_reservation_update', `library_reservations/${docId}`, { bookId, borrowerId, status: payload.status });
        } else {
            const ref = await db.collection('library_reservations').add({
                ...payload,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid
            });
            if (typeof logAudit === 'function') logAudit('library_reservation_create', `library_reservations/${ref.id}`, { bookId, borrowerId });
        }

        closeModal('reservationModal');
        await loadReservations();
    } catch (err) {
        console.error(err);
        alert('Failed to save reservation: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function cancelReservation(id) {
    if (!isLibraryManager(libraryState.user?.role)) return;
    if (!confirm('Cancel this reservation?')) return;
    try {
        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');
        await db.collection('library_reservations').doc(id).set({
            status: 'cancelled',
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        }, { merge: true });
        if (typeof logAudit === 'function') logAudit('library_reservation_cancel', `library_reservations/${id}`, {});
        await loadReservations();
    } catch (err) {
        console.error(err);
        alert('Failed to cancel: ' + (err.message || err));
    }
}

async function fulfillReservation(id) {
    if (!isLibraryManager(libraryState.user?.role)) return;
    const resv = libraryState.reservations.find(r => r.id === id);
    if (!resv) return;
    if ((resv.status || 'active').toLowerCase() !== 'active') return;

    if (!confirm('Fulfill this reservation and issue the book now?')) return;

    try {
        const tenantId = getTenantId();
        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');

        const resvRef = db.collection('library_reservations').doc(id);
        const bookRef = db.collection('library_books').doc(resv.bookId);
        const loanRef = db.collection('library_loans').doc();

        const issueDateVal = todayISO();
        const dueDateVal = addDaysISO(issueDateVal, libraryState.settings.defaultLoanDays || 14);

        await db.runTransaction(async (tx) => {
            const resvSnap = await tx.get(resvRef);
            if (!resvSnap.exists) throw new Error('Reservation not found.');
            const r = resvSnap.data() || {};
            if ((r.status || 'active').toLowerCase() !== 'active') throw new Error('Reservation is not active.');

            const bookSnap = await tx.get(bookRef);
            if (!bookSnap.exists) throw new Error('Book not found.');
            const b = bookSnap.data() || {};
            const avail = Number(b.availableCopies || 0);
            if (avail <= 0) throw new Error('No copies available to fulfill this reservation.');

            tx.update(bookRef, {
                availableCopies: avail - 1,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            });

            const bookLabel = `${b.title || 'Untitled'}${b.isbn ? ' - ' + b.isbn : ''}`;
            tx.set(loanRef, {
                bookId: resv.bookId,
                bookTitle: b.title || '',
                bookIsbn: b.isbn || '',
                bookLabel,
                borrowerType: r.borrowerType || resv.borrowerType || 'student',
                borrowerId: r.borrowerId || resv.borrowerId || '',
                borrowerName: r.borrowerName || resv.borrowerName || '',
                borrowerLabel: r.borrowerLabel || resv.borrowerLabel || '',
                issueDate: issueDateVal,
                dueDate: dueDateVal,
                returnDate: '',
                status: 'issued',
                fineAmount: 0,
                finePaid: false,
                notes: r.notes || '',
                tenantId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            });

            tx.set(resvRef, {
                status: 'fulfilled',
                fulfilledAt: firebase.firestore.FieldValue.serverTimestamp(),
                loanId: loanRef.id,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: uid
            }, { merge: true });
        });

        if (typeof logAudit === 'function') logAudit('library_reservation_fulfill', `library_reservations/${id}`, { loanId: loanRef.id });
        await Promise.all([loadBooks(), loadLoans(), loadReservations()]);
    } catch (err) {
        console.error(err);
        alert('Failed to fulfill: ' + (err.message || err));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const bookForm = document.getElementById('bookForm');
    if (bookForm) bookForm.addEventListener('submit', saveBook);

    const issueForm = document.getElementById('issueForm');
    if (issueForm) issueForm.addEventListener('submit', issueBook);

    const returnForm = document.getElementById('returnForm');
    if (returnForm) returnForm.addEventListener('submit', confirmReturn);

    const reservationForm = document.getElementById('reservationForm');
    if (reservationForm) reservationForm.addEventListener('submit', saveReservation);

    const settingsForm = document.getElementById('librarySettingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', saveLibrarySettings);

    const search = document.getElementById('bookSearch');
    if (search && !search.dataset.wired) {
        search.addEventListener('input', renderBooks);
        search.dataset.wired = '1';
    }

    const loanFilter = document.getElementById('loanFilter');
    if (loanFilter && !loanFilter.dataset.wired) {
        loanFilter.addEventListener('change', renderLoans);
        loanFilter.dataset.wired = '1';
    }

    const issueBorrowerType = document.getElementById('issueBorrowerType');
    if (issueBorrowerType && !issueBorrowerType.dataset.wired) {
        issueBorrowerType.addEventListener('change', populateIssueBorrowers);
        issueBorrowerType.dataset.wired = '1';
    }

    const resBorrowerType = document.getElementById('reservationBorrowerType');
    if (resBorrowerType && !resBorrowerType.dataset.wired) {
        resBorrowerType.addEventListener('change', populateReservationBorrowers);
        resBorrowerType.dataset.wired = '1';
    }

    const returnDate = document.getElementById('returnDate');
    if (returnDate && !returnDate.dataset.wired) {
        returnDate.addEventListener('change', recalcReturnFine);
        returnDate.dataset.wired = '1';
    }

    const returnRate = document.getElementById('returnFineRate');
    if (returnRate && !returnRate.dataset.wired) {
        returnRate.addEventListener('input', recalcReturnFine);
        returnRate.dataset.wired = '1';
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) return;

        const current = await ensureLibraryUser();
        if (!isStaffRole(current?.role)) {
            alert('Library module is available to staff only.');
            window.location.href = '../../dashboard.html';
            return;
        }

        await reloadLibrarySettings();
        applyRoleGating();

        await Promise.all([loadBorrowers(), loadBooks(), loadLoans(), loadReservations()]);
        switchLibraryTab('catalog');
    });
});

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const fineRatePerDay = Number(document.getElementById('fineRatePerDay').value || 0);
        const defaultLoanDays = Number(document.getElementById('defaultLoanDays').value || 14);
        const tenantId = getTenantId();
        const uid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : (libraryState.user?.uid || '');

        const payload = {
            fineRatePerDay: Math.max(0, Math.floor(fineRatePerDay)),
            defaultLoanDays: Math.max(1, Math.floor(defaultLoanDays)),
            tenantId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        };

        await db.collection('library_settings').doc(tenantId).set(payload, { merge: true });
        if (typeof logAudit === 'function') logAudit('library_settings_update', `library_settings/${tenantId}`, payload);
        await reloadLibrarySettings();
        alert('Settings saved.');
    } catch (err) {
        console.error(err);
        alert('Failed to save settings: ' + (err.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}
