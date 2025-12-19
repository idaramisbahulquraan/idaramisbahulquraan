// Settings Logic

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    try {
        if (typeof renderLinkedProviders === 'function') {
            renderLinkedProviders();
            if (typeof auth !== 'undefined' && auth && typeof auth.onAuthStateChanged === 'function') {
                auth.onAuthStateChanged(() => renderLinkedProviders());
            }
        }
    } catch (e) { /* ignore */ }
});

function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

async function loadSettings() {
    try {
        const tenantId = getTenantId();

        // Prefer per-tenant branding doc; fallback to legacy settings doc.
        let data = {};
        try {
            const brandingDoc = await db.collection('branding').doc(tenantId).get();
            if (brandingDoc.exists) data = brandingDoc.data() || {};
        } catch (e) { /* ignore */ }

        if (!data || !Object.keys(data).length) {
            const doc = await db.collection('settings').doc('school_profile').get();
            if (doc.exists) data = doc.data() || {};
        }

        if (document.getElementById('schoolName')) document.getElementById('schoolName').value = data.name || '';
        if (document.getElementById('schoolAddress')) document.getElementById('schoolAddress').value = data.address || '';
        if (document.getElementById('schoolPhone')) document.getElementById('schoolPhone').value = data.phone || '';
        if (document.getElementById('schoolEmail')) document.getElementById('schoolEmail').value = data.email || '';

        if (document.getElementById('primaryColor')) document.getElementById('primaryColor').value = data.primaryColor || '#4f46e5';
        if (document.getElementById('customDomain')) document.getElementById('customDomain').value = data.customDomain || '';
        if (document.getElementById('pdfFooterText')) document.getElementById('pdfFooterText').value = data.pdfFooterText || '';

        if (data.logo && document.getElementById('logoPreview')) {
            document.getElementById('logoPreview').src = data.logo;
            document.getElementById('logoPreview').style.display = 'block';
            document.getElementById('logoBase64').value = data.logo;
        }
        if (data.banner && document.getElementById('bannerPreview')) {
            document.getElementById('bannerPreview').src = data.banner;
            document.getElementById('bannerPreview').style.display = 'block';
            document.getElementById('bannerBase64').value = data.banner;
        }

        const sysDoc = await db.collection('settings').doc('system_config').get();
        if (sysDoc.exists) {
            const data = sysDoc.data();
            document.getElementById('currencySymbol').value = data.currency || 'Rs.';
            document.getElementById('dateFormat').value = data.dateFormat || 'DD/MM/YYYY';
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

function previewFile(previewId, input) {
    const file = input.files[0];
    const preview = document.getElementById(previewId);
    const hiddenInput = document.getElementById(previewId.replace('Preview', 'Base64'));

    if (file) {
        // Limit file size (e.g. 500KB) to prevent Firestore limits/costs
        if (file.size > 500 * 1024) {
            alert("File is too large! Please upload an image smaller than 500KB.");
            input.value = ''; // Clear input
            return;
        }

        const reader = new FileReader();
        reader.onloadend = function () {
            preview.src = reader.result;
            preview.style.display = 'block';
            hiddenInput.value = reader.result;
        }
        reader.readAsDataURL(file);
    } else {
        preview.src = "";
        preview.style.display = 'none';
        hiddenInput.value = "";
    }
}

async function handleSaveSettings(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;

    const tenantId = getTenantId();
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const data = {
        tenantId,
        name: document.getElementById('schoolName').value,
        address: document.getElementById('schoolAddress').value,
        phone: document.getElementById('schoolPhone').value,
        email: document.getElementById('schoolEmail').value,
        logo: document.getElementById('logoBase64').value,
        banner: document.getElementById('bannerBase64').value,
        primaryColor: document.getElementById('primaryColor')?.value || '#4f46e5',
        customDomain: document.getElementById('customDomain')?.value || '',
        pdfFooterText: document.getElementById('pdfFooterText')?.value || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        // New: per-tenant branding doc
        await db.collection('branding').doc(tenantId).set({
            ...data,
            updatedBy: user.uid || ''
        }, { merge: true });

        // Legacy compatibility
        await db.collection('settings').doc('school_profile').set(data, { merge: true });

        if (typeof logAudit === 'function') {
            logAudit('branding_save', `branding/${tenantId}`, {
                name: data.name,
                primaryColor: data.primaryColor,
                customDomain: data.customDomain
            });
        }

        if (typeof syncBrandingSettings === 'function') {
            syncBrandingSettings();
        }
        alert(getTrans('settings_saved'));
    } catch (error) {
        console.error("Error saving settings:", error);
        alert("Error: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleSaveBranding(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;

    const tenantId = getTenantId();
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

    const payload = {
        tenantId,
        primaryColor: document.getElementById('primaryColor')?.value || '#4f46e5',
        customDomain: (document.getElementById('customDomain')?.value || '').trim(),
        pdfFooterText: (document.getElementById('pdfFooterText')?.value || '').trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.uid || ''
    };

    try {
        await db.collection('branding').doc(tenantId).set(payload, { merge: true });
        if (typeof logAudit === 'function') logAudit('branding_save', `branding/${tenantId}`, payload);
        if (typeof syncBrandingSettings === 'function') syncBrandingSettings();
        alert(getTrans('settings_saved'));
    } catch (error) {
        console.error("Error saving branding:", error);
        alert("Error: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleSaveSystem(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;

    const data = {
        currency: document.getElementById('currencySymbol').value,
        dateFormat: document.getElementById('dateFormat').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('settings').doc('system_config').set(data, { merge: true });
        
        // Update local storage for immediate use
        localStorage.setItem('currency_symbol', data.currency);
        localStorage.setItem('date_format', data.dateFormat);

        alert(getTrans('settings_saved'));
    } catch (error) {
        console.error("Error saving system config:", error);
        alert("Error: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function handleResetData() {
    const confirmation = document.getElementById('deleteConfirm').value;
    if (confirmation !== 'DELETE') {
        alert("Please type 'DELETE' to confirm.");
        return;
    }

    if (!confirm("Are you absolutely sure? This will wipe all school data.")) {
        return;
    }

    const btn = document.querySelector('.btn-danger');
    const originalText = btn.innerText;
    btn.innerText = 'DELETING...';
    btn.disabled = true;

    try {
        // List of collections to wipe
        const collections = [
            'students', 
            'teachers', 
            'classes', 
            'subjects', 
            'fees', 
            'fee_heads',
            'timetable',
            'attendance',
            'expenses',
            'incomes',
            'exams',
            'certificates',
            'reports',
            // Add other data collections here
        ];

        // Batch delete is limited to 500 ops. For safety and simplicity in client-side script:
        // We fetch all docs and delete them. This might be slow for large data but okay for this app scale.
        
        for (const colName of collections) {
            console.log(`Deleting collection: ${colName}`);
            const snapshot = await db.collection(colName).get();
            const batch = db.batch();
            let count = 0;
            
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
                count++;
            });

            if (count > 0) {
                await batch.commit();
            }
        }

        alert(getTrans('data_reset_success'));
        document.getElementById('deleteConfirm').value = '';
    } catch (error) {
        console.error("Error resetting data:", error);
        alert("Error: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
