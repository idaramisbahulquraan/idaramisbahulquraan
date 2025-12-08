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
            html = '<tr><td colspan="5" class="text-center">No users found.</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const user = doc.data();
                html += `
                    <tr>
                        <td>${user.email}</td>
                        <td><span class="badge badge-${getRoleColor(user.role)}">${user.role.toUpperCase()}</span></td>
                        <td>${user.name || '-'}</td>
                        <td>${user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : '-'}</td>
                        <td>
                            <button onclick="editUser('${doc.id}')" class="btn-sm btn-secondary" style="background-color: var(--primary-color); color: white; border: none; margin-right: 0.5rem;">Edit</button>
                            <button onclick="resetPassword('${user.email}')" class="btn-sm btn-secondary" title="Send Password Reset Email">🔑 Reset</button>
                            <!-- Deleting users from Client SDK is hard (requires Admin SDK), so we just delete from Firestore and block access logic -->
                            <button onclick="deleteUser('${doc.id}')" class="btn-sm btn-danger" title="Remove Access">🗑️</button>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading users.</td></tr>';
    }
}

function getRoleColor(role) {
    switch(role) {
        case 'admin': return 'danger'; // Red
        case 'teacher': return 'warning'; // Yellow
        case 'student': return 'success'; // Green
        default: return 'secondary';
    }
}

async function handleAddUser(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;
    const role = form.role.value;
    const name = form.name.value;
    const docId = form.docId.value;

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;

    try {
        if (docId) {
            // Edit Mode
            // Update Firestore only.
            await db.collection('users').doc(docId).update({
                role: role,
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
                role: role,
                name: name,
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
        if(!doc.exists) return;
        const user = doc.data();
        
        const form = document.querySelector('#userModal form');
        form.docId.value = uid;
        form.name.value = user.name;
        form.email.value = user.email;
        form.email.setAttribute('readonly', 'true');
        form.role.value = user.role;
        
        document.getElementById('passwordGroup').style.display = 'none';
        form.password.removeAttribute('required');
        
        document.getElementById('userModalTitle').innerText = 'Edit User';
        form.querySelector('button[type="submit"]').innerText = 'Update User';
        
        openModal('userModal');
    } catch (error) {
        console.error(error);
        alert('Error loading user data');
    }
}

function downloadUsersPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.text("User Management Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26);
    
    const rows = [];
    document.querySelectorAll('#usersList tr').forEach(tr => {
         const tds = tr.querySelectorAll('td');
         if(tds.length >= 5 && !tds[0].innerText.includes('Loading')) {
             rows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText, tds[3].innerText]);
         }
    });
    
    doc.autoTable({
        head: [['Email', 'Role', 'Name', 'Created At']],
        body: rows,
        startY: 30,
        theme: 'striped'
    });
    
    doc.save('users_report.pdf');
}

async function resetPassword(email) {
    if (!confirm(`Send password reset email to ${email}?`)) return;

    try {
        await auth.sendPasswordResetEmail(email);
        alert(`Password reset email sent to ${email}`);
    } catch (error) {
        console.error(error);
        alert("Error sending reset email: " + error.message);
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
    form.reset();
    form.docId.value = '';
    
    // Reset Edit Mode changes
    form.email.removeAttribute('readonly');
    document.getElementById('passwordGroup').style.display = 'block';
    form.password.setAttribute('required', 'true');
    document.getElementById('userModalTitle').innerText = 'Add New User';
    form.querySelector('button[type="submit"]').innerText = 'Create User';
}
