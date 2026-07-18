document.addEventListener('DOMContentLoaded', () => {
    // Auth Check with resilient profile recovery
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            let currentUser = null;
            try {
                currentUser = JSON.parse(localStorage.getItem('currentUser'));
            } catch (e) {
                console.error("Error parsing cached currentUser:", e);
            }

            // Verify cached user matches current auth user
            if (!currentUser || currentUser.uid !== user.uid) {
                console.log("Fetching fresh user data from Firestore on dashboard...");
                try {
                    const userDoc = await db.collection("users").doc(user.uid).get();
                    if (userDoc.exists) {
                        const data = userDoc.data() || {};
                        let roles = [];
                        if (typeof getUserRoles === 'function') {
                            roles = getUserRoles(data);
                        } else {
                            roles = Array.isArray(data.roles) ? data.roles : [data.role || 'student'];
                        }
                        if (!roles.length) roles = ['student'];

                        currentUser = {
                            uid: user.uid,
                            email: user.email,
                            role: roles[0] || 'student',
                            roles: roles,
                            name: user.displayName || user.email.split('@')[0]
                        };
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    }
                } catch (e) {
                    console.error("Error fetching user data:", e);
                }
            }

            if (currentUser) {
                initDashboardView(currentUser);
            } else {
                // Fallback profile if database profile query fails (to avoid blank screen)
                const fallbackUser = {
                    uid: user.uid,
                    email: user.email,
                    role: 'student',
                    roles: ['student'],
                    name: user.displayName || user.email.split('@')[0]
                };
                initDashboardView(fallbackUser);
            }
        }
    });
});

function initDashboardView(user) {
    const roles = Array.isArray(user.roles) && user.roles.length
        ? user.roles.map(role => String(role || '').toLowerCase())
        : [String(user.role || 'student').toLowerCase()];
    const role = roles[0] || 'student';
    
    // Hide all first
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('teacher-dashboard').style.display = 'none';
    document.getElementById('student-dashboard').style.display = 'none';

    // Load common data (Events)
    loadCommonEvents(role);

    if (role === 'admin' || role === 'nazim_e_taleemaat' || role === 'hifz_supervisor' || role === 'owner' || role === 'principal') {
        document.getElementById('admin-dashboard').style.display = 'block';
        loadAdminStats();
        initCharts();
    } else if (role === 'teacher') {
        document.getElementById('teacher-dashboard').style.display = 'block';
        loadTeacherStats(user.email); 
    } else if (role === 'student') {
        document.getElementById('student-dashboard').style.display = 'block';
        loadStudentStats(user.email);
    }
}

// ==========================================
// UTILITIES & HELPER LOGIC
// ==========================================

function getTenantId() {
    if (typeof getCurrentTenant === 'function') return getCurrentTenant();
    return localStorage.getItem('tenant_id') || 'default';
}

function isInTenant(data, tenantId) {
    return !data?.tenantId || data.tenantId === tenantId;
}

function setSkeletonState(dashboardId, show) {
    const dashboard = document.getElementById(dashboardId);
    if (!dashboard) return;
    
    const elements = dashboard.querySelectorAll('.stat-value, #recentActivityList, #adminEventsList, #teacherClasses, #teacherEventsList, #studentAttendanceSummary, #studentExams, #studentEventsList');
    elements.forEach(el => {
        if (show) {
            el.classList.add('skeleton');
        } else {
            el.classList.remove('skeleton');
        }
    });
}

