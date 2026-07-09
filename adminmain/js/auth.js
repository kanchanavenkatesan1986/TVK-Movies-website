/**
 * TVK Movies Admin - Authentication Guard
 * Provides Session Storage session checks and logout capabilities.
 */

const AUTH_SESSION_KEY = 'tvk_admin_logged_in';
const AUTH_USER_KEY = 'tvk_admin_username';

class AuthSystem {
    constructor() {
        // Allow user configuration, default to: Ellayaff / Ellayaff@.1
        if (!localStorage.getItem('tvk_admin_config_user')) {
            localStorage.setItem('tvk_admin_config_user', 'Ellayaff');
            localStorage.setItem('tvk_admin_config_pass', 'Ellayaff@.1');
        }
    }

    /**g
     * Checks if the user is authenticated in the current session
     */
    isAuthenticated() {
        return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
    }

    /**
     * Validates credentials against storage and initiates session
     */
    login(username, password) {
        const storedUser = localStorage.getItem('tvk_admin_config_user');
        const storedPass = localStorage.getItem('tvk_admin_config_pass');

        if (username === storedUser && password === storedPass) {
            sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
            sessionStorage.setItem(AUTH_USER_KEY, username);
            return { success: true };
        }
        return { success: false, message: 'Invalid Admin username or password' };
    }

    /**
     * Terminate the session and redirect to the login screen
     */
    logout() {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        sessionStorage.removeItem(AUTH_USER_KEY);
        
        // Find relative path to login page (index.html)
        const isSubPage = window.location.pathname.includes('/pages/');
        const redirectPath = isSubPage ? '../index.html' : 'index.html';
        
        window.location.href = redirectPath;
    }

    /**
     * Main route guard function. Call on page load.
     */
    guard() {
        const isSubPage = window.location.pathname.includes('/pages/');
        const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('admin/') || window.location.pathname.endsWith('admin');

        const loggedIn = this.isAuthenticated();

        if (isSubPage && !loggedIn) {
            // Unauthenticated trying to access a secure dashboard page
            console.log('Unauthorized access attempt. Redirecting to login...');
            window.location.href = '../index.html';
        } else if ((isLoginPage || window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) && loggedIn) {
            // Authenticated trying to access the login page
            console.log('Authenticated session found. Redirecting to dashboard...');
            window.location.href = 'pages/dashboard.html';
        }
    }

    /**
     * Get active logged-in username
     */
    getUsername() {
        return sessionStorage.getItem(AUTH_USER_KEY) || 'Admin';
    }
}

// Global Single Instance
window.auth = new AuthSystem();

// Run immediate guard check before rendering page contents to prevent flickering/FOUC
window.auth.guard();
