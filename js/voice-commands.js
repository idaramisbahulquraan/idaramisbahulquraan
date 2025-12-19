// Voice Command & Navigation Logic

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

async function startVoiceRecognition() {
    if (!SpeechRecognition) {
        alert("Your browser does not support Voice Recognition. Please use Chrome or Edge.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // Could be dynamic based on currentLang
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // UI Feedback
    const btn = document.getElementById('voiceTriggerBtn');
    if (btn) btn.classList.add('listening');
    
    // Show toast
    showVoiceToast("Listening...", "info");

    recognition.start();

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Voice Input:", transcript);
        showVoiceToast(`Processing: "${transcript}"`, "info");
        
        await processVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        showVoiceToast("Error: " + event.error, "error");
        if (btn) btn.classList.remove('listening');
    };

    recognition.onend = () => {
        if (btn) btn.classList.remove('listening');
    };
}

async function processVoiceCommand(command) {
    try {
        // 1. Get Context
        const userRole = document.getElementById('userRole')?.innerText || 'user';
        
        // 2. Prompt for Intent
        const prompt = `
        You are a Voice Command Processor for a School Management System.
        User Role: ${userRole}
        Current Page: ${window.location.href}
        
        Command: "${command}"
        
        Analyze the command and return a JSON object (NO MARKDOWN) with the following structure:
        {
            "intent": "NAVIGATE" | "SEARCH" | "ACTION" | "UNKNOWN",
            "target": "string (e.g., page name, collection name)",
            "parameters": { ...key-value pairs... },
            "confirmation": "Text to speak/show back to user"
        }
        
        Rules:
        - NAVIGATE: If user wants to go to a page (e.g., "Go to students", "Open settings").
          Target should be the relative path (e.g., "pages/admin/students.html").
        - SEARCH: If user wants to find something (e.g., "Find student Ali").
        - ACTION: If user wants to perform an action (e.g., "Mark attendance").
        
        Valid Pages for NAVIGATE (prefix with correct path):
        - dashboard.html
        - pages/admin/students.html
        - pages/admin/teachers.html
        - pages/admin/classes.html
        - pages/admin/fees.html
        - pages/admin/timetable.html
        - pages/admin/exams.html
        - pages/admin/finance.html
        - pages/admin/reports.html
        - pages/admin/settings.html
        `;

        // Call global callGemini from script.js
        const response = await callGemini(prompt);
        
        // 3. Parse Response
        const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanResponse);
        
        console.log("Voice Intent:", result);

        // 4. Execute
        handleVoiceIntent(result);

    } catch (error) {
        console.error("Voice Processing Error:", error);
        showVoiceToast("Could not understand command.", "error");
    }
}

function handleVoiceIntent(result) {
    // Speak confirmation (optional, using Web Speech API Synthesis)
    if (result.confirmation) {
        speakResponse(result.confirmation);
    }

    switch (result.intent) {
        case 'NAVIGATE':
            if (result.target) {
                // Handle path adjustment
                let path = result.target;
                const currentPath = window.location.pathname;
                const isInPages = currentPath.includes('/pages/');
                
                // If we are in root and target is in pages
                if (!isInPages && path.startsWith('pages/')) {
                    window.location.href = path;
                }
                // If we are in pages and target is dashboard (root)
                else if (isInPages && (path === 'dashboard.html' || path.includes('index.html'))) {
                    window.location.href = '../../' + path;
                }
                // If we are in pages and target is in pages
                else if (isInPages && path.startsWith('pages/')) {
                    // e.g. currently in pages/admin/students.html, target is pages/admin/fees.html
                    // need to go up two levels then down? No, usually structure is flat under pages/admin
                    // actually structure is pages/admin/*.html. 
                    // So if we are in pages/admin/students.html, and want pages/admin/fees.html, we just need 'fees.html'
                    // BUT prompt might return full path.
                    
                    // Simplest: Go to root then target
                    window.location.href = '../../' + path;
                } 
                else {
                    window.location.href = path;
                }
            }
            break;

        case 'SEARCH':
            // If there is a global search bar, populate it. 
            // Or redirect to relevant page with query param.
            showVoiceToast(`Searching for ${result.parameters?.query || '...'}`, "success");
            // TODO: Implement global search
            break;

        case 'ACTION':
            showVoiceToast(result.confirmation, "success");
            break;
            
        default:
            showVoiceToast("Sorry, I didn't catch that.", "warning");
    }
}

function speakResponse(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}

function showVoiceToast(message, type = 'info') {
    let toast = document.getElementById('voiceToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'voiceToast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 1rem 2rem;
            background: #333;
            color: white;
            border-radius: 2rem;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: opacity 0.3s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        document.body.appendChild(toast);
    }
    
    const colors = {
        info: '#3b82f6',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b'
    };
    
    toast.style.backgroundColor = colors[type] || '#333';
    toast.innerHTML = `<span>🎙️</span> ${message}`;
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}
