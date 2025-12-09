// Default Configuration
// PROVIDERS_CONFIG defines available models for each provider
const PROVIDERS_CONFIG = {
    gemini: {
        name: "Google Gemini",
        models: [
            { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended)" },
            { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Best Quality)" },
            { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
            { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Legacy)" }
        ]
    },
    groq: {
        name: "Groq Cloud",
        models: [
            { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Smart & Fast)" },
            { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Super Fast)" },
            { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" }
        ]
    },
    huggingface: {
        name: "Hugging Face",
        models: [
            { id: "meta-llama/Meta-Llama-3-8B-Instruct", name: "Meta Llama 3 8B" },
            { id: "mistralai/Mistral-7B-Instruct-v0.3", name: "Mistral 7B v0.3" }
        ]
    },
    mistral: {
        name: "Mistral AI",
        models: [
            { id: "mistral-tiny", name: "Mistral Tiny" },
            { id: "mistral-small", name: "Mistral Small" }
        ]
    },
    xai: {
        name: "xAI (Grok)",
        models: [
            { id: "grok-2", name: "Grok 2" },
            { id: "grok-beta", name: "Grok Beta" }
        ]
    }
};

// Default Keys provided by user
// SECURITY NOTICE: Do NOT hardcode real keys here. 
// Keys should be entered by the user in the UI and stored in localStorage.
const DEFAULT_KEYS = {
    gemini: '',
    groq: '',
    huggingface: '',
    mistral: '',
    xai: ''
};

// Initialize Settings
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsUI();
});

async function loadSettingsUI() {
    const providerSelect = document.getElementById('providerSelect');
    if (!providerSelect) return;

    // Ensure keys are loaded from system settings if available
    if (typeof ensureAIKeysLoaded === 'function') {
        await ensureAIKeysLoaded();
    }

    // Load saved provider or default to gemini
    const savedProvider = localStorage.getItem('ai_provider') || 'gemini';
    providerSelect.value = savedProvider;

    // Load saved keys or defaults
    document.getElementById('geminiKey').value = localStorage.getItem('gemini_api_key') || DEFAULT_KEYS.gemini;
    document.getElementById('groqKey').value = localStorage.getItem('groq_api_key') || DEFAULT_KEYS.groq;
    document.getElementById('hfKey').value = localStorage.getItem('huggingface_api_key') || DEFAULT_KEYS.huggingface;
    document.getElementById('mistralKey').value = localStorage.getItem('mistral_api_key') || DEFAULT_KEYS.mistral;
    document.getElementById('xaiKey').value = localStorage.getItem('xai_api_key') || DEFAULT_KEYS.xai;

    // Update models based on provider
    updateModelList();
}

function updateModelList() {
    const provider = document.getElementById('providerSelect').value;
    const modelSelect = document.getElementById('modelSelect');
    const config = PROVIDERS_CONFIG[provider];
    
    if (!config) return;

    modelSelect.innerHTML = config.models.map(m => 
        `<option value="${m.id}">${m.name}</option>`
    ).join('');

    // Select previously saved model if valid for this provider
    const savedModel = localStorage.getItem('ai_model');
    if (savedModel && config.models.find(m => m.id === savedModel)) {
        modelSelect.value = savedModel;
    }
}

