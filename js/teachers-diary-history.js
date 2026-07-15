const historyState = {
    currentUser: null,
    tenantId: '',
    departments: [],
    classes: [],
    teachers: [],
    entries: []
};

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('historyTableBody')) return;

    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(async (user) => {
            if (!user) return;

            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (!currentUser.uid) {
                currentUser.uid = user.uid;
                currentUser.email = user.email;
                currentUser.name = user.displayName || user.email;
            }
            historyState.currentUser = currentUser;
            historyState.tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');

            if (typeof initDashboard === 'function') {
                initDashboard(currentUser);
            }

            const roles = getUserRoles(currentUser);
            const allowed = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat'].includes(role));
            
            document.getElementById('diaryHistoryAccessDenied').style.display = allowed ? 'none' : 'block';
            document.getElementById('diaryHistoryContent').style.display = allowed ? 'block' : 'none';
            
            if (!allowed) return;

            // Set default date range (past 15 days to today)
            const dateToInput = document.getElementById('historyDateTo');
            const dateFromInput = document.getElementById('historyDateFrom');
            
            const today = new Date();
            const past15 = new Date();
            past15.setDate(today.getDate() - 15);

            if (dateToInput && !dateToInput.value) dateToInput.value = today.toLocaleDateString('sv-SE');
            if (dateFromInput && !dateFromInput.value) dateFromInput.value = past15.toLocaleDateString('sv-SE');

            // Load selectors
            await Promise.all([loadHistoryDepartments(), loadHistoryTeachers(), loadHistoryClasses()]);

            // Bind Event Listeners
            bindHistoryEvents();

            // Auto-fetch initial logs
            await fetchHistoryLogs();
        });
    }
});

function bindHistoryEvents() {
    document.getElementById('historyDept')?.addEventListener('change', async () => {
        await loadHistoryClasses();
    });
    document.getElementById('fetchHistoryBtn')?.addEventListener('click', fetchHistoryLogs);
}

async function loadHistoryDepartments() {
    const select = document.getElementById('historyDept');
    if (!select) return;
    select.innerHTML = '<option value="">تمام شعبہ جات</option>';
    
    try {
        const snapshot = await db.collection('departments')
            .where('tenantId', '==', historyState.tenantId)
            .get();
        
        historyState.departments = [];
        snapshot.forEach(doc => historyState.departments.push({ id: doc.id, ...doc.data() }));

        historyState.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.name;
            option.innerText = typeof getDepartmentDisplayName === 'function' 
                ? getDepartmentDisplayName(dept.name, dept.name_ur || '')
                : (dept.name_ur || dept.name || '');
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading history departments:', err);
    }
}

async function loadHistoryClasses() {
    const select = document.getElementById('historyClass');
    if (!select) return;
    select.innerHTML = '<option value="">تمام کلاسز</option>';
    
    const selectedDept = document.getElementById('historyDept')?.value || '';
    
    try {
        let query = db.collection('classes').where('tenantId', '==', historyState.tenantId);
        if (selectedDept) {
            query = query.where('department', '==', selectedDept);
        }

        const snapshot = await query.get();
        historyState.classes = [];
        snapshot.forEach(doc => historyState.classes.push({ id: doc.id, ...doc.data() }));

        // Sort and populate
        historyState.classes
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.name;
                option.innerText = typeof getClassDisplayName === 'function'
                    ? getClassDisplayName(cls.name, cls.name_ur || '')
                    : (cls.name_ur || cls.name || '');
                select.appendChild(option);
            });
    } catch (err) {
        console.error('Error loading history classes:', err);
    }
}

async function loadHistoryTeachers() {
    const select = document.getElementById('historyTeacher');
    if (!select) return;
    select.innerHTML = '<option value="">تمام اساتذہ</option>';
    
    try {
        const snapshot = await db.collection('teachers')
            .where('tenantId', '==', historyState.tenantId)
            .get();
        
        historyState.teachers = [];
        snapshot.forEach(doc => historyState.teachers.push({ id: doc.id, ...doc.data() }));

        // Sort and populate
        historyState.teachers
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .forEach(t => {
                const option = document.createElement('option');
                option.value = t.id;
                option.innerText = t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.fullName || '';
                select.appendChild(option);
            });
    } catch (err) {
        console.error('Error loading history teachers:', err);
    }
}

