// Payment gateway scaffolding (Stripe/Razorpay/PayPal placeholders)
// This is a front-end stub to record intents; real payment processing requires backend webhooks.

const PAYMENT_PROVIDERS = {
    stripe: { enabled: true, publishableKey: 'pk_test_replace_me' },
    razorpay: { enabled: true, keyId: 'rzp_test_replace_me' },
    paypal: { enabled: true, clientId: 'paypal_client_id_replace_me' }
};

async function startPayment(provider = 'stripe', feeId) {
    if (!feeId) {
        alert('Missing fee reference.');
        return;
    }
    const providerCfg = PAYMENT_PROVIDERS[provider];
    if (!providerCfg || !providerCfg.enabled) {
        alert('Selected payment provider is not configured.');
        return;
    }
    try {
        const feeDoc = await db.collection('fees').doc(feeId).get();
        if (!feeDoc.exists) throw new Error('Fee record not found.');
        const fee = feeDoc.data();

        const intent = {
            feeId,
            provider,
            amount: fee.amount || 0,
            currency: 'PKR',
            status: 'pending',
            studentId: fee.studentId || '',
            studentName: fee.studentName || '',
            rollNumber: fee.rollNumber || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: firebase.auth().currentUser ? firebase.auth().currentUser.uid : '',
            tenantId: (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default'),
            meta: {
                month: fee.month,
                year: fee.year,
                feeType: fee.feeType
            }
        };
        const ref = await db.collection('payment_intents').add(intent);
        if (typeof logAudit === 'function') {
            logAudit('payment_intent_create', `payment_intents/${ref.id}`, { provider, feeId, amount: fee.amount });
        }
        alert(`Payment intent created. In a real app, redirect to ${provider} checkout. Intent ID: ${ref.id}`);
    } catch (err) {
        console.error(err);
        alert('Payment start failed: ' + err.message);
    }
}

// Record payment status (e.g., from webhook simulator or manual action)
async function recordPaymentStatus(intentId, status = 'succeeded', receiptUrl = '') {
    if (!intentId) return;
    const updates = {
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        receiptUrl: receiptUrl || ''
    };
    try {
        await db.collection('payment_intents').doc(intentId).set(updates, { merge: true });
        if (status === 'succeeded') {
            const intent = await db.collection('payment_intents').doc(intentId).get();
            const data = intent.data();
            // Mark linked fee as paid
            if (data?.feeId) {
                await db.collection('fees').doc(data.feeId).set({
                    status: 'Paid',
                    paidAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            await db.collection('payment_receipts').add({
                intentId,
                feeId: data?.feeId || '',
                amount: data?.amount || 0,
                provider: data?.provider || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                receiptUrl: receiptUrl || ''
            });
        }
        if (typeof logAudit === 'function') {
            logAudit('payment_status_update', `payment_intents/${intentId}`, { status, receiptUrl });
        }
    } catch (err) {
        console.error('Failed to record payment status', err);
    }
}

// Reminder stub (would trigger email/SMS via backend)
async function sendPaymentReminder(feeId) {
    try {
        const feeDoc = await db.collection('fees').doc(feeId).get();
        if (!feeDoc.exists) throw new Error('Fee not found');
        const fee = feeDoc.data();
        alert(`Reminder queued for ${fee.studentName || 'student'} (${fee.rollNumber || ''})`);
        if (typeof logAudit === 'function') {
            logAudit('payment_reminder', `fees/${feeId}`, { studentName: fee.studentName });
        }
    } catch (err) {
        console.error(err);
        alert('Failed to queue reminder: ' + err.message);
    }
}
