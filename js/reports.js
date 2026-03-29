


let feeTrendChartInstance = null;
let studentChartInstance = null;
let cohortChartInstance = null;
let utilizationChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    refreshAllAnalytics();
});

function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

function isInTenant(data, tenantId) {
    return !data?.tenantId || data.tenantId === tenantId;
}

function monthNameToIndex(monthName) {
    const m = String(monthName || '').toLowerCase();
    const names = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    return names.indexOf(m);
}

function getRecentMonthBuckets(count = 6) {
    const now = new Date();
    const buckets = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
            year: d.getFullYear(),
            monthIndex: d.getMonth(),
            monthName: d.toLocaleString('default', { month: 'short' }),
            label: `${d.toLocaleString('default', { month: 'short' })} ${String(d.getFullYear()).slice(-2)}`
        });
    }
    return buckets;
}

function safeNumber(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function netFeeAmount(fee) {
    const amount = safeNumber(fee?.amount);
    const fine = safeNumber(fee?.fine);
    const discount = safeNumber(fee?.discount);
    return Math.max(0, Math.round((amount + fine - discount) * 100) / 100);
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function monthRangeFromInput(value) {
    const v = String(value || '');
    if (!/^\d{4}-\d{2}$/.test(v)) return null;
    const [yStr, mStr] = v.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    if (!year || !month) return null;
    const daysInMonth = new Date(year, month, 0).getDate();
    const start = `${year}-${pad2(month)}-01`;
    const end = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;
    return { year, month, start, end };
}

// ==========================================
// ANALYTICS
// ==========================================

async function refreshAllAnalytics() {
    wireAnalyticsControls();
    await initAnalytics();
    await renderAttendanceHeatmap();
    await renderCohortPerformance();
    await renderStaffUtilization();
    await loadRiskWatchlist();
}

function wireAnalyticsControls() {
    const heatMonth = document.getElementById('attHeatmapMonth');
    if (heatMonth && heatMonth.dataset.wired !== '1') {
        heatMonth.value = heatMonth.value || new Date().toISOString().slice(0, 7);
        heatMonth.addEventListener('change', () => renderAttendanceHeatmap());
        heatMonth.dataset.wired = '1';
    } else if (heatMonth && !heatMonth.value) {
        heatMonth.value = new Date().toISOString().slice(0, 7);
    }

    const riskDays = document.getElementById('riskDays');
    if (riskDays && !riskDays.value) riskDays.value = '30';
}

async function initAnalytics() {
    await renderFeeCollectionVsTarget();
    await renderStudentDistribution();
}

async function renderFeeCollectionVsTarget() {
    const ctxFee = document.getElementById('feeTrendChart');
    const meta = document.getElementById('feeTrendMeta');
    if (!ctxFee) return;

    if (feeTrendChartInstance) {
        feeTrendChartInstance.destroy();
        feeTrendChartInstance = null;
    }
    if (meta) meta.innerText = 'Loading...';

    try {
        const feeData = await getFeeCollectionVsTargetData();

        feeTrendChartInstance = new Chart(ctxFee, {
            type: 'line',
            data: {
                labels: feeData.labels,
                datasets: [
                    {
                        label: 'Collected (Rs)',
                        data: feeData.collected,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        fill: true,
                        tension: 0.35
                    },
                    {
                        label: 'Target / Billed (Rs)',
                        data: feeData.target,
                        borderColor: '#16a34a',
                        borderDash: [6, 6],
                        backgroundColor: 'rgba(22, 163, 74, 0.05)',
                        fill: false,
                        tension: 0.35
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { ticks: { callback: (v) => v.toLocaleString() } } }
            }
        });

        if (meta) {
            const totalTarget = feeData.target.reduce((a, b) => a + safeNumber(b), 0);
            const totalCollected = feeData.collected.reduce((a, b) => a + safeNumber(b), 0);
            const pct = totalTarget > 0 ? ((totalCollected / totalTarget) * 100).toFixed(1) : '0.0';
            meta.innerText = `Collected Rs. ${Math.round(totalCollected).toLocaleString()} / Target Rs. ${Math.round(totalTarget).toLocaleString()} (${pct}%)`;
        }
    } catch (error) {
        console.error("Error loading fee analytics:", error);
        if (meta) meta.innerText = 'Unable to load fee analytics (check permissions).';
    }
}

async function getFeeCollectionVsTargetData() {
    const tenantId = getTenantId();
    const buckets = getRecentMonthBuckets(6);
    const labels = buckets.map(b => b.label);
    const target = buckets.map(() => 0);
    const collected = buckets.map(() => 0);

    let feeDocs = [];
    try {
        let snap = await db.collection('fees')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .limit(2000)
            .get();
        feeDocs = snap.docs;

        if (feeDocs.length === 0) {
            snap = await db.collection('fees').orderBy('createdAt', 'desc').limit(2000).get();
            feeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    } catch (err) {
        console.warn('Fee analytics tenant query fallback', err?.message || err);
        try {
            const snap = await db.collection('fees').orderBy('createdAt', 'desc').limit(2000).get();
            feeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        } catch (err2) {
            console.warn('Fee analytics full fallback', err2?.message || err2);
            const snap = await db.collection('fees').limit(2000).get();
            feeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    }

    feeDocs.forEach(doc => {
        const f = doc.data() || {};
        if (!isInTenant(f, tenantId)) return;

        const year = parseInt(f.year, 10);
        const monthIndex = monthNameToIndex(f.month);
        if (!year || monthIndex < 0) return;

        const idx = buckets.findIndex(b => b.year === year && b.monthIndex === monthIndex);
        if (idx < 0) return;

        const net = netFeeAmount(f);
        target[idx] += net;
        if (String(f.status || '').toLowerCase() === 'paid') {
            collected[idx] += net;
        }
    });

    return {
        labels,
        target: target.map(v => Math.round(v * 100) / 100),
        collected: collected.map(v => Math.round(v * 100) / 100)
    };
}

async function renderStudentDistribution() {
    const ctxStudent = document.getElementById('studentChart');
    if (!ctxStudent) return;

    if (studentChartInstance) {
        studentChartInstance.destroy();
        studentChartInstance = null;
    }

    try {
        const studentData = await getStudentDistributionData();

        studentChartInstance = new Chart(ctxStudent, {
            type: 'bar',
            data: {
                labels: studentData.labels,
                datasets: [{
                    label: 'Students',
                    data: studentData.data,
                    backgroundColor: '#16a34a',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    } catch (error) {
        console.error("Error loading student distribution:", error);
    }
}

async function getStudentDistributionData() {
    const tenantId = getTenantId();
    let docs = [];

    try {
        let snap = await db.collection('students').where('tenantId', '==', tenantId).orderBy('firstName').limit(800).get();
        docs = snap.docs;

        if (docs.length === 0) {
            snap = await db.collection('students').orderBy('firstName').limit(800).get();
            docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    } catch (err) {
        console.warn('Students tenant query fallback', err?.message || err);
        try {
            const snap = await db.collection('students').orderBy('firstName').limit(800).get();
            docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        } catch (err2) {
            console.warn('Students full fallback', err2?.message || err2);
            const snap = await db.collection('students').limit(800).get();
            docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    }

    const classUrdu = {
        "Aamma Year 1": "عامہ سال اول",
        "Aamma Year 2": "عامہ سال دوم",
        "Khassa Year 1": "خاصہ سال اول",
        "Khassa Year 2": "خاصہ سال دوم",
        "Aliya Year 1": "عالیہ سال اول",
        "Aliya Year 2": "عالیہ سال دوم",
        "Alamiya Year 1": "عالمیہ سال اول",
        "Alamiya Year 2": "عالمیہ سال دوم",
        "Aamma Year 1 (Arabic Language Foundation Course)": "عامہ سال اول (عریبک لینگوئج کورس)",
        "Aamma Year 2 (English Language Foundation Course)": "عامہ سال دوم (انگلش لینگوئج کورس)",
        "Hifz Class": "حفظ کلاس",
        "Abee Bin Kaab": "ابی بن کعب",
        "Zaid Bin Sabit": "زید بن ثابت",
        "Abdullah Bin Abbas": "عبداللہ بن عباس",
        "Abdullah Bin Masood": "عبداللہ بن مسعود",
        "Osman Ghani": "عثمان غنی",
        "Musab Bin Omair": "مصعب بن عمیر",
        "Abu Bakar Siddique": "ابوبکر صدیق",
        "Amer Bin Khatab": "عمر بن خطاب",
        "Naseerah Murseed": "نصیرہ مرشد",
        "Tajweed Class 1st year": "تجوید کلاس سال اول",
        "Tajweed Class 2nd year": "تجوید کلاس سال دوم",
        "Class 1st year": "تجوید کلاس سال اول",
        "Class 2nd year": "تجوید کلاس سال دوم"
    };

    const classCounts = {};
    docs.forEach(doc => {
        const s = doc.data() || {};
        if (!isInTenant(s, tenantId)) return;
        const clsRaw = s.className || s.admissionClass || 'Unknown';
        const clsUrduName = s.className_ur || classUrdu[clsRaw] || clsRaw;
        classCounts[clsUrduName] = (classCounts[clsUrduName] || 0) + 1;
    });

    const labels = Object.keys(classCounts).sort((a, b) => a.localeCompare(b));
    return {
        labels,
        data: labels.map(k => classCounts[k])
    };
}

async function renderAttendanceHeatmap() {
    const container = document.getElementById('attendanceHeatmap');
    const monthInput = document.getElementById('attHeatmapMonth');
    if (!container || !monthInput) return;

    const range = monthRangeFromInput(monthInput.value);
    if (!range) {
        container.innerHTML = '<p style="color: var(--text-light);">Select a month to view attendance.</p>';
        return;
    }

    container.innerHTML = '<p style="color: var(--text-light);">Loading...</p>';

    const tenantId = getTenantId();
    let attDocs = [];

    try {
        const snap = await db.collection('attendance')
            .where('date', '>=', range.start)
            .where('date', '<=', range.end)
            .orderBy('date', 'asc')
            .limit(800)
            .get();
        attDocs = snap.docs;
    } catch (err) {
        console.warn('Attendance heatmap query fallback', err?.message || err);
        try {
            const snap = await db.collection('attendance').orderBy('date', 'desc').limit(800).get();
            attDocs = snap.docs.filter(d => {
                const a = d.data() || {};
                return a.date >= range.start && a.date <= range.end;
            });
        } catch (err2) {
            console.warn('Attendance heatmap full fallback', err2?.message || err2);
            const snap = await db.collection('attendance').limit(800).get();
            attDocs = snap.docs.filter(d => {
                const a = d.data() || {};
                return a.date >= range.start && a.date <= range.end;
            });
        }
    }

    const dayAgg = new Map(); // date -> { present, total }
    let totalSessions = 0;
    let totalPresent = 0;

    attDocs.forEach(d => {
        const a = d.data() || {};
        if (!isInTenant(a, tenantId)) return;
        const date = a.date;
        if (!date || date < range.start || date > range.end) return;

        const records = Array.isArray(a.records) ? a.records : [];
        if (!records.length) return;

        let present = 0;
        let total = 0;
        records.forEach(r => {
            total += 1;
            if (String(r?.status || '').toLowerCase() === 'present') present += 1;
        });

        totalSessions += total;
        totalPresent += present;

        const existing = dayAgg.get(date) || { present: 0, total: 0 };
        existing.present += present;
        existing.total += total;
        dayAgg.set(date, existing);
    });

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const year = range.year;
    const monthIndex = range.month - 1; // 0-based
    const daysInMonth = new Date(year, range.month, 0).getDate();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();

    const ratioColor = (ratio) => {
        if (!Number.isFinite(ratio)) return '#f8fafc';
        const hue = Math.max(0, Math.min(120, Math.round(ratio * 120)));
        return `hsl(${hue}, 70%, 88%)`;
    };

    const header = `
        <div class="heatmap-grid" style="margin-bottom: 0.5rem;">
            ${weekdayLabels.map(w => `<div class="heatmap-weekday">${w}</div>`).join('')}
        </div>
    `;

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) {
        cells.push('<div></div>');
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${pad2(range.month)}-${pad2(day)}`;
        const agg = dayAgg.get(dateStr);
        const total = agg?.total || 0;
        const present = agg?.present || 0;
        const ratio = total > 0 ? present / total : null;
        const pct = total > 0 ? Math.round(ratio * 100) : null;
        const bg = total > 0 ? ratioColor(ratio) : '#f8fafc';
        const title = total > 0
            ? `${dateStr} - ${present}/${total} present (${pct}%)`
            : `${dateStr} - No attendance records`;

        cells.push(`
            <div class="heatmap-cell" style="background: ${bg};" title="${title}">
                <div class="day">${day}</div>
                <div class="pct">${total > 0 ? `${pct}%` : '-'}</div>
            </div>
        `);
    }

    const avgPct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;
    const summary = `
        <div style="margin-top: 0.75rem; color: var(--text-light); font-size: 0.85rem;">
            Overall for month: ${avgPct}% present (${totalPresent.toLocaleString()}/${totalSessions.toLocaleString()} sessions).
        </div>
    `;

    container.innerHTML = header + `<div class="heatmap-grid">${cells.join('')}</div>` + summary;
}

async function renderCohortPerformance() {
    const ctx = document.getElementById('cohortPerformanceChart');
    const meta = document.getElementById('cohortMeta');
    if (!ctx) return;

    if (cohortChartInstance) {
        cohortChartInstance.destroy();
        cohortChartInstance = null;
    }
    if (meta) meta.innerText = 'Loading...';

    const tenantId = getTenantId();
    let gradeDocs = [];

    try {
        const snap = await db.collection('grades').orderBy('updatedAt', 'desc').limit(200).get();
        gradeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    } catch (err) {
        console.warn('Grades query fallback', err?.message || err);
        const snap = await db.collection('grades').limit(200).get();
        gradeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    }

    const aggByClass = new Map(); // class -> { obtained, total, exams }
    let examsUsed = 0;

    gradeDocs.forEach(doc => {
        const g = doc.data() || {};
        if (!isInTenant(g, tenantId)) return;

        const records = Array.isArray(g.records) ? g.records : [];
        if (!records.length) return;

        let sumObt = 0;
        let sumTot = 0;
        records.forEach(r => {
            const obt = safeNumber(r?.obtained);
            const tot = safeNumber(r?.total);
            if (tot <= 0) return;
            sumObt += obt;
            sumTot += tot;
        });

        if (sumTot <= 0) return;

        const classUrdu = {
            "Aamma Year 1": "عامہ سال اول",
            "Aamma Year 2": "عامہ سال دوم",
            "Khassa Year 1": "خاصہ سال اول",
            "Khassa Year 2": "خاصہ سال دوم",
            "Aliya Year 1": "عالیہ سال اول",
            "Aliya Year 2": "عالیہ سال دوم",
            "Alamiya Year 1": "عالمیہ سال اول",
            "Alamiya Year 2": "عالمیہ سال دوم",
            "Aamma Year 1 (Arabic Language Foundation Course)": "عامہ سال اول (عریبک لینگوئج کورس)",
            "Aamma Year 2 (English Language Foundation Course)": "عامہ سال دوم (انگلش لینگوئج کورس)",
            "Hifz Class": "حفظ کلاس",
            "Abee Bin Kaab": "ابی بن کعب",
            "Zaid Bin Sabit": "زید بن ثابت",
            "Abdullah Bin Abbas": "عبداللہ بن عباس",
            "Abdullah Bin Masood": "عبداللہ بن مسعود",
            "Osman Ghani": "عثمان غنی",
            "Musab Bin Omair": "مصعب بن عمیر",
            "Abu Bakar Siddique": "ابوبکر صدیق",
            "Amer Bin Khatab": "عمر بن خطاب",
            "Naseerah Murseed": "نصیرہ مرشد",
            "Tajweed Class 1st year": "تجوید کلاس سال اول",
            "Tajweed Class 2nd year": "تجوید کلاس سال دوم",
            "Class 1st year": "تجوید کلاس سال اول",
            "Class 2nd year": "تجوید کلاس سال دوم"
        };
        const rawClassName = g.className || 'Unknown';
        const className = g.className_ur || classUrdu[rawClassName] || rawClassName;

        const existing = aggByClass.get(className) || { obtained: 0, total: 0, exams: 0 };
        existing.obtained += sumObt;
        existing.total += sumTot;
        existing.exams += 1;
        aggByClass.set(className, existing);
        examsUsed += 1;
    });

    const rows = Array.from(aggByClass.entries()).map(([className, v]) => {
        const pct = v.total > 0 ? (v.obtained / v.total) * 100 : 0;
        return { className, pct: Math.round(pct * 10) / 10, exams: v.exams };
    }).sort((a, b) => b.pct - a.pct);

    if (!rows.length) {
        if (meta) meta.innerText = 'No grade data found.';
        return;
    }

    const labels = rows.map(r => r.className);
    const data = rows.map(r => r.pct);

    cohortChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Average %',
                data,
                backgroundColor: '#0ea5e9',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });

    if (meta) {
        const top = rows[0];
        meta.innerText = `Based on up to ${Math.min(200, gradeDocs.length)} grade documents. Top: ${(typeof getClassDisplayName === 'function') ? getClassDisplayName(top.className || '', top.className_ur || '') : (top.className_ur || top.className || '')} (${top.pct}%).`;
    }
}

async function renderStaffUtilization() {
    const ctx = document.getElementById('staffUtilizationChart');
    const meta = document.getElementById('utilizationMeta');
    if (!ctx) return;

    if (utilizationChartInstance) {
        utilizationChartInstance.destroy();
        utilizationChartInstance = null;
    }
    if (meta) meta.innerText = 'Loading...';

    const tenantId = getTenantId();
    let timetableDocs = [];

    try {
        const snap = await db.collection('timetable').limit(2000).get();
        timetableDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    } catch (err) {
        console.warn('Timetable query failed', err?.message || err);
        if (meta) meta.innerText = 'Unable to load timetable data.';
        return;
    }

    const counts = new Map(); // teacherId -> count
    timetableDocs.forEach(doc => {
        const t = doc.data() || {};
        if (!isInTenant(t, tenantId)) return;
        const teacherId = t.teacherId || '';
        if (!teacherId) return;
        counts.set(teacherId, (counts.get(teacherId) || 0) + 1);
    });

    if (counts.size === 0) {
        if (meta) meta.innerText = 'No timetable entries found.';
        return;
    }

    let teacherDocs = [];
    try {
        const snap = await db.collection('teachers').orderBy('firstName').limit(800).get();
        teacherDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    } catch (err) {
        console.warn('Teachers query fallback', err?.message || err);
        const snap = await db.collection('teachers').limit(800).get();
        teacherDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    }

    const teacherNameById = new Map();
    teacherDocs.forEach(d => {
        const t = d.data() || {};
        const name = `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.name || d.id;
        teacherNameById.set(d.id, name);
    });

    const rows = Array.from(counts.entries()).map(([teacherId, count]) => ({
        teacherId,
        name: teacherNameById.get(teacherId) || teacherId,
        count
    })).sort((a, b) => b.count - a.count).slice(0, 12);

    utilizationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: rows.map(r => r.name),
            datasets: [{
                label: 'Periods/Week',
                data: rows.map(r => r.count),
                backgroundColor: '#9333ea',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });

    if (meta) {
        const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
        meta.innerText = `Teachers: ${counts.size}. Total scheduled periods/week: ${total}.`;
    }
}

async function loadRiskWatchlist() {
    const tbody = document.getElementById('riskList');
    const summaryEl = document.getElementById('riskSummary');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-light);">Loading...</td></tr>';
    if (summaryEl) summaryEl.innerText = '';

    const tenantId = getTenantId();
    const days = parseInt(document.getElementById('riskDays')?.value || '30', 10) || 30;

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - Math.max(1, days) + 1);
    const startStr = start.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    // 1) Students
    let studentDocs = [];
    try {
        const snap = await db.collection('students').orderBy('firstName').limit(800).get();
        studentDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    } catch (err) {
        console.warn('Students list fallback', err?.message || err);
        const snap = await db.collection('students').limit(800).get();
        studentDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    }

    const students = studentDocs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    const studentById = new Map(students.map(s => [s.uid || s.id, s]));

    // 2) Pending fees (arrears)
    const fees = [];
    const fetchFeesByStatus = async (status) => {
        try {
            let snap = await db.collection('fees')
                .where('tenantId', '==', tenantId)
                .where('status', '==', status)
                .limit(2000)
                .get();
            let docs = snap.docs;
            if (docs.length === 0) {
                snap = await db.collection('fees').where('status', '==', status).limit(2000).get();
                docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
            }
            return docs.map(d => d.data() || {}).filter(f => isInTenant(f, tenantId));
        } catch (err) {
            console.warn(`Fees status "${status}" query fallback`, err?.message || err);
            const snap = await db.collection('fees').where('status', '==', status).limit(2000).get();
            return snap.docs.map(d => d.data() || {}).filter(f => isInTenant(f, tenantId));
        }
    };

    try {
        fees.push(...await fetchFeesByStatus('Pending'));
        fees.push(...await fetchFeesByStatus('Overdue'));
    } catch (err) {
        console.warn('Fees fetch failed', err?.message || err);
    }

    const arrearsByStudent = new Map(); // id -> { arrears, overdueCount }
    let totalOutstanding = 0;
    let totalOverdueItems = 0;

    fees.forEach(f => {
        const studentId = f.studentId || f.uid;
        if (!studentId) return;
        const net = netFeeAmount(f);
        if (!net) return;

        const due = f.dueDate ? String(f.dueDate) : '';
        const isOverdue = due && due < todayStr;

        const entry = arrearsByStudent.get(studentId) || { arrears: 0, overdueCount: 0 };
        entry.arrears += net;
        if (isOverdue) entry.overdueCount += 1;
        arrearsByStudent.set(studentId, entry);

        totalOutstanding += net;
        if (isOverdue) totalOverdueItems += 1;
    });

    // 3) Attendance sessions (last N days)
    let attDocs = [];
    try {
        const snap = await db.collection('attendance')
            .where('date', '>=', startStr)
            .where('date', '<=', todayStr)
            .orderBy('date', 'asc')
            .limit(800)
            .get();
        attDocs = snap.docs;
    } catch (err) {
        console.warn('Attendance risk query fallback', err?.message || err);
        try {
            const snap = await db.collection('attendance').orderBy('date', 'desc').limit(800).get();
            attDocs = snap.docs.filter(d => {
                const a = d.data() || {};
                return a.date >= startStr && a.date <= todayStr;
            });
        } catch (err2) {
            console.warn('Attendance risk full fallback', err2?.message || err2);
            const snap = await db.collection('attendance').limit(800).get();
            attDocs = snap.docs.filter(d => {
                const a = d.data() || {};
                return a.date >= startStr && a.date <= todayStr;
            });
        }
    }

    const attendanceByStudent = new Map(); // id -> { present, total }
    let totalAttendanceSessions = 0;
    let totalAttendancePresent = 0;

    attDocs.forEach(d => {
        const a = d.data() || {};
        if (!isInTenant(a, tenantId)) return;
        const date = a.date;
        if (!date || date < startStr || date > todayStr) return;
        const records = Array.isArray(a.records) ? a.records : [];
        records.forEach(r => {
            const sid = r?.uid;
            if (!sid) return;
            const entry = attendanceByStudent.get(sid) || { present: 0, total: 0 };
            entry.total += 1;
            if (String(r?.status || '').toLowerCase() === 'present') entry.present += 1;
            attendanceByStudent.set(sid, entry);

            totalAttendanceSessions += 1;
            if (String(r?.status || '').toLowerCase() === 'present') totalAttendancePresent += 1;
        });
    });

    // 4) Score + top list
    const maxArrears = Math.max(1, ...Array.from(arrearsByStudent.values()).map(v => v.arrears || 0));
    const rows = [];

    studentById.forEach((s, sid) => {
        const arrears = arrearsByStudent.get(sid)?.arrears || 0;
        const overdueCount = arrearsByStudent.get(sid)?.overdueCount || 0;
        const att = attendanceByStudent.get(sid) || { present: 0, total: 0 };
        const attendanceRate = att.total > 0 ? (att.present / att.total) : null;

        if (arrears <= 0 && (attendanceRate === null || attendanceRate >= 0.9)) return;

        const arrearsScore = Math.min(1, arrears / maxArrears);
        const attendanceScore = attendanceRate === null ? 0.25 : (1 - attendanceRate);
        const overdueScore = Math.min(1, overdueCount / 5);

        const riskScore = (0.55 * arrearsScore) + (0.35 * attendanceScore) + (0.10 * overdueScore);

        const classUrdu = {
            "Aamma Year 1": "عامہ سال اول",
            "Aamma Year 2": "عامہ سال دوم",
            "Khassa Year 1": "خاصہ سال اول",
            "Khassa Year 2": "خاصہ سال دوم",
            "Aliya Year 1": "عالیہ سال اول",
            "Aliya Year 2": "عالیہ سال دوم",
            "Alamiya Year 1": "عالمیہ سال اول",
            "Alamiya Year 2": "عالمیہ سال دوم",
            "Aamma Year 1 (Arabic Language Foundation Course)": "عامہ سال اول (عریبک لینگوئج کورس)",
            "Aamma Year 2 (English Language Foundation Course)": "عامہ سال دوم (انگلش لینگوئج کورس)",
            "Hifz Class": "حفظ کلاس",
            "Abee Bin Kaab": "ابی بن کعب",
            "Zaid Bin Sabit": "زید بن ثابت",
            "Abdullah Bin Abbas": "عبداللہ بن عباس",
            "Abdullah Bin Masood": "عبداللہ بن مسعود",
            "Osman Ghani": "عثمان غنی",
            "Musab Bin Omair": "مصعب بن عمیر",
            "Abu Bakar Siddique": "ابوبکر صدیق",
            "Amer Bin Khatab": "عمر بن خطاب",
            "Naseerah Murseed": "نصیرہ مرشد",
            "Tajweed Class 1st year": "تجوید کلاس سال اول",
            "Tajweed Class 2nd year": "تجوید کلاس سال دوم",
            "Class 1st year": "تجوید کلاس سال اول",
            "Class 2nd year": "تجوید کلاس سال دوم"
        };
        const rawCls = s.className || '-';
        const className = s.className_ur || classUrdu[rawCls] || rawCls;

        rows.push({
            sid,
            name: s.name_ur || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || sid,
            className: className,
            arrears: Math.round(arrears * 100) / 100,
            overdueCount,
            attendanceRate,
            riskScore: Math.round(riskScore * 1000) / 1000
        });
    });

    rows.sort((a, b) => b.riskScore - a.riskScore);
    const top = rows.slice(0, 12);

    if (summaryEl) {
        const defaulters = Array.from(arrearsByStudent.values()).filter(v => (v.arrears || 0) > 0).length;
        const overallAttPct = totalAttendanceSessions > 0 ? Math.round((totalAttendancePresent / totalAttendanceSessions) * 100) : 0;
        summaryEl.innerText = `Outstanding: Rs. ${Math.round(totalOutstanding).toLocaleString()} | Defaulters: ${defaulters} | Overdue items: ${totalOverdueItems} | Recent attendance: ${overallAttPct}%`;
    }

    if (!top.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-light);">No risk signals found for this period.</td></tr>';
        return;
    }

    const riskBadge = (score) => {
        if (score >= 0.7) return { cls: 'risk-high', label: 'High' };
        if (score >= 0.4) return { cls: 'risk-medium', label: 'Medium' };
        return { cls: 'risk-low', label: 'Low' };
    };

    tbody.innerHTML = top.map(r => {
        const attPct = r.attendanceRate === null ? '-' : `${Math.round(r.attendanceRate * 100)}%`;
        const badge = riskBadge(r.riskScore);
        return `
            <tr>
                <td>${r.name}</td>
                <td>${(typeof getClassDisplayName === 'function') ? getClassDisplayName(r.className || '', r.className_ur || '') : (r.className_ur || r.className || '')}</td>
                <td>${r.arrears.toLocaleString()}</td>
                <td>${r.overdueCount}</td>
                <td>${attPct}</td>
                <td><span class="risk-pill ${badge.cls}">${badge.label}</span></td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// REPORT GENERATION
// ==========================================

async function generateReport(type, format) {
    document.body.style.cursor = 'wait';

    try {
        let data = [];
        let columns = [];
        let title = '';

        // 1. Fetch Data
        if (type === 'students') {
            const res = await fetchStudentData();
            data = res.data;
            columns = res.columns;
            title = res.title;
        } else if (type === 'teachers') {
            const res = await fetchTeacherData();
            data = res.data;
            columns = res.columns;
            title = res.title;
        } else if (type === 'finance') {
            const res = await fetchFinanceData();
            data = res.data;
            columns = res.columns;
            title = res.title;
        } else if (type === 'fees') {
            const res = await fetchFeesData();
            data = res.data;
            columns = res.columns;
            title = res.title;
        }

        if (data.length === 0) {
            alert("No data found for this report.");
            document.body.style.cursor = 'default';
            return;
        }

        // 2. Generate File
        if (format === 'pdf') {
            await generatePDF(data, columns, title);
        } else if (format === 'excel') {
            generateExcel(data, columns, title);
        } else if (format === 'csv') {
            generateCSV(data, columns, title);
        }

    } catch (error) {
        console.error("Error generating report:", error);
        alert("Failed to generate report: " + error.message);
    } finally {
        document.body.style.cursor = 'default';
    }
}

// ==========================================
// DATA FETCHERS
// ==========================================

async function fetchStudentData() {
    const classFilter = document.getElementById('studentClassFilter').value;
    const snapshot = await db.collection('students').orderBy('firstName').get();

    const classUrdu = {
        "Aamma Year 1": "عامہ سال اول",
        "Aamma Year 2": "عامہ سال دوم",
        "Khassa Year 1": "خاصہ سال اول",
        "Khassa Year 2": "خاصہ سال دوم",
        "Aliya Year 1": "عالیہ سال اول",
        "Aliya Year 2": "عالیہ سال دوم",
        "Alamiya Year 1": "عالمیہ سال اول",
        "Alamiya Year 2": "عالمیہ سال دوم",
        "Aamma Year 1 (Arabic Language Foundation Course)": "عامہ سال اول (عریبک لینگوئج کورس)",
        "Aamma Year 2 (English Language Foundation Course)": "عامہ سال دوم (انگلش لینگوئج کورس)",
        "Hifz Class": "حفظ کلاس",
        "Abee Bin Kaab": "ابی بن کعب",
        "Zaid Bin Sabit": "زید بن ثابت",
        "Abdullah Bin Abbas": "عبداللہ بن عباس",
        "Abdullah Bin Masood": "عبداللہ بن مسعود",
        "Osman Ghani": "عثمان غنی",
        "Musab Bin Omair": "مصعب بن عمیر",
        "Abu Bakar Siddique": "ابوبکر صدیق",
        "Amer Bin Khatab": "عمر بن خطاب",
        "Naseerah Murseed": "نصیرہ مرشد",
        "Tajweed Class 1st year": "تجوید کلاس سال اول",
        "Tajweed Class 2nd year": "تجوید کلاس سال دوم",
        "Class 1st year": "تجوید کلاس سال اول",
        "Class 2nd year": "تجوید کلاس سال دوم"
    };

    const data = [];
    snapshot.forEach(d => {
        const s = d.data();
        if (classFilter && s.className !== classFilter) return;

        const displayClass = s.className_ur || classUrdu[s.className] || s.className || '-';

        data.push({
            'Name': s.name_ur || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            'Roll No': s.rollNumber || '-',
            'Father Name': s.parentName || '-',
            'Class': displayClass,
            'Phone': s.parentPhone || s.phone || '-'
        });
    });

    let title = 'Student Report';
    if (classFilter) {
        const titleClass = classUrdu[classFilter] || classFilter;
        title += ` - Class ${titleClass}`;
    }

    return {
        data,
        columns: ['Name', 'Roll No', 'Father Name', 'Class', 'Phone'],
        title
    };
}

async function fetchTeacherData() {
    const snapshot = await db.collection('teachers').orderBy('firstName').get();
    const data = [];

    snapshot.forEach(d => {
        const t = d.data();
        data.push({
            'Name': `${t.firstName || ''} ${t.lastName || ''}`.trim(),
            'Subject': t.subject || '-',
            'Phone': t.phone || '-',
            'Email': t.email || '-'
        });
    });

    return {
        data,
        columns: ['Name', 'Subject', 'Phone', 'Email'],
        title: 'Teachers Report'
    };
}

async function fetchFeesData() {
    const statusFilter = document.getElementById('feeStatusFilter').value;
    let query = db.collection('fees').orderBy('createdAt', 'desc');

    if (statusFilter) {
        query = query.where('status', '==', statusFilter);
    }

    const snapshot = await query.limit(100).get();
    const data = [];

    snapshot.forEach(d => {
        const f = d.data();
        data.push({
            'Student Name': f.studentName || '-',
            'Amount': f.amount || 0,
            'Month': `${f.month} ${f.year}`,
            'Status': f.status || 'Pending',
            'Date': f.date || '-'
        });
    });

    return {
        data,
        columns: ['Student Name', 'Amount', 'Month', 'Status', 'Date'],
        title: 'Fees Report'
    };
}

async function fetchFinanceData() {
    const monthFilter = document.getElementById('financeMonthFilter').value;
    let expensesQuery = db.collection('expenses');
    let incomesQuery = db.collection('incomes');

    if (monthFilter) {
        const start = monthFilter + '-01';
        const end = monthFilter + '-31';
        expensesQuery = expensesQuery.where('date', '>=', start).where('date', '<=', end);
        incomesQuery = incomesQuery.where('date', '>=', start).where('date', '<=', end);
    } else {
        expensesQuery = expensesQuery.orderBy('date', 'desc').limit(50);
        incomesQuery = incomesQuery.orderBy('date', 'desc').limit(50);
    }

    const [expensesSnapshot, incomeSnapshot] = await Promise.all([
        expensesQuery.get(),
        incomesQuery.get()
    ]);

    const data = [];

    incomeSnapshot.forEach(d => {
        const i = d.data();
        data.push({
            'Date': i.date,
            'Type': 'Income',
            'Title': i.title,
            'Category': i.category || '-',
            'Amount': parseFloat(i.amount) || 0
        });
    });

    expensesSnapshot.forEach(d => {
        const e = d.data();
        data.push({
            'Date': e.date,
            'Type': 'Expense',
            'Title': e.title,
            'Category': e.category || '-',
            'Amount': -(parseFloat(e.amount) || 0) // Negative for expense visual
        });
    });

    // Sort by date desc
    data.sort((a, b) => new Date(b.Date) - new Date(a.Date));

    return {
        data,
        columns: ['Date', 'Type', 'Title', 'Category', 'Amount'],
        title: 'Finance Report'
    };
}

// ==========================================
// GENERATORS
// ==========================================

async function generatePDF(data, columns, title) {
    const tableElement = document.createElement('table');
    tableElement.className = 'data-table';

    let thead = '<thead><tr>';
    columns.forEach(col => {
        thead += `<th>${col}</th>`;
    });
    thead += '</tr></thead>';

    let tbody = '<tbody>';
    data.forEach(item => {
        tbody += '<tr>';
        columns.forEach(col => {
            const val = item[col];
            tbody += `<td>${val !== null && val !== undefined ? String(val) : ''}</td>`;
        });
        tbody += '</tr>';
    });
    tbody += '</tbody>';

    tableElement.innerHTML = thead + tbody;

    window.PDFSnapshot.generate({
        title: title,
        content: tableElement.outerHTML
    });
}
