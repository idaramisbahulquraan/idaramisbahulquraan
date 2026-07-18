// Teacher Compliance Tracker Controller
const trackerState = {
    currentUser: null,
    tenantId: '',
    teachers: [],
    subjects: [],
    classes: [],
    attendance: [],
    diaries: [],
    assembly: [],
    exams: [],
    syllabusPlans: [],
    checklists: [],
    certificates: [],
    isSearching: false
};

document.addEventListener('DOMContentLoaded', () => {
    // Setup default values
    const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const curMonth = today.substring(0, 7); // YYYY-MM

    const dailyInput = document.getElementById('trackerDailyDate');
    const monthInput = document.getElementById('trackerMonthlyDate');
    if (dailyInput) dailyInput.value = today;
    if (monthInput) monthInput.value = curMonth;

    // Access check
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(async (user) => {
            if (!user) return;

            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (!currentUser.uid) {
                currentUser.uid = user.uid;
                currentUser.email = user.email;
                currentUser.name = user.displayName || user.email;
            }
            trackerState.currentUser = currentUser;
            trackerState.tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');

            if (typeof initDashboard === 'function') {
                initDashboard(currentUser);
            }

            const roles = getUserRoles(currentUser);
            const allowed = roles.some(role => ['admin', 'owner', 'principal', 'nazim_e_taleemaat'].includes(role));

            document.getElementById('trackerAccessDenied').style.display = allowed ? 'none' : 'block';
            document.getElementById('trackerContent').style.display = allowed ? 'block' : 'none';

            if (!allowed) return;

            // Load teachers and subjects baseline
            await loadBaselineData();

            // Bind selectors
            bindTrackerEvents();

            // Load initial daily list
            await fetchComplianceReport();
        });
    }
});

function bindTrackerEvents() {
    // Toggle selector groups
    document.getElementById('trackerJobType')?.addEventListener('change', (e) => {
        const val = e.target.value;
        document.getElementById('groupDailyDate').style.display = val === 'daily' ? 'block' : 'none';
        document.getElementById('groupMonthlyDate').style.display = val === 'monthly' ? 'block' : 'none';
        document.getElementById('groupAnnualYear').style.display = val === 'annual' ? 'block' : 'none';
    });

    document.getElementById('fetchComplianceBtn')?.addEventListener('click', fetchComplianceReport);
}

// Pre-load static lists
async function loadBaselineData() {
    try {
        // Load Teachers
        let snapTeachers = await db.collection('teachers')
            .where('tenantId', '==', trackerState.tenantId)
            .get();
        if (snapTeachers.empty) {
            snapTeachers = await db.collection('teachers').get();
        }
        
        trackerState.teachers = [];
        snapTeachers.forEach(doc => {
            const data = doc.data();
            if (!data.tenantId || data.tenantId === trackerState.tenantId || data.tenantId === 'default') {
                const name = data.name_ur || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || '';
                trackerState.teachers.push({ id: doc.id, name, ...data });
            }
        });

        // Load Subjects
        let snapSubjects = await db.collection('subjects')
            .where('tenantId', '==', trackerState.tenantId)
            .get();
        if (snapSubjects.empty) {
            snapSubjects = await db.collection('subjects').get();
        }

        trackerState.subjects = [];
        snapSubjects.forEach(doc => {
            const data = doc.data();
            if (!data.tenantId || data.tenantId === trackerState.tenantId || data.tenantId === 'default') {
                trackerState.subjects.push({ id: doc.id, ...data });
            }
        });

        document.getElementById('statTotalTeachers').innerText = trackerState.teachers.length;
    } catch (err) {
        console.error("Error loading baseline:", err);
    }
}

// Master Fetch Report Coordinator
async function fetchComplianceReport() {
    if (trackerState.isSearching) return;
    trackerState.isSearching = true;

    const jobType = document.getElementById('trackerJobType').value;
    const body = document.getElementById('trackerGridBody');
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem;">کمپلائنس رپورٹ حاصل کی جا رہی ہے...</td></tr>';

    try {
        if (jobType === 'daily') {
            await fetchDailyCompliance();
        } else if (jobType === 'monthly') {
            await fetchMonthlyCompliance();
        } else {
            await fetchAnnualCompliance();
        }
    } catch (err) {
        console.error(err);
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; color:red;">معلومات حاصل کرنے میں مسئلہ پیش آیا۔</td></tr>';
    } finally {
        trackerState.isSearching = false;
    }
}

