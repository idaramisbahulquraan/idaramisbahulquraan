document.addEventListener('DOMContentLoaded', () => {
    //
});

const COLLECTIONS = [
    'users', 'students', 'teachers', 'classes', 
    'fees', 'expenses', 'incomes', 'finance_heads', 
    'attendance', 'grades', 'exams', 'timetable'
];

async function backupData() {
    const statusEl = document.getElementById('statusMessage');
    statusEl.innerText = "Starting backup...";
    statusEl.className = "status-info";
    
    try {
        const backupData = {};
        
        for (const colName of COLLECTIONS) {
            statusEl.innerText = `Backing up ${colName}...`;
            const snapshot = await db.collection(colName).get();
            backupData[colName] = {};
            
            snapshot.forEach(doc => {
                backupData[colName][doc.id] = doc.data();
            });
        }
        
        // Add metadata
        backupData.metadata = {
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        const jsonStr = JSON.stringify(backupData, null, 2);
        downloadFile(jsonStr, `backup_${new Date().toISOString().split('T')[0]}.json`);
        
        statusEl.innerText = "Backup complete!";
        statusEl.className = "status-success";

    } catch (error) {
        console.error(error);
        statusEl.innerText = "Backup failed: " + error.message;
        statusEl.className = "status-error";
    }
}

function downloadFile(content, fileName) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function restoreData(event) {
    event.preventDefault();
    const fileInput = document.getElementById('backupFile');
    const statusEl = document.getElementById('statusMessage');
    
    if (!fileInput.files.length) {
        alert("Please select a file.");
        return;
    }

    if (!confirm("WARNING: This will overwrite/merge existing data. Are you sure?")) return;

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            statusEl.innerText = "Starting restore...";
            statusEl.className = "status-info";

            for (const colName of COLLECTIONS) {
                if (data[colName]) {
                    statusEl.innerText = `Restoring ${colName}...`;
                    let batch = db.batch();
                    let count = 0;
                    
                    for (const [docId, docData] of Object.entries(data[colName])) {
                        const ref = db.collection(colName).doc(docId);
                        
                        // Handle Timestamps (convert strings back to timestamps if needed)
                        if (docData.createdAt && typeof docData.createdAt === 'string') {
                            // Try to convert standard timestamps
                            // docData.createdAt = new Date(docData.createdAt); 
                            // Firestore prefers Timestamp objects or Dates.
                        }

                        batch.set(ref, docData, { merge: true });
                        count++;
                        
                        // Batches are limited to 500 ops
                        if (count >= 450) {
                            await batch.commit();
                            batch = db.batch();
                            count = 0;
                        }
                    }
                    if (count > 0) await batch.commit();
                }
            }

            statusEl.innerText = "Restore complete!";
            statusEl.className = "status-success";
            
        } catch (error) {
            console.error(error);
            statusEl.innerText = "Restore failed: " + error.message;
            statusEl.className = "status-error";
        }
    };

    reader.readAsText(file);
}
