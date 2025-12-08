// Auth Logic
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const roleSelect = document.getElementById('role');
    const selectedRole = roleSelect ? roleSelect.value : 'student';

    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Signing in...';
    btn.disabled = true;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Check if user exists in Firestore, if not create with selected role
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (!userDoc.exists) {
            await db.collection("users").doc(user.uid).set({
                email: email,
                role: selectedRole,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Auth state listener will handle the rest
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        localStorage.removeItem('currentUser');

        // Redirect logic
        if (window.location.pathname.includes('/pages/')) {
            window.location.href = '../../index.html';
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

// Global Auth Check & Dashboard Init
auth.onAuthStateChanged(async (user) => {
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');

    if (user) {
        if (isLoginPage) {
            window.location.href = 'dashboard.html';
        } else {
            // We are on a protected page (Dashboard or Inner Page)
            // Ensure we have user details (Role) to render the sidebar
            let currentUser = JSON.parse(localStorage.getItem('currentUser'));

            // If local storage is missing or doesn't match auth user, fetch fresh data
            if (!currentUser || currentUser.uid !== user.uid) {
                console.log("Fetching user data from Firestore...");
                let role = 'student'; // Default
                try {
                    const userDoc = await db.collection("users").doc(user.uid).get();
                    if (userDoc.exists) {
                        role = userDoc.data().role;
                    } else {
                        // Fallback to admin for testing/fresh version if no role in DB
                        role = 'admin';
                    }
                } catch (e) {
                    console.log("Error fetching role:", e);
                    role = 'admin'; // Fallback
                }

                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    role: role,
                    name: user.displayName || user.email.split('@')[0]
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }

            // Initialize Dashboard/Sidebar
            initDashboard(currentUser);
        }
    } else {
        if (!isLoginPage) {
            // Check if we are already redirecting to avoid loops
            if (!window.location.href.includes('index.html')) {
                window.location.href = window.location.pathname.includes('/pages/') ? '../../index.html' : 'index.html';
            }
        }
    }
});

// Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // We rely on onAuthStateChanged to trigger initDashboard now, 
    // but we can also check localStorage for immediate render to avoid flicker
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && !loginForm) {
        initDashboard(user);
    }
});

function initDashboard(user) {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');

    if (nameEl) nameEl.innerText = user.name;
    if (roleEl) roleEl.innerText = user.role.toUpperCase();

    renderSidebar(user.role);
}

function renderSidebar(role) {
    const sidebarNav = document.getElementById('sidebarNav');
    if (!sidebarNav) return;

    // Clear existing to avoid duplicates if called multiple times
    sidebarNav.innerHTML = '';

    const isInPages = window.location.pathname.includes('/pages/');
    const basePath = isInPages ? '../../' : '';

    const commonLinks = [
        { name: 'Dashboard', icon: '📊', href: basePath + 'dashboard.html' }
    ];

    const roleLinks = {
        admin: [
            { name: 'Attendance', icon: '✅', href: basePath + 'pages/admin/attendance.html' },
            { name: 'Attendance Report', icon: '📄', href: basePath + 'pages/admin/attendance-report.html' },
            { name: 'Classes', icon: '🏫', href: basePath + 'pages/admin/classes.html' },
            { name: 'Subjects', icon: '📚', href: basePath + 'pages/admin/subjects.html' },
            { name: 'Students', icon: '👨‍🎓', href: basePath + 'pages/admin/students.html' },
            { name: 'Teachers', icon: '👨‍🏫', href: basePath + 'pages/admin/teachers.html' },
            { name: 'Fees', icon: '💰', href: basePath + 'pages/admin/fees.html' },
            { name: 'Timetable', icon: '📅', href: basePath + 'pages/admin/timetable.html' },
            { name: 'Exams', icon: '📝', href: basePath + 'pages/admin/exams.html' },
            { name: 'Finance', icon: '💵', href: basePath + 'pages/admin/finance.html' },
            { name: 'Reports', icon: '📄', href: basePath + 'pages/admin/reports.html' },
            { name: 'Users', icon: '👥', href: basePath + 'pages/admin/users.html' },
            { name: 'Backup', icon: '💾', href: basePath + 'pages/admin/backup.html' }
        ],
        teacher: [
            { name: 'Attendance', icon: '✅', href: basePath + 'pages/teacher/attendance.html' },
            { name: 'Report', icon: '📄', href: basePath + 'pages/teacher/attendance-report.html' },
            { name: 'Grades', icon: '📝', href: basePath + 'pages/teacher/grades.html' },
            { name: 'Timetable', icon: '📅', href: basePath + 'pages/teacher/timetable.html' }
        ],
        student: [
            { name: 'My Attendance', icon: '✅', href: basePath + 'pages/student/attendance.html' },
            { name: 'My Timetable', icon: '📅', href: basePath + 'pages/student/timetable.html' },
            { name: 'Results', icon: '🏆', href: basePath + 'pages/student/results.html' }
        ]
    };

    // Normalize role to lowercase to match keys
    const normalizedRole = role ? role.toLowerCase() : 'student';
    const links = [...commonLinks, ...(roleLinks[normalizedRole] || [])];

    sidebarNav.innerHTML = links.map(link => `
        <a href="${link.href}" class="nav-item ${window.location.href.includes(link.href) ? 'active' : ''}">
            <span class="nav-icon">${link.icon}</span>
            ${link.name}
        </a>
    `).join('');

    const logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.className = 'nav-item';
    logoutBtn.style.marginTop = 'auto';
    logoutBtn.style.color = 'var(--danger)';
    logoutBtn.innerHTML = '<span class="nav-icon">🚪</span>Logout';
    logoutBtn.onclick = (e) => {
        e.preventDefault();
        handleLogout();
    };
    sidebarNav.appendChild(logoutBtn);
}