// Fetch history logs from Firestore
async function fetchHistoryLogs() {
    const tbody = document.getElementById('historyTableBody');
    const resultLabel = document.getElementById('historyResultLabel');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding:3rem; color:#64748b;">رپورٹ لوڈ کی جا رہی ہے...</td></tr>`;

    const selectedClass = document.getElementById('historyClass')?.value || '';
    const selectedTeacher = document.getElementById('historyTeacher')?.value || '';
    const dateFrom = document.getElementById('historyDateFrom')?.value || '';
    const dateTo = document.getElementById('historyDateTo')?.value || '';

    // Update Print Header Details
    updatePrintHeaders(selectedTeacher, selectedClass, dateFrom, dateTo);

    try {
        let query = db.collection('teacher_diaries')
            .where('tenantId', '==', historyState.tenantId);

        const snapshot = await query.get();
        historyState.entries = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Client-side filtering to avoid complex dynamic dynamic composite index generation
            if (selectedClass && data.className !== selectedClass) return;
            if (selectedTeacher && data.teacherId !== selectedTeacher) return;
            if (dateFrom && data.date < dateFrom) return;
            if (dateTo && data.date > dateTo) return;

            historyState.entries.push({ id: doc.id, ...data });
        });

        // Sort entries: date descending, then class name ascending
        historyState.entries.sort((a, b) => {
            const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
            if (dateCompare !== 0) return dateCompare;
            return String(a.className || '').localeCompare(String(b.className || ''));
        });

        resultLabel.innerText = `${historyState.entries.length} ریکارڈز پائے گئے۔`;
        renderHistoryGrid();
    } catch (err) {
        console.error('Error querying history:', err);
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:3rem; color:red;">رپورٹ تلاش کرنے میں مسئلہ پیش آیا۔</td></tr>`;
    }
}

// Render the historical grid
function renderHistoryGrid() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (historyState.entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" style="text-align:center; padding:3rem; color:#64748b; font-size:0.95rem;">
                    منتخب کردہ فلٹرز کے مطابق کوئی ریکارڈ نہیں ملا۔
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = historyState.entries.map((entry, index) => {
        const formattedDate = entry.date ? entry.date.split('-').reverse().join('/') : '-';
        
        return `
            <tr id="row-${entry.id}">
                <td style="text-align:center; font-weight:700;">${index + 1}</td>
                <td style="font-weight:600; white-space:nowrap;">${formattedDate}</td>
                <td style="font-weight:600;">${escapeHtml(entry.teacherName || '')}</td>
                <td style="font-weight:600;">${escapeHtml(entry.className || '')}</td>
                <td style="font-weight:600;">${escapeHtml(entry.subjectName || '')}</td>
                <td>${escapeHtml(entry.book || '')}</td>
                <td style="text-align:center; font-weight:700;">${escapeHtml(entry.pageNo || '')}</td>
                <td>${escapeHtml(entry.whatStudentsRead || '')}</td>
                <td>${escapeHtml(entry.activityUsed || '')}</td>
                <td style="text-align:center; font-weight:700;">${escapeHtml(entry.studentsParticipated || '')}</td>
                <td>${escapeHtml(entry.rememberKeyPoints || '')}</td>
                <td>${escapeHtml(entry.studentsNeedingHelp || '')}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:0.25rem;">
                        <input type="text" class="diary-inline-remarks-input" 
                            id="remarks-${entry.id}" 
                            value="${escapeHtml(entry.nazimSignature || '')}" 
                            placeholder="دستخط / ریمارکس لکھیں...">
                        <button type="button" class="btn-save-remarks" onclick="saveNazimRemarks('${entry.id}')">
                            ✓ محفوظ کریں
                        </button>
                        <span id="saved-text-${entry.id}" class="diary-remarks-saved-text" style="display:none;">محفوظ ہو گیا!</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Update Print Header labels
function updatePrintHeaders(teacherId, className, dateFrom, dateTo) {
    const printTeacher = document.getElementById('printTeacherName');
    const printClass = document.getElementById('printClassName');
    const printDate = document.getElementById('printDateRange');

    if (printTeacher) {
        if (teacherId) {
            const teacher = historyState.teachers.find(t => t.id === teacherId);
            const name = teacher ? (teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`) : '';
            printTeacher.innerText = `استاد: ${name}`;
        } else {
            printTeacher.innerText = `استاد: تمام اساتذہ`;
        }
    }

    if (printClass) {
        printClass.innerText = className ? `کلاس: ${className}` : `کلاس: تمام کلاسز`;
    }

    if (printDate) {
        if (dateFrom && dateTo) {
            const from = dateFrom.split('-').reverse().join('/');
            const to = dateTo.split('-').reverse().join('/');
            printDate.innerText = `تاریخ: ${from} سے ${to}`;
        } else {
            printDate.innerText = `تاریخ: تمام دستیاب`;
        }
    }
}

// Inline Save Nazim Remarks/Signature
window.saveNazimRemarks = async function(docId) {
    const input = document.getElementById(`remarks-${docId}`);
    const savedText = document.getElementById(`saved-text-${docId}`);
    if (!input) return;

    const value = input.value.trim();

    try {
        await db.collection('teacher_diaries').doc(docId).update({
            nazimSignature: value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local state value as well
        const entry = historyState.entries.find(e => e.id === docId);
        if (entry) entry.nazimSignature = value;

        if (savedText) {
            savedText.style.display = 'block';
            setTimeout(() => {
                savedText.style.display = 'none';
            }, 2000);
        }
    } catch (err) {
        console.error('Error saving Nazim remarks:', err);
        alert('ریمارکس محفوظ کرنے میں مسئلہ پیش آیا۔');
    }
};

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
