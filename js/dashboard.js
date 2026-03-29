
document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (currentUser) {
                initDashboardView(currentUser);
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

    if (role === 'admin' || role === 'nazim_e_taleemaat' || role === 'hifz_supervisor') {
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

    container.innerHTML = 'Loading events...';

    try {
        const today = new Date().toISOString().split('T')[0];
        const snapshot = await db.collection('events')
            .where('date', '>=', today)
            .orderBy('date', 'asc')
            .limit(5)
            .get();

        if (snapshot.empty) {
            container.innerHTML = '<p style="color:var(--text-light)">No upcoming events.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const d = doc.data();
            const date = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
            
            html += `
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
                    <div style="background: var(--primary-light); color: var(--primary-color); padding: 0.5rem; border-radius: 0.5rem; text-align: center; min-width: 60px;">
                        <div style="font-weight: bold; font-size: 1.1rem;">${new Date(d.date).getDate()}</div>
                        <div style="font-size: 0.8rem;">${new Date(d.date).toLocaleDateString('en-US', { month: 'short' })}</div>
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
        container.innerHTML = '<p style="color:red">Error loading events.</p>';
    }
}

// ==========================================
// ADMIN LOGIC
// ==========================================

async function loadAdminStats() {
    try {
        // 1. Counts
        const studentsSnap = await db.collection('students').get();
        const teachersSnap = await db.collection('teachers').get();
        const classesSnap = await db.collection('classes').get();

        document.getElementById('countStudents').innerText = studentsSnap.size;
        document.getElementById('countTeachers').innerText = teachersSnap.size;
        document.getElementById('countClasses').innerText = classesSnap.size;

        // 2. Monthly Income
        const date = new Date();
        const currentMonth = date.toLocaleString('default', { month: 'long' }); // "January"
        const currentYear = date.getFullYear(); // 2025
        const currentMonthStr = (date.getMonth() + 1).toString().padStart(2, '0'); // "01"
        const currentYearStr = date.getFullYear().toString(); // "2025"

        let totalIncome = 0;

        // Fees
        const feesSnap = await db.collection('fees')
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
            .where('date', '>=', startOfMonth)
            .where('date', '<=', endOfMonth)
            .get();

        incomeSnap.forEach(doc => {
            totalIncome += (parseFloat(doc.data().amount) || 0);
        });

        document.getElementById('monthlyIncome').innerText = `Rs. ${totalIncome.toLocaleString()}`;

        // 3. Recent Activity
        loadRecentActivity();

    } catch (error) {
        console.error("Error loading admin stats:", error);
    }
}

async function loadRecentActivity() {
    const container = document.getElementById('recentActivityList');
    container.innerHTML = 'Loading...';

    try {
        // We can't easily merge queries, so we fetch top 5 of each and sort manually
        const [students, fees] = await Promise.all([
            db.collection('students').orderBy('createdAt', 'desc').limit(5).get(),
            db.collection('fees').orderBy('createdAt', 'desc').limit(5).get()
        ]);

        let activities = [];

        students.forEach(doc => {
            const d = doc.data();
            activities.push({
                type: 'student',
                text: `New student enrolled: ${d.firstName} ${d.lastName}`,
                time: d.createdAt ? d.createdAt.toDate() : new Date()
            });
        });

        fees.forEach(doc => {
            const d = doc.data();
            activities.push({
                type: 'fee',
                text: `Fee collected: Rs. ${d.amount} from ${d.studentName}`,
                time: d.createdAt ? d.createdAt.toDate() : new Date()
            });
        });

        // Sort by time desc
        activities.sort((a, b) => b.time - a.time);
        
        // Take top 5
        activities = activities.slice(0, 5);

        let html = '';
        activities.forEach(a => {
            html += `
                <div class="activity-item" style="padding: 0.75rem 0; border-bottom: 1px solid #eee;">
                    <div style="font-weight: 500;">${a.text}</div>
                    <div style="font-size: 0.8rem; color: #888;">${a.time.toLocaleString()}</div>
                </div>
            `;
        });
        container.innerHTML = html || 'No recent activity.';

    } catch (e) {
        console.error(e);
        container.innerHTML = 'Error loading activity.';
    }
}

async function initCharts() {
    const ctx1 = document.getElementById('financeChart').getContext('2d');
    const ctx2 = document.getElementById('studentChart').getContext('2d');

    // 1. Finance Chart (Dummy Data for now as agg is complex)
    // To make this real, we'd need to fetch 6 months of data which is heavy for client-side
    new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Income',
                data: [12000, 19000, 3000, 5000, 2000, 3000],
                borderColor: '#2563eb',
                tension: 0.4
            }, {
                label: 'Expenses',
                data: [5000, 15000, 2000, 4000, 1000, 2000],
                borderColor: '#dc2626',
                tension: 0.4
            }]
        }
    });

    // 2. Student Distribution (Real Data)
    try {
        const studentsSnap = await db.collection('students').get();
        const classCounts = {};
        
        studentsSnap.forEach(doc => {
            const d = doc.data();
            const cls = d.admissionClass || 'Unknown';
            classCounts[cls] = (classCounts[cls] || 0) + 1;
        });

        const labels = Object.keys(classCounts);
        const data = Object.values(classCounts);
        const colors = [
            '#2563eb', '#16a34a', '#d97706', '#9333ea', 
            '#dc2626', '#0891b2', '#be185d', '#4f46e5'
        ];

        new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length)
                }]
            }
        });

    } catch (e) {
        console.error("Error loading chart data:", e);
    }
}

// ==========================================
// TEACHER LOGIC
// ==========================================

async function loadTeacherStats(email) {
    // 1. Find Teacher Doc
    const teacherQuery = await db.collection('teachers').where('email', '==', email).get();
    if (teacherQuery.empty) return;
    
    const teacher = teacherQuery.docs[0].data();
    const teacherId = teacherQuery.docs[0].id;
    
    document.getElementById('teacherWelcome').innerText = `Welcome, ${teacher.firstName}`;

    // 2. Today's Classes
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    const timetableSnap = await db.collection('timetable')
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
}

// ==========================================
// STUDENT LOGIC
// ==========================================

async function loadStudentStats(email) {
    // 1. Find Student Doc by Email
    // Assuming student email is stored in 'studentEmail' or 'parentEmail' or just 'email'
    // Let's try 'studentEmail' first, then 'parentEmail'
    
    let studentDoc = null;
    let studentId = null;

    // Try finding by studentEmail
    let q = await db.collection('students').where('studentEmail', '==', email).get();
    if (q.empty) {
        // Try finding by parentEmail
        q = await db.collection('students').where('parentEmail', '==', email).get();
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

    // 2. Load Attendance Stats
    // We need to count 'Present', 'Absent', 'Leave' in 'attendance' collection for this studentId
    try {
        // This might be heavy if we fetch all. Better to fetch this month or last 30 records.
        // For now, let's fetch last 30 days.
        const attendanceSnap = await db.collection('attendance')
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
    // Assuming we have an 'exams' collection
    try {
        const today = new Date().toISOString().split('T')[0];
        const examsSnap = await db.collection('exams')
            .where('class', '==', studentDoc.admissionClass) // Filter by class
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
                html += `
                    <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid #eee;">
                        <div style="font-weight: 600;">${e.subject}</div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">
                            📅 ${new Date(e.date).toLocaleDateString()}
                        </div>
                    </div>
                `;
            });
            examsContainer.innerHTML = html;
        }

    } catch (e) {
        console.error("Error loading exams:", e);
        // Fail silently or show error
    }
}