async function saveSettings() {
    const provider = document.getElementById('providerSelect').value;
    const model = document.getElementById('modelSelect').value;
    
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_model', model);
    
    // Get keys from inputs
    const keys = {
        gemini: document.getElementById('geminiKey').value.trim(),
        groq: document.getElementById('groqKey').value.trim(),
        huggingface: document.getElementById('hfKey').value.trim(),
        mistral: document.getElementById('mistralKey').value.trim(),
        xai: document.getElementById('xaiKey').value.trim()
    };

    // Save to LocalStorage
    localStorage.setItem('gemini_api_key', keys.gemini);
    localStorage.setItem('groq_api_key', keys.groq);
    localStorage.setItem('huggingface_api_key', keys.huggingface);
    localStorage.setItem('mistral_api_key', keys.mistral);
    localStorage.setItem('xai_api_key', keys.xai);
    
    const btn = document.querySelector('button[onclick="saveSettings()"]');
    const originalText = btn ? btn.innerText : 'Save Settings';

    try {
        if(btn) {
            btn.disabled = true;
            btn.innerText = 'Saving...';
        }

        // Save to Firebase (System Settings)
        // Note: This requires the user to have write permission to this collection.
        // If not, it will fail (e.g. students/teachers usually don't have this permission).
        // Only Admin should be doing this.
        await db.collection('system_settings').doc('ai_keys').set(keys, { merge: true });
        
        alert('Settings saved locally and to Firebase!');
    } catch (error) {
        console.error("Error saving to Firebase:", error);
        alert('Saved locally. Firebase sync failed (you might not have permission): ' + error.message);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

// --- Chatbot Logic ---
let cachedSystemData = null;
let lastFetchTime = 0;
const DATA_CACHE_DURATION = 300000; // 5 minutes

async function getSystemContext() {
    const now = Date.now();
    if (cachedSystemData && (now - lastFetchTime < DATA_CACHE_DURATION)) {
        console.log("Using cached system data");
        return cachedSystemData;
    }
    
    cachedSystemData = await fetchSummaryData();
    lastFetchTime = now;
    return cachedSystemData;
}

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
        // 1. Fetch Context Data (Cached)
        const contextData = await getSystemContext();
        
        const systemContext = `You are a helpful assistant for a School Management System app. 
        The app has features for Dashboard, Attendance, Students, Teachers, Fees, Timetable, Exams, Finance, Reports, etc.
        
        CURRENT SYSTEM DATA:
        ${JSON.stringify(contextData, null, 2)}
        
        Answer questions based on the actual data provided above. 
        If the user asks for specific details not in the summary, explain what is available or guide them to the relevant page.
        For financial questions, refer to the 'finance' object in the data.
        Be concise, professional, and helpful.`;
        
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
        const summaryData = await getSystemContext();
        
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
    console.log("Fetching live system data for AI context...");
    
    const summary = {
        date: new Date().toLocaleDateString(),
        counts: {
            students: 0,
            teachers: 0,
            classes: 0
        },
        finance: {
            totalIncome: 0,
            totalExpenses: 0,
            netBalance: 0,
            incomeBreakdown: {},
            expenseBreakdown: {}
        },
        recentActivity: []
    };

    try {
        // 1. Basic Counts
        const sSnap = await db.collection('students').get();
        summary.counts.students = sSnap.size;
        
        const tSnap = await db.collection('teachers').get();
        summary.counts.teachers = tSnap.size;

        // 2. Finance Data (Aggregated)
        // Income
        const incomeSnap = await db.collection('incomes').get();
        incomeSnap.forEach(doc => {
            const d = doc.data();
            const amt = parseFloat(d.amount) || 0;
            summary.finance.totalIncome += amt;
            
            const cat = d.category || 'Uncategorized';
            summary.finance.incomeBreakdown[cat] = (summary.finance.incomeBreakdown[cat] || 0) + amt;
        });

        // Fees (Paid)
        const feesSnap = await db.collection('fees').where('status', '==', 'Paid').get();
        let feesTotal = 0;
        feesSnap.forEach(doc => {
            feesTotal += parseFloat(doc.data().amount) || 0;
        });
        if (feesTotal > 0) {
            summary.finance.totalIncome += feesTotal;
            summary.finance.incomeBreakdown['Student Fees'] = feesTotal;
        }

        // Expenses
        const expenseSnap = await db.collection('expenses').get();
        expenseSnap.forEach(doc => {
            const d = doc.data();
            const amt = parseFloat(d.amount) || 0;
            summary.finance.totalExpenses += amt;
            
            const cat = d.category || 'Uncategorized';
            summary.finance.expenseBreakdown[cat] = (summary.finance.expenseBreakdown[cat] || 0) + amt;
        });

        // Net
        summary.finance.netBalance = summary.finance.totalIncome - summary.finance.totalExpenses;

    } catch (e) {
        console.error("Error fetching data for AI:", e);
        summary.error = "Partial data due to fetch error";
    }

    return summary;
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