// 1. Daily compliance checks
async function fetchDailyCompliance() {
    const date = document.getElementById('trackerDailyDate').value;
    if (!date) {
        alert('تاریخ منتخب کریں۔');
        return;
    }

    // Set printable and visual metadata
    document.getElementById('printMetaText').innerHTML = `نوعیت: <strong>یومیہ کام</strong> • تاریخ: <strong>${date.split('-').reverse().join('/')}</strong>`;
    document.getElementById('reportTitle').innerText = `ٹیچرز یومیہ جاب شیٹ - ${date.split('-').reverse().join('/')}`;

    // Update metric title names
    document.getElementById('metricTaskTitle1').innerText = 'حاضری رپورٹ';
    document.getElementById('metricTaskTitle2').innerText = 'ڈائری لاگ رپورٹ';

    // Fetch daily actions
    const [attSnap, diarySnap, assSnap] = await Promise.all([
        db.collection('attendance').where('date', '==', date).get(),
        db.collection('teacher_diaries').where('date', '==', date).get(),
        db.collection('daily_assembly_performance').where('date', '==', date).get()
    ]);

    const activeAttendance = [];
    attSnap.forEach(doc => activeAttendance.push(doc.data()));

    const activeDiaries = [];
    diarySnap.forEach(doc => activeDiaries.push(doc.data()));

    const activeAssembly = [];
    assSnap.forEach(doc => activeAssembly.push(doc.data()));

    // Render Grid Headers
    document.getElementById('trackerGridHead').innerHTML = `
        <tr>
            <th style="width: 5%;">شمار</th>
            <th style="width: 20%;">استاد کا نام</th>
            <th style="width: 25%;">تفویض شدہ کورس / کلاس</th>
            <th style="width: 18%;">طلبہ حاضری (Attendance)</th>
            <th style="width: 18%;">ٹیچر ڈائری (Diary Log)</th>
            <th style="width: 14%;">اسمبلی کارکردگی گریڈ</th>
        </tr>
    `;

    let totalCoursesCount = 0;
    let attDoneCourses = 0;
    let diaryDoneCourses = 0;

    let rowsHtml = '';
    let globalIndex = 0;

    trackerState.teachers.forEach((teacher) => {
        // Find courses (subjects) assigned to this teacher
        const assignedSubjects = trackerState.subjects.filter(s => s.teacherId === teacher.id || s.teacherName === teacher.name);
        
        // C. Assembly rating check (global for teacher on that day)
        const gradedAssembly = activeAssembly.some(a => 
            a.coordinatorId === teacher.id || 
            String(a.coordinatorName).toLowerCase() === String(teacher.name).toLowerCase()
        );
        const assBadge = gradedAssembly 
            ? '<span class="stat-badge badge-success">✅ مکمل</span>' 
            : '<span class="stat-badge badge-info">معلق / لاگو نہیں</span>';

        if (assignedSubjects.length === 0) {
            // Teacher has no assigned subjects/courses
            globalIndex++;
            rowsHtml += `
                <tr>
                    <td style="text-align:center; font-weight:700; vertical-align:middle;">${globalIndex}</td>
                    <td style="font-weight:600; vertical-align:middle;">${escapeHtml(teacher.name)}</td>
                    <td style="color:#64748b; font-style:italic;">— کوئی تفویض شدہ کورس نہیں —</td>
                    <td><span class="stat-badge badge-info">لاگو نہیں (N/A)</span></td>
                    <td><span class="stat-badge badge-info">لاگو نہیں (N/A)</span></td>
                    <td style="text-align:center; vertical-align:middle;">${assBadge}</td>
                </tr>
            `;
        } else {
            // Teacher has courses
            const N = assignedSubjects.length;
            globalIndex++;

            assignedSubjects.forEach((sub, i) => {
                totalCoursesCount++;

                // A. Attendance for this specific class + subject
                const hasAtt = activeAttendance.some(att => 
                    att.className === sub.className && 
                    (att.subjectId === sub.id || att.subjectName === sub.name)
                );
                
                let attBadge = '<span class="stat-badge badge-danger">❌ غیر مکمل</span>';
                if (hasAtt) {
                    attBadge = '<span class="stat-badge badge-success">✅ مکمل</span>';
                    attDoneCourses++;
                }

                // B. Diary for this specific class + subject
                const hasDiary = activeDiaries.some(d => 
                    d.className === sub.className && 
                    (d.subjectId === sub.id || d.subjectName === sub.name) &&
                    (d.teacherId === teacher.id || String(d.teacherName).toLowerCase() === String(teacher.name).toLowerCase())
                );

                let diaryBadge = '<span class="stat-badge badge-danger">❌ غیر مکمل</span>';
                if (hasDiary) {
                    diaryBadge = '<span class="stat-badge badge-success">✅ مکمل</span>';
                    diaryDoneCourses++;
                }

                const courseDisplayName = `${escapeHtml(sub.name || '')} (${escapeHtml(sub.className || '')})`;

                if (i === 0) {
                    // First row for this teacher - render rowspan cells
                    rowsHtml += `
                        <tr>
                            <td rowspan="${N}" style="text-align:center; font-weight:700; vertical-align:middle;">${globalIndex}</td>
                            <td rowspan="${N}" style="font-weight:600; vertical-align:middle;">${escapeHtml(teacher.name)}</td>
                            <td>${courseDisplayName}</td>
                            <td>${attBadge}</td>
                            <td>${diaryBadge}</td>
                            <td rowspan="${N}" style="vertical-align:middle; text-align:center;">${assBadge}</td>
                        </tr>
                    `;
                } else {
                    // Subsequent rows for the same teacher
                    rowsHtml += `
                        <tr>
                            <td>${courseDisplayName}</td>
                            <td>${attBadge}</td>
                            <td>${diaryBadge}</td>
                        </tr>
                    `;
                }
            });
        }
    });

    document.getElementById('trackerGridBody').innerHTML = rowsHtml;

    // Set stats percentages
    const attPct = totalCoursesCount > 0 ? Math.round((attDoneCourses / totalCoursesCount) * 100) : 100;
    const diaryPct = totalCoursesCount > 0 ? Math.round((diaryDoneCourses / totalCoursesCount) * 100) : 100;

    document.getElementById('statMetric1').innerText = `${attPct}%`;
    document.getElementById('statMetric2').innerText = `${diaryPct}%`;
}

