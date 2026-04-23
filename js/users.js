document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
});

async function loadUsers() {
    const tbody = document.getElementById('usersList');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();

        let html = '';
        if (snapshot.empty) {
            html = '<tr><td colspan="5" class="text-center" data-i18n="no_users_found">No users found.</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const user = doc.data();
                const roles = (typeof getUserRoles === 'function' ? getUserRoles(user) : [String(user.role || 'student').toLowerCase()]).filter(Boolean);
                const roleBadges = roles.map(role => {
                    const label = (typeof formatRoleLabel === 'function') ? formatRoleLabel(role) : String(role || '').toUpperCase();
                    return `<span class="badge badge-${getRoleColor(role)}" style="margin-right:0.25rem;">${label}</span>`;
                }).join('');
                html += `
                    <tr>
                        <td>${user.email}</td>
                        <td>${roleBadges || '-'}</td>
                        <td>${user.name || '-'}</td>
                        <td>${user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : '-'}</td>
                        <td>
                            <button onclick="editUser('${doc.id}')" class="btn-sm btn-secondary" style="background-color: var(--primary-color); color: white; border: none; margin-right: 0.5rem;" data-i18n="edit">Edit</button>
                            <button onclick="resetPassword('${user.email}')" class="btn-sm btn-secondary" title="Send Password Reset Email" data-i18n="reset_password">🔑 Reset</button>
                            <!-- Deleting users from Client SDK is hard (requires Admin SDK), so we just delete from Firestore and block access logic -->
                            <button onclick="deleteUser('${doc.id}')" class="btn-sm btn-danger" title="Remove Access" data-i18n="remove_access">🗑️</button>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
        updatePageLanguage();
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading users.</td></tr>';
    }
}

function getRoleColor(role) {
    switch ((role || '').toLowerCase()) {
        case 'admin': return 'danger'; // Red
        case 'teacher': return 'warning'; // Yellow
        case 'student': return 'success'; // Green
        case 'nazim_e_taleemaat': return 'info';
        case 'hifz_supervisor': return 'secondary';
        default: return 'secondary';
    }
}

function getSelectedRoles(form) {
    return Array.from(form.querySelectorAll('input[name="roles"]:checked'))
        .map(input => String(input.value || '').trim().toLowerCase())
        .filter(Boolean);
}

function setSelectedRoles(form, roles) {
    const normalized = Array.isArray(roles) ? roles.map(role => String(role || '').trim().toLowerCase()) : [];
    form.querySelectorAll('input[name="roles"]').forEach(input => {
        input.checked = normalized.includes(String(input.value || '').trim().toLowerCase());
    });
    syncPrimaryRoleOptions(form, normalized[0] || '');
}

function syncPrimaryRoleOptions(form, preferredRole = '') {
    if (!form) return;
    const select = form.primaryRole;
    if (!select) return;

    const roles = getSelectedRoles(form);
    const previous = preferredRole || select.value;
    select.innerHTML = `<option value="" data-i18n="select_role">${getTrans('select_role') || 'Select Role'}</option>`;

    roles.forEach(role => {
        const opt = document.createElement('option');
        opt.value = role;
        opt.innerText = (typeof formatRoleLabel === 'function') ? formatRoleLabel(role) : role;
        select.appendChild(opt);
    });

    if (roles.includes(previous)) {
        select.value = previous;
    } else if (roles[0]) {
        select.value = roles[0];
    }

    if (typeof updatePageLanguage === 'function') updatePageLanguage();
}

async function handleAddUser(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;
    const roles = getSelectedRoles(form);
    const name = form.name.value;
    const docId = form.docId.value;

    if (!roles.length) {
        alert('Select at least one role.');
        return;
    }

    const primaryRole = String(form.primaryRole?.value || roles[0] || '').trim().toLowerCase();

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;

    try {
        if (docId) {
            // Edit Mode
            // Update Firestore only.
            await db.collection('users').doc(docId).update({
                role: primaryRole,
                roles: roles,
                name: name,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('User updated successfully!');
        } else {
            // Add Mode
            // Use a secondary app to create user without logging out admin
            const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = secondaryApp.auth();

            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update profile
            await user.updateProfile({ displayName: name });

            // Save to Firestore (using main app db)
            await db.collection('users').doc(user.uid).set({
                email: email,
                role: primaryRole,
                roles: roles,
                name: name,
                localPassword: password, // Save for local auth support
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Sign out from secondary app
            await secondaryAuth.signOut();
            await secondaryApp.delete(); // Cleanup
            alert('User created successfully!');
        }

        closeModal('userModal');
        loadUsers();

    } catch (error) {
        console.error("Error saving user:", error);
        alert("Error: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function editUser(uid) {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) return;
        const user = doc.data();

        const form = document.querySelector('#userModal form');
        form.docId.value = uid;
        form.name.value = user.name;
        form.email.value = user.email;
        form.email.setAttribute('readonly', 'true');
        setSelectedRoles(form, (typeof getUserRoles === 'function') ? getUserRoles(user) : [user.role]);
        if (form.primaryRole) form.primaryRole.value = String(user.role || '').trim().toLowerCase();

        document.getElementById('passwordGroup').style.display = 'none';
        form.password.removeAttribute('required');

        document.getElementById('userModalTitle').innerText = getTrans('edit_user') || 'Edit User';
        document.getElementById('userModalTitle').setAttribute('data-i18n', 'edit_user');
        const btn = form.querySelector('button[type="submit"]');
        btn.innerText = getTrans('update_user');
        btn.setAttribute('data-i18n', 'update_user');

        openModal('userModal');
    } catch (error) {
        console.error(error);
        alert('Error loading user data');
    }
}

async function downloadUsersPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const startY = (typeof applyPdfBranding === 'function')
        ? await applyPdfBranding(doc, { title: 'User Management Report' })
        : 30;

    const rows = [];
    document.querySelectorAll('#usersList tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 5 && !tds[0].innerText.includes('Loading')) {
            rows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText, tds[3].innerText]);
        }
    });

    doc.autoTable({
        head: [['Email', 'Role', 'Name', 'Created At']],
        body: rows,
        startY,
        theme: 'striped'
    });

    doc.save('users_report.pdf');
}

async function downloadUserCredentialsTXT() {
    try {
        const snapshot = await db.collection('users').orderBy('name').get();
        const lines = [];
        lines.push('Idara Misbah ul Quran - User Credentials');
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push('');

        if (snapshot.empty) {
            lines.push('No users found.');
        } else {
            snapshot.forEach((doc, index) => {
                const user = doc.data() || {};
                const roles = (typeof getUserRoles === 'function' ? getUserRoles(user) : [String(user.role || '').trim().toLowerCase()])
                    .filter(Boolean)
                    .map(role => (typeof formatRoleLabel === 'function' ? formatRoleLabel(role) : role))
                    .join(', ') || '-';
                const username = String(
                    user.username
                    || (user.email ? String(user.email).split('@')[0] : '')
                    || ''
                ).trim();
                const password = String(user.localPassword || '').trim() || 'N/A';
                const name = String(user.name || '-').trim() || '-';
                const email = String(user.email || '-').trim() || '-';

                lines.push(`${index + 1}. ${name}`);
                lines.push(`Username: ${username || '-'}`);
                lines.push(`Password: ${password}`);
                lines.push(`Email: ${email}`);
                lines.push(`Roles: ${roles}`);
                lines.push('');
            });
        }

        const content = lines.join('\r\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user_credentials_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export credentials TXT:', error);
        alert('User credentials TXT export failed: ' + (error?.message || error));
    }
}

async function resetPassword(email) {
    const modal = document.getElementById('resetPasswordModal');
    if (!modal) return;

    // Set email in hidden field
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        form.email.value = email;
    }

    openModal('resetPasswordModal');
}

async function handleManualPasswordReset(event) {
    event.preventDefault();
    const form = event.target;
    // We need the docId (uid) to identify the user correctly in Firestore
    // But the form currently only has email. We should look up the UID or pass it.
    // Let's modify the resetPassword function to pass UID.

    // Fallback: lookup by email if UID missing (though slower/riskier if duplicates)
    const email = form.email.value;
    const newPassword = form.newPassword.value;

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;

    try {
        // 1. Find user by email to get UID
        const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (snapshot.empty) {
            throw new Error('User not found.');
        }
        const doc = snapshot.docs[0];

        // 2. Save 'localPassword' to Firestore
        await doc.ref.update({
            localPassword: newPassword, // Note: storing password for local-only auth
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Password for ${email} updated successfully! (Local App Mode)`);
        closeModal('resetPasswordModal');

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function deleteUser(uid) {
    // Note: This only deletes from Firestore. The Auth user remains unless we use Cloud Functions or Admin SDK.
    // However, the app logic checks Firestore for role/access, so removing from Firestore effectively bans them from the app.
    if (!confirm("Are you sure? This will remove the user's access to the dashboard. (Note: Auth account remains)")) return;

    try {
        await db.collection('users').doc(uid).delete();
        loadUsers();
        alert("User access removed.");
    } catch (error) {
        console.error(error);
        alert("Error deleting user: " + error.message);
    }
}

// Modal Helpers
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    const form = document.querySelector(`#${id} form`);
    if (form) {
        form.reset();
        if (form.docId) form.docId.value = '';

        // Reset Edit Mode changes if it's the user modal
        if (id === 'userModal') {
            if (form.email) form.email.removeAttribute('readonly');
            if (document.getElementById('passwordGroup')) document.getElementById('passwordGroup').style.display = 'block';
            if (form.password) form.password.setAttribute('required', 'true');
            if (document.getElementById('userModalTitle')) {
                document.getElementById('userModalTitle').innerText = getTrans('add_new_user') || 'Add New User';
                document.getElementById('userModalTitle').setAttribute('data-i18n', 'add_new_user');
            }
            const btn = form.querySelector('button[type="submit"]');
            if (btn) {
                btn.innerText = getTrans('create_user') || 'Create User';
                btn.setAttribute('data-i18n', 'create_user');
            }
            syncPrimaryRoleOptions(form);
        }
    }
}
