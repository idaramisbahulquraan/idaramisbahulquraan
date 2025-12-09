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
            
            // Initialize AI Features (Global)
            initGlobalAI();
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
        initGlobalAI();
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
            { name: 'Certificates', icon: '📜', href: basePath + 'pages/admin/certificates.html' },
            { name: 'AI Features', icon: '🤖', href: basePath + 'pages/admin/ai-features.html' },
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

// ==========================================
// AI & Floating Bot Logic
// ==========================================

// Configuration
const DEFAULT_API_KEY = 'AIzaSyAxCy2QhsxS1rLHeXPKe1b6iaMTq3UIRFM';

// Ensure marked.js is loaded
function ensureMarkedLib() {
    if (typeof marked === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        document.head.appendChild(script);
    }
}

function initGlobalAI() {
    ensureMarkedLib();
    injectFloatingBot();
}

async function callGemini(prompt) {
    // Read fresh config from storage each time
    const apiKey = localStorage.getItem('gemini_api_key') || DEFAULT_API_KEY;
    const model = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';

    // Ensure clean model ID (remove 'models/' prefix if present)
    let modelId = model;
    if (modelId.startsWith('models/')) {
        modelId = modelId.replace('models/', '');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Floating Bot UI Injection
function injectFloatingBot() {
    if (document.getElementById('floating-bot-container')) return;

    // Styles
    const style = document.createElement('style');
    style.textContent = `
        .floating-bot-trigger {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 60px;
            height: 60px;
            background: var(--primary-color, #4f46e5);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: transform 0.2s;
            z-index: 9999;
        }
        .floating-bot-trigger:hover {
            transform: scale(1.1);
        }
        .floating-bot-window {
            position: fixed;
            bottom: 6rem;
            right: 2rem;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 1rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            display: none;
            flex-direction: column;
            z-index: 9999;
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }
        .bot-header {
            background: var(--primary-color, #4f46e5);
            color: white;
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .bot-header h3 { margin: 0; font-size: 1rem; }
        .close-bot { cursor: pointer; font-size: 1.5rem; }
        .bot-messages {
            flex: 1;
            padding: 1rem;
            overflow-y: auto;
            background: #f8fafc;
        }
        .bot-input-area {
            padding: 1rem;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 0.5rem;
        }
        .bot-input-area input {
            flex: 1;
            padding: 0.5rem;
            border: 1px solid #cbd5e1;
            border-radius: 0.5rem;
        }
        .bot-input-area button {
            padding: 0.5rem 1rem;
            background: var(--primary-color, #4f46e5);
            color: white;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
        }
        .bot-message {
            margin-bottom: 0.8rem;
            padding: 0.8rem;
            border-radius: 0.5rem;
            font-size: 0.9rem;
            line-height: 1.4;
        }
        .bot-message.ai {
            background: white;
            border: 1px solid #e2e8f0;
            margin-right: 1rem;
        }
        .bot-message.user {
            background: var(--primary-color, #4f46e5);
            color: white;
            margin-left: 1rem;
        }
        .quick-actions {
            padding: 0.5rem;
            display: flex;
            gap: 0.5rem;
            overflow-x: auto;
            border-bottom: 1px solid #e2e8f0;
        }
        .action-chip {
            background: #e0e7ff;
            color: #4f46e5;
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.8rem;
            cursor: pointer;
            white-space: nowrap;
        }
        .action-chip:hover { background: #c7d2fe; }
    `;
    document.head.appendChild(style);

    // HTML Structure
    const container = document.createElement('div');
    container.id = 'floating-bot-container';
    container.innerHTML = `
        <div class="floating-bot-trigger" onclick="toggleBot()">
            🤖
        </div>
        <div class="floating-bot-window" id="botWindow">
            <div class="bot-header">
                <h3>AI Assistant</h3>
                <span class="close-bot" onclick="toggleBot()">&times;</span>
            </div>
            <div class="quick-actions">
                <span class="action-chip" onclick="askBot('Draft an email to parents about upcoming exams')">📧 Draft Email</span>
                <span class="action-chip" onclick="askBot('Write a notice for the school notice board about holiday')">📢 Write Notice</span>
                <span class="action-chip" onclick="askBot('Summarize the content of this page')">📝 Summarize Page</span>
                <span class="action-chip" onclick="askBot('How do I add a student?')">❓ Help</span>
            </div>
            <div class="bot-messages" id="botMessages">
                <div class="bot-message ai">
                    Hello! I'm here to help. I see you are on the <b>${document.title.replace(' - School Management System', '')}</b> page. How can I assist you?
                </div>
            </div>
            <div class="bot-input-area">
                <input type="text" id="botInput" placeholder="Ask anything..." onkeypress="handleBotKey(event)">
                <button onclick="sendBotMessage()">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
}

function toggleBot() {
    const win = document.getElementById('botWindow');
    if (win.style.display === 'flex') {
        win.style.display = 'none';
    } else {
        win.style.display = 'flex';
        // Focus input
        setTimeout(() => document.getElementById('botInput').focus(), 100);
    }
}

function handleBotKey(e) {
    if (e.key === 'Enter') sendBotMessage();
}

function askBot(text) {
    document.getElementById('botInput').value = text;
    sendBotMessage();
}

async function sendBotMessage() {
    const input = document.getElementById('botInput');
    const messages = document.getElementById('botMessages');
    const text = input.value.trim();
    
    if (!text) return;

    // User Message
    const userDiv = document.createElement('div');
    userDiv.className = 'bot-message user';
    userDiv.textContent = text;
    messages.appendChild(userDiv);
    input.value = '';
    messages.scrollTop = messages.scrollHeight;

    // Loading
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'bot-message ai';
    loadingDiv.textContent = 'Thinking...';
    messages.appendChild(loadingDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
        // Extract page text (limit to ~3000 chars)
        const mainContent = document.querySelector('main') || document.body;
        const pageText = mainContent.innerText.replace(/\s+/g, ' ').substring(0, 3000);

        const pageContext = `
            Current Page: ${document.title}
            URL: ${window.location.href}
            User Role: ${document.getElementById('userRole')?.innerText || 'Unknown'}
            Page Content Snippet: ${pageText}...
        `;

        const systemPrompt = `
            You are a helpful AI assistant embedded in a School Management System.
            ${pageContext}
            
            Answer the user's request concisely.
            If asked to draft an email or notice, provide a professional template.
            If asked about the page, explain its function based on the title and content provided.
            If asked to summarize, use the provided Page Content Snippet.
        `;

        const response = await callGemini(systemPrompt + "\n\nUser: " + text);
        
        // Remove loading
        messages.removeChild(loadingDiv);

        // AI Message
        const aiDiv = document.createElement('div');
        aiDiv.className = 'bot-message ai';
        
        if (typeof marked !== 'undefined') {
            aiDiv.innerHTML = marked.parse(response);
        } else {
            aiDiv.textContent = response;
        }
        
        messages.appendChild(aiDiv);
        messages.scrollTop = messages.scrollHeight;

    } catch (error) {
        loadingDiv.textContent = 'Error: ' + error.message;
        loadingDiv.style.color = 'red';
    }
}
