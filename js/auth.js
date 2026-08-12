/* ==========================================
   AUTH WIRING
   ------------------------------------------
   Controls the login screen and decides when the BudgetApp instance is
   created. The app is only ever instantiated (and its data only ever
   loaded) once Firebase confirms a user is signed in — and it's loaded
   using THAT user's uid, so different accounts never see each other's
   data, and the same account sees the same data on any device.
   ========================================== */

const loginScreen = document.getElementById('loginScreen');
const appShell = document.getElementById('appShell');
const authError = document.getElementById('authError');
const userEmailLabel = document.getElementById('userEmailLabel');

function showAuthError(message) {
    authError.textContent = message;
    authError.classList.remove('hidden');
}

function clearAuthError() {
    authError.textContent = '';
    authError.classList.add('hidden');
}

function handleSignup() {
    clearAuthError();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!email || !password) {
        showAuthError('Enter an email and password first.');
        return;
    }
    auth.createUserWithEmailAndPassword(email, password)
        .catch(err => showAuthError(err.message));
}

function handleLogin() {
    clearAuthError();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!email || !password) {
        showAuthError('Enter an email and password first.');
        return;
    }
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => showAuthError(err.message));
}

function handleGoogleLogin() {
    clearAuthError();
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(err => showAuthError(err.message));
}

function handleLogout() {
    if (window.app) {
        // Stop any running chart instances cleanly before tearing down.
        Object.values(window.app.chartInstances || {}).forEach(c => c && c.destroy && c.destroy());
    }
    auth.signOut();
}

// Central switch: fires on load, and again on every login/logout.
auth.onAuthStateChanged(async (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        appShell.classList.remove('hidden');
        userEmailLabel.textContent = user.email || '';

        window.app = new BudgetApp(user.uid);
        await window.app.loadData();
        window.app.init();
    } else {
        appShell.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
        window.app = null;
    }
});
