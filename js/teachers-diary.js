const diaryState = {
    currentUser: null,
    tenantId: '',
    classes: [],
    subjects: [], // Loaded once on init
    entries: [], // Active list of diary entries for the selected date
    isSaving: false
};

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('diaryGridBody')) return;

    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(async (user) => {
            if (!user) return;

            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (!currentUser.uid) {
                currentUser.uid = user.uid;
                currentUser.email = user.email;
                currentUser.name = user.displayName || user.email;
            }
            diaryState.currentUser = currentUser;
            diaryState.tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');

            if (typeof initDashboard === 'function') {
                initDashboard(currentUser);
            }

            const roles = getUserRoles(currentUser);
            const allowed = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat', 'teacher'].includes(role));
            
            document.getElementById('teachersDiaryAccessDenied').style.display = allowed ? 'none' : 'block';
            document.getElementById('teachersDiaryContent').style.display = allowed ? 'block' : 'none';
            
            if (!allowed) return;

            // Set default date
            const dateInput = document.getElementById('diaryDate');
            if (dateInput && !dateInput.value) {
                dateInput.value = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
            }

            // Load static resources
            await Promise.all([loadDiaryClasses(), loadDiarySubjects()]);

            // Bind Event Listeners
            bindDiaryEvents();

            // Fetch and render existing logs
            await fetchDiaryEntries();
        });
    }
});

function bindDiaryEvents() {
    document.getElementById('diaryDate')?.addEventListener('change', fetchDiaryEntries);
    document.getElementById('addDiaryRowBtn')?.addEventListener('click', addNewDiaryRow);
    document.getElementById('saveDiaryBtn')?.addEventListener('click', saveDiaryEntries);
}

// Load all classes under this tenant
async function loadDiaryClasses() {
    try {
        let snapshot = await db.collection('classes')
            .where('tenantId', '==', diaryState.tenantId)
            .get();
        if (snapshot.empty) {
            snapshot = await db.collection('classes').get();
        }
        
        diaryState.classes = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            diaryState.classes.push({ id: doc.id, ...data });
        });
        
        // Sort classes alphabetically
        diaryState.classes.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    } catch (err) {
        console.error('Error loading diary classes:', err);
    }
}

// Load all subjects under this tenant once
async function loadDiarySubjects() {
    try {
        let snapshot = await db.collection('subjects')
            .where('tenantId', '==', diaryState.tenantId)
            .get();
        if (snapshot.empty) {
            snapshot = await db.collection('subjects').get();
        }

        diaryState.subjects = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            diaryState.subjects.push({ id: doc.id, ...data });
        });
    } catch (err) {
        console.error('Error loading diary subjects:', err);
    }
}

// Fetch all diary logs for selected date
async function fetchDiaryEntries() {
    const dateInput = document.getElementById('diaryDate');
    const statusLabel = document.getElementById('diaryStatusLabel');
    if (!dateInput || !dateInput.value) return;

    statusLabel.innerText = 'لوڈ ہو رہا ہے...';

    const selectedDate = dateInput.value;
    const roles = getUserRoles(diaryState.currentUser);
    const isTeacher = roles.includes('teacher') && !roles.some(r => ['admin', 'owner', 'principal', 'nazim_e_taleemaat'].includes(r));

    try {
        let query = db.collection('teacher_diaries')
            .where('tenantId', '==', diaryState.tenantId)
            .where('date', '==', selectedDate);

        // If logged in user is only a teacher, restrict view/edit to their own records
        if (isTeacher) {
            query = query.where('teacherId', '==', diaryState.currentUser.uid);
        }

        const snapshot = await query.get();
        diaryState.entries = [];

        snapshot.forEach(doc => {
            diaryState.entries.push({ id: doc.id, ...doc.data() });
        });

        statusLabel.innerText = `${selectedDate} کے لیے ${diaryState.entries.length} ریکارڈز پائے گئے۔`;
        renderDiaryGrid();
    } catch (err) {
        console.error('Error loading diary logs:', err);
        statusLabel.innerText = 'لوڈ کرنے میں مسئلہ پیش آیا۔';
    }
}

