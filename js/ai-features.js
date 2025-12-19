// AI Features Module ---------------------------------------------------------
// Handles provider configuration, chatbot, smart reports, and AI data entry.

const PROVIDERS_CONFIG = {
    gemini: {
        name: "Google Gemini",
        models: [
            { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recommended)" },
            { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
            { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
            { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Legacy)" }
        ]
    },
    groq: {
        name: "Groq Cloud",
        models: [
            { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Smart & Fast)" },
            { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Super Fast)" },
            { id: "llama-3.1-8b", name: "Llama 3.1 8B" },
            { id: "qwen/qwen3-32b", name: "Qwen 3 32B" },
            { id: "openai/gpt-oss-20b", name: "GPT OSS 20B" },
            { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" }
        ]
    },
    huggingface: {
        name: "Hugging Face",
        models: [
            { id: "meta-llama/Meta-Llama-3-8B-Instruct", name: "Meta Llama 3 8B" },
            { id: "mistralai/Mistral-7B-Instruct-v0.3", name: "Mistral 7B v0.3" },
            { id: "microsoft/Phi-3-mini-4k-instruct", name: "Phi-3 Mini" }
        ]
    },
    mistral: {
        name: "Mistral AI",
        models: [
            { id: "mistral-tiny", name: "Mistral Tiny" },
            { id: "mistral-small", name: "Mistral Small" },
            { id: "mistral-7b-instruct", name: "Mistral 7B Instruct" },
            { id: "mistral-nemo", name: "Mistral Nemo" }
        ]
    },
    xai: {
        name: "xAI (Grok)",
        models: [
            { id: "grok-2", name: "Grok 2" },
            { id: "grok-beta", name: "Grok Beta" },
            { id: "grok-4.1-fast", name: "Grok 4.1 Fast" }
        ]
    }
};

const DEFAULT_KEYS = {
    gemini: "",
    groq: "",
    huggingface: "",
    mistral: "",
    xai: ""
};

document.addEventListener("DOMContentLoaded", () => {
    loadSettingsUI();
});

async function loadSettingsUI() {
    const providerSelect = document.getElementById("providerSelect");
    if (!providerSelect) return;

    if (typeof ensureAIKeysLoaded === "function") {
        await ensureAIKeysLoaded();
    }

    try {
        const cfgDoc = await db.collection("system_settings").doc("ai_config").get();
        if (cfgDoc.exists) {
            const cfg = cfgDoc.data();
            if (cfg.provider) localStorage.setItem("ai_provider", cfg.provider);
            if (cfg.model) localStorage.setItem("ai_model", cfg.model);
        }
    } catch (e) {
        console.warn("Could not load AI config from Firebase:", e);
    }

    const savedProvider = localStorage.getItem("ai_provider") || "gemini";
    providerSelect.value = savedProvider;
    updateModelList();

    document.getElementById("modelSelect").value = localStorage.getItem("ai_model") || "";
    document.getElementById("geminiKey").value = localStorage.getItem("gemini_api_key") || DEFAULT_KEYS.gemini;
    document.getElementById("groqKey").value = localStorage.getItem("groq_api_key") || DEFAULT_KEYS.groq;
    document.getElementById("hfKey").value = localStorage.getItem("huggingface_api_key") || DEFAULT_KEYS.huggingface;
    document.getElementById("mistralKey").value = localStorage.getItem("mistral_api_key") || DEFAULT_KEYS.mistral;
    document.getElementById("xaiKey").value = localStorage.getItem("xai_api_key") || DEFAULT_KEYS.xai;
}

function updateModelList() {
    const provider = document.getElementById("providerSelect").value;
    const modelSelect = document.getElementById("modelSelect");
    const config = PROVIDERS_CONFIG[provider];
    if (!config) return;

    modelSelect.innerHTML = config.models.map(m => `<option value="${m.id}">${m.name}</option>`).join("");

    const savedModel = localStorage.getItem("ai_model");
    if (savedModel && config.models.some(m => m.id === savedModel)) {
        modelSelect.value = savedModel;
    } else {
        modelSelect.value = config.models[0]?.id || "";
    }
}

async function saveSettings() {
    const provider = document.getElementById("providerSelect").value;
    const model = document.getElementById("modelSelect").value;
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_model", model);

    const keys = {
        gemini: document.getElementById("geminiKey").value.trim(),
        groq: document.getElementById("groqKey").value.trim(),
        huggingface: document.getElementById("hfKey").value.trim(),
        mistral: document.getElementById("mistralKey").value.trim(),
        xai: document.getElementById("xaiKey").value.trim()
    };

    Object.entries(keys).forEach(([key, value]) => {
        localStorage.setItem(`${key}_api_key`, value);
    });

    const btn = document.querySelector('button[onclick="saveSettings()"]');
    const originalText = btn?.innerText;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Saving...";
        }

        await db.collection("system_settings").doc("ai_keys").set(keys, { merge: true });
        await db.collection("system_settings").doc("ai_config").set({
            provider,
            model,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        alert("Settings saved locally and in Firebase.");
    } catch (error) {
        console.error(error);
        alert("Saved locally. Firebase sync failed: " + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

// ---------------------------------------------------------------------------
// Chatbot logic
let cachedSystemData = null;
let lastSummaryFetch = 0;
const DATA_CACHE_MS = 300000;
let chatAttachments = [];

function handleChatFiles(event) {
    const files = event.target.files;
    if (!files.length) return;
    const preview = document.getElementById("chatFilePreview");

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            chatAttachments.push({
                mimeType: file.type,
                data: e.target.result.split(",")[1],
                name: file.name
            });

            const div = document.createElement("div");
            div.className = "file-preview-item";
            if (file.type.startsWith("image/")) {
                div.innerHTML = `<img src="${e.target.result}"><span class="remove" onclick="removeChatAttachment('${file.name}', this)">x</span>`;
            } else {
                div.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#eee;font-size:22px;">FILE</div><span class="remove" onclick="removeChatAttachment('${file.name}', this)">x</span>`;
            }
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    event.target.value = "";
}

function removeChatAttachment(name, el) {
    chatAttachments = chatAttachments.filter(a => a.name !== name);
    el.parentElement.remove();
}

function handleChatEnter(event) {
    if (event.key === "Enter") sendMessage();
}

async function getSystemContext() {
    const now = Date.now();
    if (cachedSystemData && (now - lastSummaryFetch) < DATA_CACHE_MS) {
        return cachedSystemData;
    }
    cachedSystemData = await fetchSummaryData();
    lastSummaryFetch = now;
    return cachedSystemData;
}

function appendMessage(role, html) {
    const history = document.getElementById("chatHistory");
    if (!history) return;
    const div = document.createElement("div");
    div.className = `chat-message ${role}`;
    div.innerHTML = html;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (!message && chatAttachments.length === 0) return;

    appendMessage("user", message || "[Files attached]");

    const history = document.getElementById("chatHistory");
    const loading = document.createElement("div");
    loading.className = "chat-message ai";
    loading.innerHTML = '<div class="loading-spinner"></div> Thinking...';
    history.appendChild(loading);
    history.scrollTop = history.scrollHeight;

    try {
        const contextData = await getSystemContext();
        const schemaContext = typeof getSchemaSummary === "function" ? getSchemaSummary() : "";

        const systemPrompt = `You are a School Management System assistant.

DATA SUMMARY:
${JSON.stringify(contextData, null, 2)}

${schemaContext}

Rules:
- Reference the provided data whenever possible.
- Be honest when information is missing.
- If the user asks for data entry, return JSON arrays (collection + data) only when required fields are present.`;

        const attachments = [...chatAttachments];
        chatAttachments = [];
        document.getElementById("chatFilePreview").innerHTML = "";

        const response = await callGemini(`${systemPrompt}\n\nUser Question: ${message}`, attachments);

        loading.remove();
        appendMessage("ai", renderSafeMarkdown(response));
    } catch (error) {
        console.error(error);
        loading.innerHTML = `<span style="color: var(--danger)">Error: ${error.message}</span>`;
    } finally {
        input.value = "";
    }
}

// ---------------------------------------------------------------------------
// Smart reports
async function generateReport() {
    const btn = document.getElementById("btnGenerateReport");
    const result = document.getElementById("reportResult");
    const type = document.getElementById("reportType").value;
    const focus = document.getElementById("reportFocus").value;

    btn.disabled = true;
    btn.innerText = "Analyzing...";
    result.style.display = "block";
    result.innerHTML = '<div class="loading-spinner"></div> Generating report...';

    try {
        const contextData = await getSystemContext();
        const schemaContext = typeof getSchemaSummary === "function" ? getSchemaSummary() : "";
        const prompt = `Create a ${type} report focused on ${focus}.
Use the data summary below. If metrics are missing, state clear assumptions.

${JSON.stringify(contextData, null, 2)}

${schemaContext}

Structure:
1. Executive Summary
2. Key Metrics
3. Recommended Actions`;

        const response = await callGemini(prompt);
        result.innerHTML = renderSafeMarkdown(response);
    } catch (error) {
        result.innerHTML = `<p style="color: var(--danger)">Error: ${error.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate Report";
    }
}

async function fetchSummaryData() {
    const summary = {
        generatedAt: new Date().toLocaleString(),
        counts: { students: 0, teachers: 0, classes: 0 },
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
        const [studentsSnap, teachersSnap, classesSnap] = await Promise.all([
            db.collection("students").get(),
            db.collection("teachers").get(),
            db.collection("classes").get()
        ]);
        summary.counts.students = studentsSnap.size;
        summary.counts.teachers = teachersSnap.size;
        summary.counts.classes = classesSnap.size;

        const incomeSnap = await db.collection("incomes").get();
        incomeSnap.forEach(doc => {
            const data = doc.data();
            const amount = parseFloat(data.amount) || 0;
            summary.finance.totalIncome += amount;
            const cat = data.category || "Other";
            summary.finance.incomeBreakdown[cat] = (summary.finance.incomeBreakdown[cat] || 0) + amount;
        });

        const paidFees = await db.collection("fees").where("status", "==", "Paid").get();
        paidFees.forEach(doc => {
            const amount = parseFloat(doc.data().amount) || 0;
            summary.finance.totalIncome += amount;
            summary.finance.incomeBreakdown["Student Fees"] = (summary.finance.incomeBreakdown["Student Fees"] || 0) + amount;
        });

        const expenseSnap = await db.collection("expenses").get();
        expenseSnap.forEach(doc => {
            const data = doc.data();
            const amount = parseFloat(data.amount) || 0;
            summary.finance.totalExpenses += amount;
            const cat = data.category || "Other";
            summary.finance.expenseBreakdown[cat] = (summary.finance.expenseBreakdown[cat] || 0) + amount;
        });

        summary.finance.netBalance = summary.finance.totalIncome - summary.finance.totalExpenses;
    } catch (error) {
        console.error("Failed to build summary", error);
        summary.error = error.message;
    }
    return summary;
}

// ---------------------------------------------------------------------------
// Data entry assistant
let dataEntryAttachments = [];

function handleDataEntryChatFiles(event) {
    const files = event.target.files;
    if (!files.length) return;
    const preview = document.getElementById("dataEntryFilePreview");

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            dataEntryAttachments.push({
                mimeType: file.type,
                data: e.target.result.split(",")[1],
                name: file.name
            });

            const div = document.createElement("div");
            div.className = "file-preview-item";
            if (file.type.startsWith("image/")) {
                div.innerHTML = `<img src="${e.target.result}"><span class="remove" onclick="removeDataEntryAttachment('${file.name}', this)">x</span>`;
            } else {
                div.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#eee;font-size:22px;">FILE</div><span class="remove" onclick="removeDataEntryAttachment('${file.name}', this)">x</span>`;
            }
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    event.target.value = "";
}

function removeDataEntryAttachment(name, el) {
    dataEntryAttachments = dataEntryAttachments.filter(a => a.name !== name);
    el.parentElement.remove();
}

function handleDataEntryEnter(event) {
    if (event.key === "Enter") processDataEntryChat();
}

async function processDataEntryChat() {
    const input = document.getElementById("dataEntryChatInput");
    const history = document.getElementById("dataEntryHistory");
    const message = input.value.trim();
    if (!message && dataEntryAttachments.length === 0) return;

    let userMessage = message;
    if (dataEntryAttachments.length) {
        userMessage += `<br><small><i>Attached: ${dataEntryAttachments.map(a => a.name).join(", ")}</i></small>`;
    }

    const userDiv = document.createElement("div");
    userDiv.className = "chat-message user";
    userDiv.innerHTML = userMessage || "[Files attached]";
    history.appendChild(userDiv);
    history.scrollTop = history.scrollHeight;
    input.value = "";

    const loadingId = "de-" + Date.now();
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "chat-message ai";
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = '<div class="loading-spinner"></div> Analyzing...';
    history.appendChild(loadingDiv);
    history.scrollTop = history.scrollHeight;

    try {
        const schemaContext = typeof getSchemaSummary === "function" ? getSchemaSummary() : "";
        const attachmentNames = dataEntryAttachments.map(a => a.name);
        const prompt = `You are an intelligent data entry assistant. Convert the user text/files into JSON.

${schemaContext}

Text: "${message}"

Instructions:
1. Use exact collection names and field names from the schema.
2. Only return JSON arrays (collection + data) when confident about required fields and types.
3. If information is missing or unclear, reply with {"error": "..."} asking for clarification.
4. Never invent values.`;

        const response = await callGemini(prompt, dataEntryAttachments);
        dataEntryAttachments = [];
        document.getElementById("dataEntryFilePreview").innerHTML = "";
        document.getElementById(loadingId)?.remove();

        const clean = response.replace(/```json/gi, "").replace(/```/g, "").trim();
        let parsedData;
        try {
            parsedData = JSON.parse(clean);
            if (!Array.isArray(parsedData) && !parsedData.error) {
                parsedData = [parsedData];
            }
        } catch (parseError) {
            const fallback = document.createElement("div");
            fallback.className = "chat-message ai";
            fallback.innerHTML = renderSafeMarkdown(clean);
            history.appendChild(fallback);
            return;
        }

        if (parsedData.error) {
            const errDiv = document.createElement("div");
            errDiv.className = "chat-message ai";
            errDiv.innerText = parsedData.error;
            history.appendChild(errDiv);
            return;
        }

        const reviewedEntries = typeof prepareAiEntriesForReview === "function"
            ? await prepareAiEntriesForReview(parsedData)
            : parsedData.map(entry => ({ ...entry, meta: { allowed: true, errors: [], warnings: [], diff: [] } }));

        const hasBlockingIssues = reviewedEntries.some(entry => (entry.meta?.errors?.length || entry.meta?.allowed === false));
        const hasWarnings = reviewedEntries.some(entry => entry.meta?.warnings?.length);
        const rawAttr = encodeURIComponent(message || "");
        const attachmentsAttr = encodeURIComponent(JSON.stringify(attachmentNames));
        const issuesAttr = encodeURIComponent(JSON.stringify(reviewedEntries.map(item => ({
            collection: item.collection,
            errors: item.meta?.errors || [],
            warnings: item.meta?.warnings || [],
            allowed: item.meta?.allowed
        }))));

        const cardDiv = document.createElement("div");
        cardDiv.className = "chat-message ai";
        cardDiv.style.width = "100%";
        cardDiv.style.maxWidth = "90%";

        let cardHtml = `
            <div style="background:#fff;border:1px solid var(--border-color);border-radius:0.75rem;overflow:hidden;">
                <div style="padding:1rem;background:#f8fafc;border-bottom:1px solid var(--border-color);">
                    <strong>[AI] Proposed Data Entry</strong>
                    <span style="float:right;font-size:0.8rem;color:#64748b;">${reviewedEntries.length} item(s)</span>
                </div>
                <div style="padding:1rem;max-height:260px;overflow:auto;font-size:0.9rem;">
        `;

        reviewedEntries.forEach(item => {
            const meta = item.meta || { allowed: true, errors: [], warnings: [], diff: [] };
            cardHtml += `
                <div style="margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px dashed #e2e8f0;">
                    <span style="color:var(--primary-color);font-weight:600;">${item.collection}</span>
                    <pre style="margin:0.4rem 0;font-size:0.75rem;color:#475569;background:#f8fafc;padding:0.6rem;border-radius:0.4rem;white-space:pre-wrap;">${JSON.stringify(item.data, null, 2)}</pre>
            `;
            if (meta.diff && meta.diff.length) {
                cardHtml += `
                    <div style="font-size:0.75rem;color:#0f172a;margin-top:0.4rem;">
                        <strong>Detected changes:</strong>
                        <ul style="padding-left:1rem;margin:0.25rem 0;">
                            ${meta.diff.map(d => `<li>${d.field}: ${d.before} -> ${d.after}</li>`).join("")}
                        </ul>
                    </div>
                `;
            }
            if (meta.allowed === false) {
                cardHtml += `<div style="font-size:0.75rem;color:#b91c1c;margin-top:0.3rem;">You do not have permission to edit the '${item.collection}' collection.</div>`;
            }
            if (meta.errors && meta.errors.length) {
                cardHtml += `<div style="font-size:0.75rem;color:#dc2626;margin-top:0.3rem;">Errors: ${meta.errors.join(" | ")}</div>`;
            }
            if (meta.warnings && meta.warnings.length) {
                cardHtml += `<div style="font-size:0.75rem;color:#b45309;margin-top:0.3rem;">Warnings: ${meta.warnings.join(" | ")}</div>`;
            }
            cardHtml += "</div>";
        });

        cardHtml += `
                </div>
                <div style="padding:0.85rem 1rem;background:#f1f5f9;display:flex;flex-direction:column;gap:0.5rem;">
                    ${hasBlockingIssues ? '<div style="color:#dc2626;font-size:0.85rem;">Resolve highlighted errors or regenerate the request.</div>' : ''}
                    ${hasWarnings ? '<div style="color:#b45309;font-size:0.8rem;">Warnings detected. Double-check before confirming.</div>' : ''}
                    <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
                        <button class="btn-secondary" onclick="this.closest('.chat-message').remove()" style="padding:0.4rem 1rem;font-size:0.9rem;background:#cbd5e1;color:#334155;">Discard</button>
                        ${hasBlockingIssues
                ? `<button class="btn-primary"
                                data-issues="${issuesAttr}"
                                onclick='showDataEntryIssues(this)'
                                style="padding:0.4rem 1rem;font-size:0.9rem;">
                                    Fix issues to save
                               </button>`
                : `<button class="btn-primary"
                                data-source="data-entry-assistant"
                                data-raw="${rawAttr}"
                                data-attachments="${attachmentsAttr}"
                                onclick='confirmDataEntryChat(this, ${JSON.stringify(parsedData)})'
                                style="padding:0.4rem 1rem;font-size:0.9rem;">
                                    Confirm & Save
                               </button>`}
                    </div>
                </div>
            </div>
        `;

        cardDiv.innerHTML = cardHtml;
        history.appendChild(cardDiv);
        history.scrollTop = history.scrollHeight;
    } catch (error) {
        console.error(error);
        document.getElementById(loadingId)?.remove();
        const errDiv = document.createElement("div");
        errDiv.className = "chat-message ai";
        errDiv.style.color = "var(--danger)";
        errDiv.innerText = "Error: " + error.message;
        history.appendChild(errDiv);
    }
}

async function confirmDataEntryChat(btn, dataEntries) {
    if (!dataEntries || !dataEntries.length) return;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const rawInput = decodeURIComponent(btn.dataset.raw || "");
        const attachments = btn.dataset.attachments ? JSON.parse(decodeURIComponent(btn.dataset.attachments)) : [];
        const report = typeof saveAiEntries === "function"
            ? await saveAiEntries(dataEntries, {
                source: btn.dataset.source || "data-entry-assistant",
                rawInput,
                attachmentNames: attachments
            })
            : { success: [], failed: [] };

        if (report.failed.length && !report.success.length) {
            throw new Error(report.failed[0].reason || "Validation failed.");
        }

        const container = btn.closest(".chat-message");
        const summary = [];
        if (report.success.length) summary.push(`Saved ${report.success.length} item(s).`);
        if (report.failed.length) summary.push(`Skipped ${report.failed.length}: ${report.failed.map(f => f.reason).join(" | ")}`);

        container.innerHTML = `
            <div style="padding:1rem;background:${report.failed.length ? "#fff7ed" : "#ecfdf5"};border:1px solid ${report.failed.length ? "#fb923c" : "#10b981"};border-radius:0.5rem;color:${report.failed.length ? "#9a3412" : "#065f46"};">
                ${summary.join("<br>")}
            </div>
        `;
    } catch (error) {
        console.error(error);
        alert("Error saving data: " + error.message);
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function showDataEntryIssues(btn) {
    try {
        const issues = btn.dataset.issues ? JSON.parse(decodeURIComponent(btn.dataset.issues)) : [];
        if (!issues.length) {
            alert("No additional details were provided. Please regenerate the request.");
            return;
        }
        let message = "Please resolve the following before saving:\n\n";
        issues.forEach(item => {
            message += `Collection: ${item.collection || 'unknown'}\n`;
            if (item.allowed === false) {
                message += "- You do not have permission to edit this collection.\n";
            }
            (item.errors || []).forEach(err => message += `- ${err}\n`);
            (item.warnings || []).forEach(warn => message += `- Warning: ${warn}\n`);
            message += "\n";
        });
        alert(message);
    } catch (error) {
        console.error("Unable to show issue details:", error);
        alert("Could not show issue details. Please regenerate the request.");
    }
}