// 2. Monthly / Term compliance check
async function fetchMonthlyCompliance() {
    const month = document.getElementById('trackerMonthlyDate').value;
    if (!month) {
        alert('براہ کرم مہینہ اور سال منتخب کریں۔');
        return;
    }

    document.getElementById('printMetaText').innerHTML = `نوعیت: <strong>ماہانہ اور تعلیمی مدت</strong> • مہینہ: <strong>${month}</strong>`;
    document.getElementById('reportTitle').innerText = `ٹیچرز ماہانہ کارکردگی ٹریکر - ${month}`;

    document.getElementById('metricTaskTitle1').innerText = 'تعلیمی منصوبہ بندی';
    document.getElementById('metricTaskTitle2').innerText = 'ناظم معائنے';

    // Fetch syllabus planner, checklist entries, and exams created for the month
    const [plannerSnap, checklistSnap, examsSnap] = await Promise.all([
        db.collection('syllabus_plans').where('tenantId', '==', trackerState.tenantId).get(),
        db.collection('lesson_delivery_checklists').where('tenantId', '==', trackerState.tenantId).get(),
        db.collection('exams').where('tenantId', '==', trackerState.tenantId).get()
    ]);

    const activePlanner = [];
    plannerSnap.forEach(doc => activePlanner.push(doc.data()));

    const activeChecklists = [];
    checklistSnap.forEach(doc => {
        const data = doc.data();
        if (data.date && data.date.startsWith(month)) {
            activeChecklists.push(data);
        }
    });

    const activeExams = [];
    examsSnap.forEach(doc => {
        const data = doc.data();
        // Checked if exam date falls in selected month
        if (data.date && data.date.startsWith(month)) {
            activeExams.push(data);
        }
    });

    document.getElementById('trackerGridHead').innerHTML = `
        <tr>
            <th style="width: 8%;">شمار</th>
            <th style="width: 25%;">استاد کا نام</th>
            <th style="width: 22%;">تحریری امتحانی نمبرات</th>
            <th style="width: 22%;">ماہانہ تعلیمی منصوبہ بندی (Syllabus)</th>
            <th style="width: 23%;">ناظم معائنے (Checklists)</th>
        </tr>
    `;

    let planDone = 0;
    let auditDone = 0;

    const html = trackerState.teachers.map((teacher, index) => {
        // A. Written Exam Marks Entered for assigned subjects
        const assignedSubjects = trackerState.subjects.filter(s => s.teacherId === teacher.id || s.teacherName === teacher.name);
        
        let examMarksBadge = '<span class="stat-badge badge-info">کوئی امتحان نہیں</span>';
        if (assignedSubjects.length > 0) {
            let totalExams = 0;
            let enteredExams = 0;

            assignedSubjects.forEach(sub => {
                // Find exams created for this subject/class in this month
                const subjectExams = activeExams.filter(e => e.className === sub.className && (e.subject === sub.name || e.subjectId === sub.id));
                totalExams += subjectExams.length;
                subjectExams.forEach(e => {
                    if (e.enteredByTeacherName) enteredExams++;
                });
            });

            if (totalExams > 0) {
                if (enteredExams === totalExams) {
                    examMarksBadge = `<span class="stat-badge badge-success">✅ مکمل (${enteredExams}/${totalExams})</span>`;
                } else if (enteredExams > 0) {
                    examMarksBadge = `<span class="stat-badge badge-warning">⚠️ جزوی (${enteredExams}/${totalExams})</span>`;
                } else {
                    examMarksBadge = `<span class="stat-badge badge-danger">❌ غیر مکمل (0/${totalExams})</span>`;
                }
            }
        }

        // B. Syllabus Plans checks
        // Check if syllabus plans exist for teacher subjects
        let planBadge = '<span class="stat-badge badge-info">لاگو نہیں (N/A)</span>';
        if (assignedSubjects.length > 0) {
            let plannedCount = 0;
            assignedSubjects.forEach(sub => {
                const hasPlan = activePlanner.some(p => p.className === sub.className && (p.subject === sub.name || p.subjectId === sub.id));
                if (hasPlan) plannedCount++;
            });

            if (plannedCount === assignedSubjects.length) {
                planBadge = '<span class="stat-badge badge-success">✅ مکمل</span>';
                planDone++;
            } else if (plannedCount > 0) {
                planBadge = `<span class="stat-badge badge-warning">⚠️ جزوی (${plannedCount}/${assignedSubjects.length})</span>`;
            } else {
                planBadge = '<span class="stat-badge badge-danger">❌ غیر مکمل</span>';
            }
        }

        // C. Nazim Checklist evaluations done on this teacher this month
        const teacherAudits = activeChecklists.filter(c => c.teacherId === teacher.id || String(c.teacherName).toLowerCase() === String(teacher.name).toLowerCase());
        const auditBadge = teacherAudits.length > 0 
            ? `<span class="stat-badge badge-success">✅ (${teacherAudits.length} معائنے)</span>` 
            : '<span class="stat-badge badge-danger">❌ کوئی معائنہ نہیں</span>';

        if (teacherAudits.length > 0) auditDone++;

        return `
            <tr>
                <td style="text-align:center; font-weight:700;">${index + 1}</td>
                <td style="font-weight:600;">${escapeHtml(teacher.name)}</td>
                <td>${examMarksBadge}</td>
                <td>${planBadge}</td>
                <td>${auditBadge}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('trackerGridBody').innerHTML = html;

    const planPct = trackerState.teachers.length > 0 ? Math.round((planDone / trackerState.teachers.length) * 100) : 0;
    const auditPct = trackerState.teachers.length > 0 ? Math.round((auditDone / trackerState.teachers.length) * 100) : 0;

    document.getElementById('statMetric1').innerText = `${planPct}%`;
    document.getElementById('statMetric2').innerText = `${auditPct}%`;
}

// 3. Annual compliance check
async function fetchAnnualCompliance() {
    const year = document.getElementById('trackerAnnualYear').value;
    if (!year) {
        alert('سال منتخب کریں۔');
        return;
    }

    document.getElementById('printMetaText').innerHTML = `نوعیت: <strong>سالانہ کام</strong> • تعلیمی سال: <strong>${year}</strong>`;
    document.getElementById('reportTitle').innerText = `ٹیچرز سالانہ کارکردگی ٹریکر - تعلیمی سال ${year}`;

    document.getElementById('metricTaskTitle1').innerText = 'سالانہ امتحانات';
    document.getElementById('metricTaskTitle2').innerText = 'تعلیمی اسناد';

    // Fetch all final term exams and all certificates
    const [examsSnap, certSnap] = await Promise.all([
        db.collection('exams').where('tenantId', '==', trackerState.tenantId).get(),
        db.collection('certificates').where('tenantId', '==', trackerState.tenantId).get()
    ]);

    const activeExams = [];
    examsSnap.forEach(doc => {
        const data = doc.data();
        if (data.term === 'سالانہ' || data.examType === 'second_term' || data.examType === 'annual') {
            activeExams.push(data);
        }
    });

    const activeCertificates = [];
    certSnap.forEach(doc => {
        activeCertificates.push(doc.data());
    });

    document.getElementById('trackerGridHead').innerHTML = `
        <tr>
            <th style="width: 8%;">شمار</th>
            <th style="width: 25%;">استاد کا نام</th>
            <th style="width: 33%;">سالانہ امتحانی نمبرات درج شدگی</th>
            <th style="width: 34%;">جاری کردہ اسناد (Certificates)</th>
        </tr>
    `;

    let examDone = 0;
    let certDone = 0;

    const html = trackerState.teachers.map((teacher, index) => {
        // A. Annual written exam marks
        const assignedSubjects = trackerState.subjects.filter(s => s.teacherId === teacher.id || s.teacherName === teacher.name);
        
        let annualExamBadge = '<span class="stat-badge badge-info">کوئی امتحان نہیں</span>';
        if (assignedSubjects.length > 0) {
            let totalExams = 0;
            let enteredExams = 0;

            assignedSubjects.forEach(sub => {
                const subjectExams = activeExams.filter(e => e.className === sub.className && (e.subject === sub.name || e.subjectId === sub.id));
                totalExams += subjectExams.length;
                subjectExams.forEach(e => {
                    if (e.enteredByTeacherName) enteredExams++;
                });
            });

            if (totalExams > 0) {
                if (enteredExams === totalExams) {
                    annualExamBadge = `<span class="stat-badge badge-success">✅ مکمل (${enteredExams}/${totalExams})</span>`;
                    examDone++;
                } else if (enteredExams > 0) {
                    annualExamBadge = `<span class="stat-badge badge-warning">⚠️ جزوی (${enteredExams}/${totalExams})</span>`;
                } else {
                    annualExamBadge = `<span class="stat-badge badge-danger">❌ غیر مکمل (0/${totalExams})</span>`;
                }
            }
        }

        // B. Certificates issued for graduating class
        // Find if this teacher is assigned as coordinator or has issued certs
        const teacherCerts = activeCertificates.filter(c => 
            c.issuedBy === teacher.id || 
            String(c.teacherName).toLowerCase() === String(teacher.name).toLowerCase()
        );

        const certBadge = teacherCerts.length > 0 
            ? `<span class="stat-badge badge-success">✅ (${teacherCerts.length} اسناد جاری کیں)</span>` 
            : '<span class="stat-badge badge-info">کوئی سند جاری نہیں ہوئی</span>';

        if (teacherCerts.length > 0) certDone++;

        return `
            <tr>
                <td style="text-align:center; font-weight:700;">${index + 1}</td>
                <td style="font-weight:600;">${escapeHtml(teacher.name)}</td>
                <td>${annualExamBadge}</td>
                <td>${certBadge}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('trackerGridBody').innerHTML = html;

    const examPct = trackerState.teachers.length > 0 ? Math.round((examDone / trackerState.teachers.length) * 100) : 0;
    const certPct = trackerState.teachers.length > 0 ? Math.round((certDone / trackerState.teachers.length) * 100) : 0;

    document.getElementById('statMetric1').innerText = `${examPct}%`;
    document.getElementById('statMetric2').innerText = `${certPct}%`;
}

// Escape tags helper
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