// Render the diary sheet grid
function renderDiaryGrid() {
    const tbody = document.getElementById('diaryGridBody');
    const countLabel = document.getElementById('diaryRowCountLabel');
    if (!tbody) return;

    if (diaryState.entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align:center; padding:3rem; color:#64748b; font-size:0.95rem;">
                    آج کی تاریخ کے لیے کوئی اندراج نہیں ملا۔ نیا ریکارڈ داخل کرنے کے لیے <strong>'نیا ریکارڈ شامل کریں'</strong> بٹن پر کلک کریں۔
                </td>
            </tr>
        `;
        if (countLabel) countLabel.innerText = '0 ریکارڈز';
        return;
    }

    if (countLabel) countLabel.innerText = `${diaryState.entries.length} ریکارڈز`;

    tbody.innerHTML = diaryState.entries.map((entry, index) => {
        // Build Class Dropdown
        const classSelectOptions = `<option value="">کلاس منتخب کریں</option>` + diaryState.classes.map(cls => {
            const isSelected = cls.name === entry.className ? 'selected' : '';
            const displayName = typeof getClassDisplayName === 'function' ? getClassDisplayName(cls.name, cls.name_ur || '') : (cls.name_ur || cls.name || '');
            return `<option value="${escapeHtml(cls.name)}" ${isSelected}>${escapeHtml(displayName)}</option>`;
        }).join('');

        // Filter subjects for selected class
        const classSubjects = entry.className 
            ? diaryState.subjects.filter(sub => sub.className === entry.className)
            : [];

        // Build Subject Dropdown
        const subjectSelectOptions = `<option value="">مضمون منتخب کریں</option>` + classSubjects.map(sub => {
            const isSelected = sub.id === entry.subjectId || sub.name === entry.subjectName ? 'selected' : '';
            const displayName = sub.name_ur || sub.name || '';
            return `<option value="${escapeHtml(sub.id)}" ${isSelected}>${escapeHtml(displayName)}</option>`;
        }).join('');

        return `
            <tr data-index="${index}">
                <td style="text-align:center; font-weight:700;">${index + 1}</td>
                <td>
                    <select class="diary-select-cell" onchange="handleClassChange(${index}, this.value)">
                        ${classSelectOptions}
                    </select>
                </td>
                <td>
                    <select class="diary-select-cell" id="subject-select-${index}" onchange="handleSubjectChange(${index}, this.value)">
                        ${subjectSelectOptions}
                    </select>
                </td>
                <td>
                    <input type="text" class="diary-input-cell" id="book-input-${index}" 
                        value="${escapeHtml(entry.book || '')}" placeholder="کتاب" 
                        oninput="updateEntryLocalField(${index}, 'book', this.value)">
                </td>
                <td>
                    <input type="text" class="diary-input-cell" style="text-align:center;" 
                        value="${escapeHtml(entry.pageNo || '')}" placeholder="صفحہ نمبر" 
                        oninput="updateEntryLocalField(${index}, 'pageNo', this.value)">
                </td>
                <td>
                    <textarea class="diary-textarea-cell" placeholder="طلباء نے آج کیا سیکھنا تھا" 
                        oninput="updateEntryLocalField(${index}, 'whatStudentsRead', this.value)">${escapeHtml(entry.whatStudentsRead || '')}</textarea>
                </td>
                <td>
                    <input type="text" class="diary-input-cell" placeholder="کون سی ایکٹو لرننگ حکمت عملی کا استعمال ہوا" 
                        value="${escapeHtml(entry.activityUsed || '')}" 
                        oninput="updateEntryLocalField(${index}, 'activityUsed', this.value)">
                </td>
                <td>
                    <input type="text" style="text-align:center;" class="diary-input-cell" placeholder="تعداد متحرک طلباء" 
                        value="${escapeHtml(entry.studentsParticipated || '')}" 
                        oninput="updateEntryLocalField(${index}, 'studentsParticipated', this.value)">
                </td>
                <td>
                    <textarea class="diary-textarea-cell" placeholder="سبق کے آخر میں کیا ثبوت ملا کہ سمجھ آگئی ہے" 
                        oninput="updateEntryLocalField(${index}, 'rememberKeyPoints', this.value)">${escapeHtml(entry.rememberKeyPoints || '')}</textarea>
                </td>
                <td>
                    <textarea class="diary-textarea-cell" placeholder="طلبا کے نام جن کو مزید مدد کی ضرورت ہے" 
                        oninput="updateEntryLocalField(${index}, 'studentsNeedingHelp', this.value)">${escapeHtml(entry.studentsNeedingHelp || '')}</textarea>
                </td>
                <td>
                    <div class="diary-remarks-box">
                        ${escapeHtml(entry.nazimSignature || 'انتظارِ دستخط / ریمارکس')}
                    </div>
                </td>
                <td>
                    <button type="button" class="diary-delete-btn" onclick="deleteDiaryEntryRow(${index})" title="حذف کریں">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Add a blank row locally
function addNewDiaryRow() {
    diaryState.entries.push({
        className: '',
        subjectId: '',
        subjectName: '',
        book: '',
        pageNo: '',
        whatStudentsRead: '',
        activityUsed: '',
        studentsParticipated: '',
        rememberKeyPoints: '',
        studentsNeedingHelp: '',
        nazimSignature: ''
    });
    renderDiaryGrid();
}

// Handle class selection change per row
window.handleClassChange = function(index, className) {
    if (diaryState.entries[index]) {
        diaryState.entries[index].className = className;
        diaryState.entries[index].subjectId = '';
        diaryState.entries[index].subjectName = '';
        diaryState.entries[index].book = '';
        diaryState.entries[index].pageNo = '';
        
        // Dynamic re-render to update the subject dropdown for this class
        renderDiaryGrid();
    }
};

// Handle subject selection change per row
window.handleSubjectChange = function(index, subjectId) {
    if (diaryState.entries[index]) {
        const subject = diaryState.subjects.find(s => s.id === subjectId);
        if (subject) {
            diaryState.entries[index].subjectId = subject.id;
            diaryState.entries[index].subjectName = subject.name || '';
            diaryState.entries[index].book = subject.book || subject.bookName || subject.name || '';
        } else {
            diaryState.entries[index].subjectId = '';
            diaryState.entries[index].subjectName = '';
            diaryState.entries[index].book = '';
        }
        
        // Update DOM cells directly without full render to preserve user cursors
        const bookInput = document.getElementById(`book-input-${index}`);
        if (bookInput) bookInput.value = diaryState.entries[index].book;
    }
};

// Update field values locally on keypress/input
window.updateEntryLocalField = function(index, field, value) {
    if (diaryState.entries[index]) {
        diaryState.entries[index][field] = value;
    }
};

// Delete entry locally and from Firestore (with prompt)
window.deleteDiaryEntryRow = async function(index) {
    const entry = diaryState.entries[index];
    if (!entry) return;

    const isConfirmed = confirm('کیا آپ واقعی اس ڈائری ریکارڈ کو حذف کرنا چاہتے ہیں؟');
    if (!isConfirmed) return;

    if (entry.id) {
        try {
            await db.collection('teacher_diaries').doc(entry.id).delete();
        } catch (err) {
            console.error('Error deleting doc from Firestore:', err);
            alert('حذف کرنے میں مسئلہ پیش آیا۔');
            return;
        }
    }

    diaryState.entries.splice(index, 1);
    renderDiaryGrid();
};

// Save all rows to Firestore
async function saveDiaryEntries() {
    if (diaryState.isSaving) return;
    diaryState.isSaving = true;

    const saveStateLabel = document.getElementById('diarySaveStateText');
    const saveBtn = document.getElementById('saveDiaryBtn');
    
    if (saveStateLabel) saveStateLabel.innerText = 'محفوظ ہو رہا ہے...';
    if (saveBtn) saveBtn.disabled = true;

    const dateInput = document.getElementById('diaryDate');
    const selectedDate = dateInput?.value || '';

    if (!selectedDate) {
        alert('تاریخ منتخب کرنا ضروری ہے۔');
        diaryState.isSaving = false;
        if (saveBtn) saveBtn.disabled = false;
        if (saveStateLabel) saveStateLabel.innerText = '';
        return;
    }

    // Validation
    for (let i = 0; i < diaryState.entries.length; i++) {
        const e = diaryState.entries[i];
        if (!e.className) {
            alert(`نمبر شمار ${i + 1} کے لیے کلاس منتخب کرنا لازمی ہے۔`);
            diaryState.isSaving = false;
            if (saveBtn) saveBtn.disabled = false;
            if (saveStateLabel) saveStateLabel.innerText = '';
            return;
        }
        if (!e.subjectId && !e.subjectName) {
            alert(`نمبر شمار ${i + 1} کے لیے مضمون منتخب کرنا لازمی ہے۔`);
            diaryState.isSaving = false;
            if (saveBtn) saveBtn.disabled = false;
            if (saveStateLabel) saveStateLabel.innerText = '';
            return;
        }
    }

    try {
        const batch = db.batch();
        const collectionRef = db.collection('teacher_diaries');

        diaryState.entries.forEach(entry => {
            const docId = entry.id || collectionRef.doc().id;
            const docRef = collectionRef.doc(docId);

            const payload = {
                tenantId: diaryState.tenantId,
                date: selectedDate,
                className: entry.className,
                subjectId: entry.subjectId || '',
                subjectName: entry.subjectName || '',
                book: entry.book || '',
                pageNo: entry.pageNo || '',
                whatStudentsRead: entry.whatStudentsRead || '',
                activityUsed: entry.activityUsed || '',
                studentsParticipated: entry.studentsParticipated || '',
                rememberKeyPoints: entry.rememberKeyPoints || '',
                studentsNeedingHelp: entry.studentsNeedingHelp || '',
                nazimSignature: entry.nazimSignature || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Only update metadata on creation
            if (!entry.id) {
                payload.teacherId = diaryState.currentUser.uid;
                payload.teacherName = diaryState.currentUser.name || diaryState.currentUser.displayName || '';
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            } else {
                payload.teacherId = entry.teacherId;
                payload.teacherName = entry.teacherName;
            }

            batch.set(docRef, payload, { merge: true });
        });

        await batch.commit();

        if (saveStateLabel) saveStateLabel.innerText = 'کامیابی سے محفوظ ہو گیا۔';
        setTimeout(() => {
            if (saveStateLabel) saveStateLabel.innerText = '';
        }, 3000);

        // Re-load list from database
        await fetchDiaryEntries();
    } catch (err) {
        console.error('Error saving diaries:', err);
        alert('ڈائری محفوظ کرنے میں مسئلہ پیش آیا۔');
    } finally {
        diaryState.isSaving = false;
        if (saveBtn) saveBtn.disabled = false;
    }
}

// Helper to escape HTML tags
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