function formatDateByLang(date) {
    const lang = (typeof getActiveLanguage === 'function') ? getActiveLanguage() : 'en';
    if (lang === 'ur') {
        return date.toLocaleDateString('ur-PK', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatActivityText(type, data) {
    const isUrdu = (typeof getActiveLanguage === 'function') ? getActiveLanguage() : 'en';
    if (type === 'student') {
        const prefix = (typeof getTrans === 'function') ? getTrans('new_student_enrolled') : 'New student enrolled:';
        return `${prefix} ${data.name}`;
    } else if (type === 'fee') {
        if (isUrdu === 'ur') {
            return `${data.name} سے Rs. ${data.amount.toLocaleString()} فیس وصول کی گئی`;
        }
        const prefix = (typeof getTrans === 'function') ? getTrans('fee_collected_from') : 'Fee collected from';
        return `Rs. ${data.amount.toLocaleString()} ${prefix.toLowerCase()} ${data.name}`;
    }
    return '';
}

// ==========================================
// COMMON LOGIC
// ==========================================

async function loadCommonEvents(role) {
    const containers = {
        admin: 'adminEventsList',
        teacher: 'teacherEventsList',
        student: 'studentEventsList'
    };
    
    const containerId = containers[role];
    if (!containerId) return;
    
    const container = document.getElementById(containerId);
    if (!container) return;

    const tenantId = getTenantId();
    container.innerHTML = `<p style="color:var(--text-light)">${(typeof getTrans === 'function') ? getTrans('loading') : 'Loading...'}</p>`;

    try {
        const today = new Date().toISOString().split('T')[0];
        const snapshot = await db.collection('events')
            .where('tenantId', '==', tenantId)
            .where('date', '>=', today)
            .orderBy('date', 'asc')
            .limit(5)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<p style="color:var(--text-light)">${(typeof getTrans === 'function') ? getTrans('no_upcoming_events') || 'No upcoming events.' : 'No upcoming events.'}</p>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const d = doc.data();
            const dateObj = new Date(d.date);
            const dayNum = dateObj.getDate();
            const monthStr = dateObj.toLocaleDateString((typeof getActiveLanguage === 'function' && getActiveLanguage() === 'ur') ? 'ur-PK' : 'en-US', { month: 'short' });
            
            html += `
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
                    <div style="background: var(--primary-light); color: var(--primary-color); padding: 0.5rem; border-radius: 0.5rem; text-align: center; min-width: 60px;">
                        <div style="font-weight: bold; font-size: 1.1rem;">${dayNum}</div>
                        <div style="font-size: 0.8rem;">${monthStr}</div>
                    </div>
                    <div>
                        <h4 style="margin: 0; color: var(--text-dark);">${d.title}</h4>
                        <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-light);">${d.description || ''}</p>
                        <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 0.25rem;">📍 ${d.location || 'TBA'}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading events:", error);
        container.innerHTML = `<p style="color:red">${(typeof getTrans === 'function') ? getTrans('error_loading_events') || 'Error loading events.' : 'Error loading events.'}</p>`;
    }
}

// ==========================================
// ADMIN LOGIC
// ==========================================

async function loadAdminStats() {
    const tenantId = getTenantId();
    setSkeletonState('admin-dashboard', true);

    try {
        // 1. Counts using aggregation count() if supported, with transparent fallback
        let countStudents = 0;
        let countTeachers = 0;
        let countClasses = 0;

        const [sSnap, tSnap, cSnap] = await Promise.all([
            db.collection('students').where('tenantId', '==', tenantId).get(),
            db.collection('teachers').where('tenantId', '==', tenantId).get(),
            db.collection('classes').where('tenantId', '==', tenantId).get()
        ]);

        const activeStudents = [];
        sSnap.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'left' && data.currentStatus !== 'left') {
                activeStudents.push(data);
            }
        });

        countStudents = activeStudents.length;
        countTeachers = tSnap.size;
        countClasses = cSnap.size;

        document.getElementById('countStudents').innerText = countStudents;
        document.getElementById('countTeachers').innerText = countTeachers;
        document.getElementById('countClasses').innerText = countClasses;

        // 2. Monthly Income
        const date = new Date();
        const currentMonth = date.toLocaleString('default', { month: 'long' }); // "January"
        const currentYear = date.getFullYear(); // 2026
        const currentMonthStr = (date.getMonth() + 1).toString().padStart(2, '0'); // "07"
        const currentYearStr = date.getFullYear().toString(); // "2026"

        let totalIncome = 0;

        // Fees
        const feesSnap = await db.collection('fees')
            .where('tenantId', '==', tenantId)
            .where('month', '==', currentMonth)
            .where('year', '==', currentYear)
            .where('status', '==', 'Paid')
            .get();

        feesSnap.forEach(doc => {
            totalIncome += (parseFloat(doc.data().amount) || 0);
        });

        // Other Income
        const startOfMonth = `${currentYearStr}-${currentMonthStr}-01`;
        const endOfMonth = `${currentYearStr}-${currentMonthStr}-31`;
        const incomeSnap = await db.collection('incomes')
            .where('tenantId', '==', tenantId)
            .where('date', '>=', startOfMonth)
            .where('date', '<=', endOfMonth)
            .get();

        incomeSnap.forEach(doc => {
            totalIncome += (parseFloat(doc.data().amount) || 0);
        });

        document.getElementById('monthlyIncome').innerText = `Rs. ${totalIncome.toLocaleString()}`;

        // 3. Recent Activity
        await loadRecentActivity(tenantId);

    } catch (error) {
        console.error("Error loading admin stats:", error);
    } finally {
        setSkeletonState('admin-dashboard', false);
    }
}

async function loadRecentActivity(tenantId) {
    const container = document.getElementById('recentActivityList');
    if (!container) return;
    container.innerHTML = 'Loading...';

    try {
        const [students, fees] = await Promise.all([
            db.collection('students').where('tenantId', '==', tenantId).orderBy('createdAt', 'desc').limit(5).get(),
            db.collection('fees').where('tenantId', '==', tenantId).orderBy('createdAt', 'desc').limit(5).get()
        ]);

        let activities = [];

        students.forEach(doc => {
            const d = doc.data();
            if (d.status === 'left' || d.currentStatus === 'left') return;
            activities.push({
                type: 'student',
                name: `${d.firstName} ${d.lastName}`,
                time: d.createdAt ? d.createdAt.toDate() : new Date()
            });
        });

        fees.forEach(doc => {
            const d = doc.data();
            activities.push({
                type: 'fee',
                name: d.studentName || 'Student',
                amount: parseFloat(d.amount) || 0,
                time: d.createdAt ? d.createdAt.toDate() : new Date()
            });
        });

        // Sort by time desc
        activities.sort((a, b) => b.time - a.time);
        activities = activities.slice(0, 5);

        let html = '';
        activities.forEach(a => {
            const text = formatActivityText(a.type, a);
            html += `
                <div class="activity-item" style="padding: 0.75rem 0; border-bottom: 1px solid #eee;">
                    <div style="font-weight: 500;">${text}</div>
                    <div style="font-size: 0.8rem; color: #888;">${formatDateByLang(a.time)}</div>
                </div>
            `;
        });
        container.innerHTML = html || `<p style="color:var(--text-light)">${(typeof getTrans === 'function') ? getTrans('no_recent_activity') || 'No recent activity.' : 'No recent activity.'}</p>`;

    } catch (e) {
        console.error("Error loading activity:", e);
        container.innerHTML = 'Error loading activity.';
    }
}

let financeChartInstance = null;
let studentChartInstance = null;

async function initCharts() {
    const tenantId = getTenantId();
    
    const canvasFinance = document.getElementById('financeChart');
    const canvasStudent = document.getElementById('studentChart');
    if (!canvasFinance || !canvasStudent) return;
    
    const ctx1 = canvasFinance.getContext('2d');
    const ctx2 = canvasStudent.getContext('2d');

    // Destroy existing instances to prevent overlays
    if (financeChartInstance) {
        financeChartInstance.destroy();
        financeChartInstance = null;
    }
    if (studentChartInstance) {
        studentChartInstance.destroy();
        studentChartInstance = null;
    }

    // 1. DYNAMIC FINANCE DATA RETRIEVAL (Last 6 Months)
    try {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const buckets = [];
        const todayDate = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
            buckets.push({
                year: d.getFullYear(),
                monthIndex: d.getMonth(),
                label: monthNames[d.getMonth()],
                income: 0,
                expense: 0
            });
        }

        const oldestMonth = buckets[0];
        const startMonthStr = (oldestMonth.monthIndex + 1).toString().padStart(2, '0');
        const startDateStr = `${oldestMonth.year}-${startMonthStr}-01`;

        // Retrieve Incomes, Expenses, and Fees
        const [incomeSnap, expenseSnap, feesSnap] = await Promise.all([
            db.collection('incomes')
                .where('tenantId', '==', tenantId)
                .where('date', '>=', startDateStr)
                .get(),
            db.collection('expenses')
                .where('tenantId', '==', tenantId)
                .where('date', '>=', startDateStr)
                .get(),
            db.collection('fees')
                .where('tenantId', '==', tenantId)
                .where('status', '==', 'Paid')
                .where('year', '>=', oldestMonth.year)
                .get()
        ]);

        // Process general incomes
        incomeSnap.forEach(doc => {
            const data = doc.data();
            if (!data.date) return;
            const parts = data.date.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const bucket = buckets.find(b => b.year === y && b.monthIndex === m);
            if (bucket) {
                bucket.income += (parseFloat(data.amount) || 0);
            }
        });

        // Process expenses
        expenseSnap.forEach(doc => {
            const data = doc.data();
            if (!data.date) return;
            const parts = data.date.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const bucket = buckets.find(b => b.year === y && b.monthIndex === m);
            if (bucket) {
                bucket.expense += (parseFloat(data.amount) || 0);
            }
        });

        // Process paid student fees
        feesSnap.forEach(doc => {
            const data = doc.data();
            const y = parseInt(data.year, 10);
            const monthName = String(data.month).trim();
            const m = fullMonthNames.findIndex(name => name.toLowerCase() === monthName.toLowerCase());
            if (m < 0) return;
            const bucket = buckets.find(b => b.year === y && b.monthIndex === m);
            if (bucket) {
                bucket.income += (parseFloat(data.amount) || 0);
            }
        });

        const chartLabels = buckets.map(b => b.label);
        const incomeData = buckets.map(b => b.income);
        const expenseData = buckets.map(b => b.expense);

        financeChartInstance = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: (typeof getTrans === 'function') ? getTrans('income') || 'Income' : 'Income',
                    data: incomeData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    fill: true,
                    tension: 0.4
                }, {
                    label: (typeof getTrans === 'function') ? getTrans('expenses') || 'Expenses' : 'Expenses',
                    data: expenseData,
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.05)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

    } catch (e) {
        console.error("Error setting up dynamic finance chart:", e);
    }

    // 2. Student Distribution (Real Data)
    try {
        const studentsSnap = await db.collection('students').where('tenantId', '==', tenantId).get();
        const classCounts = {};
        
        studentsSnap.forEach(doc => {
            const d = doc.data();
            if (d.status === 'left' || d.currentStatus === 'left') return;
            const cls = d.admissionClass || d.className || 'Unknown';
            classCounts[cls] = (classCounts[cls] || 0) + 1;
        });

        const labels = Object.keys(classCounts);
        const data = Object.values(classCounts);
        const colors = [
            '#2563eb', '#16a34a', '#d97706', '#9333ea', 
            '#dc2626', '#0891b2', '#be185d', '#4f46e5'
        ];

        studentChartInstance = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

    } catch (e) {
        console.error("Error loading student chart data:", e);
    }
}

// ==========================================
// TEACHER LOGIC
// ==========================================

async function loadTeacherStats(email) {
    const tenantId = getTenantId();
    setSkeletonState('teacher-dashboard', true);

    try {
        // 1. Find Teacher Doc
        const teacherQuery = await db.collection('teachers')
            .where('tenantId', '==', tenantId)
            .where('email', '==', email)
            .get();
        if (teacherQuery.empty) return;
        
        const teacher = teacherQuery.docs[0].data();
        const teacherId = teacherQuery.docs[0].id;
        
        document.getElementById('teacherWelcome').innerText = `Welcome, ${teacher.firstName}`;

        // 2. Today's Classes
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];

        const timetableSnap = await db.collection('timetable')
            .where('tenantId', '==', tenantId)
            .where('teacherId', '==', teacherId)
            .where('day', '==', today)
            .orderBy('startTime')
            .get();

        const classList = document.getElementById('teacherClasses');
        if (timetableSnap.empty) {
            classList.innerHTML = '<p>No classes scheduled for today.</p>';
        } else {
            let html = '';
            timetableSnap.forEach(doc => {
                const t = doc.data();
                const displayClassName = (typeof getClassDisplayName === 'function')
                    ? getClassDisplayName(t.className || '', t.className_ur || '')
                    : (t.className_ur || t.className || '');
                html += `
                    <div class="card" style="margin-bottom: 1rem; border: 1px solid #eee; padding: 1rem;">
                        <h4 style="margin:0 0 0.5rem 0;">${t.subject}</h4>
                        <div style="font-size: 0.9rem; color: var(--text-light);">
                            <span style="font-weight: 600;">Class:</span> ${displayClassName} <br>
                            <span style="font-weight: 600;">Time:</span> ${t.startTime} - ${t.endTime}
                        </div>
                    </div>
                `;
            });
            classList.innerHTML = html;
        }

    } catch (err) {
        console.error("Error loading teacher stats:", err);
    } finally {
        setSkeletonState('teacher-dashboard', false);
    }
}

// ==========================================
// STUDENT LOGIC
// ==========================================

async function loadStudentStats(email) {
    const tenantId = getTenantId();
    setSkeletonState('student-dashboard', true);

    try {
        let studentDoc = null;
        let studentId = null;

        // Try finding by studentEmail
        let q = await db.collection('students')
            .where('tenantId', '==', tenantId)
            .where('studentEmail', '==', email)
            .get();
        if (q.empty) {
            // Try finding by parentEmail
            q = await db.collection('students')
                .where('tenantId', '==', tenantId)
                .where('parentEmail', '==', email)
                .get();
        }
        if (q.empty) {
            // Try finding by email general field
            q = await db.collection('students')
                .where('tenantId', '==', tenantId)
                .where('email', '==', email)
                .get();
        }
        
        if (!q.empty) {
            studentDoc = q.docs[0].data();
            studentId = q.docs[0].id;
        }

        if (!studentDoc) {
            document.getElementById('studentWelcome').innerText = `Welcome Student`;
            document.getElementById('studentAttendanceSummary').innerHTML = '<p>Student record not linked.</p>';
            return;
        }

        document.getElementById('studentWelcome').innerText = `Welcome, ${studentDoc.firstName}`;

        // 2. Load Attendance Stats (Last 30 Days)
        try {
            const attendanceSnap = await db.collection('attendance')
                .where('tenantId', '==', tenantId)
                .where('studentId', '==', studentId)
                .orderBy('date', 'desc')
                .limit(30)
                .get();

            let present = 0;
            let absent = 0;
            let leave = 0;
            let total = 0;

            attendanceSnap.forEach(doc => {
                const status = doc.data().status;
                if (status === 'Present') present++;
                else if (status === 'Absent') absent++;
                else if (status === 'Leave') leave++;
                total++;
            });

            const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

            document.getElementById('studentAttendanceSummary').innerHTML = `
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-color);">${percentage}%</div>
                    <div style="color: var(--text-light);">Attendance (Last 30 Days)</div>
                </div>
                <div style="display: flex; justify-content: space-around; text-align: center;">
                    <div>
                        <div style="font-weight: 600; color: var(--success);">${present}</div>
                        <div style="font-size: 0.8rem;">Present</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--danger);">${absent}</div>
                        <div style="font-size: 0.8rem;">Absent</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--warning);">${leave}</div>
                        <div style="font-size: 0.8rem;">Leave</div>
                    </div>
                </div>
            `;

        } catch (e) {
            console.error("Error loading student attendance:", e);
            document.getElementById('studentAttendanceSummary').innerHTML = '<p>Error loading attendance.</p>';
        }

        // 3. Upcoming Exams
        try {
            const today = new Date().toISOString().split('T')[0];
            const examsSnap = await db.collection('exams')
                .where('tenantId', '==', tenantId)
                .where('class', '==', studentDoc.admissionClass || studentDoc.className || '') 
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .limit(3)
                .get();

            const examsContainer = document.getElementById('studentExams');
            if (examsSnap.empty) {
                examsContainer.innerHTML = '<p>No upcoming exams.</p>';
            } else {
                let html = '';
                examsSnap.forEach(doc => {
                    const e = doc.data();
                    const examDate = new Date(e.date);
                    html += `
                        <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid #eee;">
                            <div style="font-weight: 600;">${e.subject}</div>
                            <div style="font-size: 0.85rem; color: var(--text-light);">
                                📅 ${formatDateByLang(examDate)}
                            </div>
                        </div>
                    `;
                });
                examsContainer.innerHTML = html;
            }

        } catch (e) {
            console.error("Error loading exams:", e);
        }

    } catch (err) {
        console.error("Error loading student stats:", err);
    } finally {
        setSkeletonState('student-dashboard', false);
    }
}
