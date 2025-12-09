// Default Configuration
// Note: DEFAULT_API_KEY is defined in script.js which is loaded before this file.
// We rely on the global definition to avoid redeclaration errors.

// Initialize Settings
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const modelSelect = document.getElementById('modelSelect');
    
    if (apiKeyInput) {
        apiKeyInput.value = localStorage.getItem('gemini_api_key') || DEFAULT_API_KEY;
    }
    if (modelSelect) {
        modelSelect.value = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
    }
});

function saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value;
    const model = document.getElementById('modelSelect').value;
    
    if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
    }
    
    if (model) {
        localStorage.setItem('gemini_model', model);
    }
    
    alert('Settings saved successfully!');
}

// --- Chatbot Logic ---
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add User Message
    appendMessage('user', message);
    input.value = '';
    
    // Show Loading
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message ai';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = '<div class="loading-spinner"></div> Thinking...';
    history.appendChild(loadingDiv);
    history.scrollTop = history.scrollHeight;
    
    try {
        const systemContext = `You are a helpful assistant for a School Management System app. 
        The app has features for Dashboard, Attendance, Students, Teachers, Fees, Timetable, Exams, Finance, Reports, etc.
        Answer questions about how to manage a school using this app. Be concise and professional.`;
        
        const response = await callGemini(systemContext + "\n\nUser Question: " + message);
        
        // Remove loading
        document.getElementById(loadingId).remove();
        
        // Add AI Response (rendered with Markdown)
        const htmlResponse = marked.parse(response);
        appendMessage('ai', htmlResponse);
        
    } catch (error) {
        document.getElementById(loadingId).remove();
        appendMessage('ai', 'Sorry, I encountered an error: ' + error.message);
    }
}

function appendMessage(role, htmlContent) {
    const history = document.getElementById('chatHistory');
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.innerHTML = htmlContent;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
}

// --- Reports Logic ---
async function generateReport() {
    const btn = document.getElementById('btnGenerateReport');
    const resultArea = document.getElementById('reportResult');
    const reportType = document.getElementById('reportType').value;
    const focusArea = document.getElementById('reportFocus').value;
    
    btn.disabled = true;
    btn.innerText = 'Analyzing Data...';
    resultArea.style.display = 'block';
    resultArea.innerHTML = '<div class="loading-spinner"></div> Gathering data and generating report...';
    
    try {
        // 1. Fetch relevant data from Firestore (Mocking real data fetching for context limit reasons, 
        // in production you would fetch actual collections)
        const summaryData = await fetchSummaryData();
        
        // 2. Construct Prompt
        const prompt = `
        Act as a professional data analyst for a school. Generate a ${reportType} report focusing on ${focusArea}.
        
        Here is the current system data summary:
        ${JSON.stringify(summaryData, null, 2)}
        
        Please provide a professional report with:
        1. Executive Summary
        2. Key Metrics Analysis
        3. Recommendations
        
        Format the output in clean Markdown.
        `;
        
        // 3. Call AI
        const response = await callGemini(prompt);
        
        // 4. Display
        resultArea.innerHTML = marked.parse(response);
        
    } catch (error) {
        resultArea.innerHTML = `<p style="color: var(--danger)">Error: ${error.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.innerText = 'Generate Report';
    }
}

async function fetchSummaryData() {
    // In a real app, you would do:
    // const studentsSnap = await db.collection('students').get();
    // const teachersSnap = await db.collection('teachers').get();
    // ... calculate counts ...
    
    // For now, we fetch basic counts if available or mock
    let studentCount = 0;
    let teacherCount = 0;
    
    try {
        const sSnap = await db.collection('students').get();
        studentCount = sSnap.size;
        const tSnap = await db.collection('teachers').get();
        teacherCount = tSnap.size;
    } catch (e) {
        console.warn("Could not fetch live DB stats, using placeholders");
    }

    return {
        date: new Date().toLocaleDateString(),
        totalStudents: studentCount || 350,
        totalTeachers: teacherCount || 28,
        monthlyIncome: 0, // Placeholder
        activeClasses: 12,
        attendanceRate: "85% (Estimated)",
        recentEvents: ["Mid-term exams completed", "Sports week planning"]
    };
}

// --- Data Entry Logic ---
let pendingDataEntry = null;

async function processDataEntry() {
    const input = document.getElementById('dataEntryInput').value;
    const btn = document.getElementById('btnProcessData');
    const resultArea = document.getElementById('dataEntryResult');
    const jsonPreview = document.getElementById('jsonPreview');
    
    if (!input.trim()) return alert("Please describe the data entry.");
    
    btn.disabled = true;
    btn.innerText = 'Processing...';
    
    try {
        const prompt = `
        You are a data entry assistant. Extract structured data from the following text into JSON format.
        
        The app has these collections and fields:
        1. Students: { firstName, lastName, class, parentName, phone, email }
        2. Teachers: { name, subject, phone, email }
        3. Classes: { className, section }
        
        Text: "${input}"
        
        Identify the intent (add_student, add_teacher, add_class) and the data.
        Return ONLY the raw JSON object, no markdown formatting.
        Example:
        {
            "intent": "add_student",
            "data": {
                "firstName": "Ali",
                "lastName": "Khan",
                "class": "Grade 5",
                ...
            }
        }
        `;
        
        let response = await callGemini(prompt);
        
        // Clean cleanup markdown if AI adds it
        response = response.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const parsedData = JSON.parse(response);
        pendingDataEntry = parsedData;
        
        resultArea.style.display = 'block';
        jsonPreview.textContent = JSON.stringify(parsedData, null, 2);
        
    } catch (error) {
        alert("Failed to process: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Process Entry';
    }
}

async function confirmDataEntry() {
    if (!pendingDataEntry) return;
    
    try {
        const { intent, data } = pendingDataEntry;
        
        if (intent === 'add_student') {
            await db.collection('students').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Student added successfully!');
        } else if (intent === 'add_teacher') {
            await db.collection('teachers').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Teacher added successfully!');
        } else {
            alert('Simulated Save: ' + intent + ' processed (Collection not fully mapped in demo)');
        }
        
        document.getElementById('dataEntryResult').style.display = 'none';
        document.getElementById('dataEntryInput').value = '';
        pendingDataEntry = null;
        
    } catch (error) {
        console.error(error);
        alert('Error saving data: ' + error.message);
    }
}