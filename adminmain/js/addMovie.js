/**
 * TVK Movies Admin - Add Movie Controller
 * Manages form validations, smart inputs autofill, live URL previews, and API creation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialise session user profiles
    initUserProfile();

    // 2. Setup Responsive Sidebar controls
    setupSidebarToggle();

    // 3. Bind Live Image URL Preview
    setupLivePosterPreview();

    // 4. Bind Smart Release Year Autocompleter
    setupSmartYearAutofill();

    // 5. Setup Form Submissions & validation
    setupFormSubmission();
});

function initUserProfile() {
    const userNameElement = document.getElementById('profile-name');
    const avatarLetters = document.getElementById('avatar-letters');
    const logoutBtn = document.getElementById('sidebar-logout');

    if (window.auth) {
        const username = window.auth.getUsername();
        if (userNameElement) userNameElement.textContent = username;
        if (avatarLetters) {
            avatarLetters.textContent = username.slice(0, 2).toUpperCase();
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to sign out?')) {
                window.auth.logout();
            }
        });
    }
}

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('app-sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggleBtn) {
                sidebar.classList.remove('open');
            }
        });
    }
}

/* --- FORM LIVE INTERACTIVITY --- */

function setupLivePosterPreview() {
    const imageUrlInput = document.getElementById('movie-image');
    const previewBox = document.getElementById('poster-preview-box');
    const previewImg = document.getElementById('poster-preview-img');

    const updatePreview = () => {
        const url = imageUrlInput.value.trim();
        
        // Basic web URL regex
        const urlPattern = /^https?:\/\/.+/i;

        if (url && urlPattern.test(url)) {
            previewImg.src = url;
            previewBox.classList.add('active');
        } else {
            previewImg.src = '';
            previewBox.classList.remove('active');
        }
    };

    imageUrlInput.addEventListener('input', updatePreview);
    imageUrlInput.addEventListener('change', updatePreview);

    // If image loading fails (invalid file format or offline)
    previewImg.addEventListener('error', () => {
        previewImg.src = '';
        previewBox.classList.remove('active');
        console.warn('Live image URL failed to load.');
    });
}

function setupSmartYearAutofill() {
    const releaseInput = document.getElementById('movie-release');
    const yearInput = document.getElementById('movie-year');

    releaseInput.addEventListener('input', () => {
        const text = releaseInput.value.trim();
        // Regex to extract 4 digit year (e.g. 2025, 2026)
        const match = text.match(/\b(19\d\d|20\d\d)\b/);
        
        if (match && match[0]) {
            // Auto fill if year input is currently empty or contains less than 4 digits
            if (!yearInput.value || yearInput.value.toString().length < 4) {
                yearInput.value = match[0];
                // Dismiss active year errors
                const errLabel = document.getElementById('err-movie-year');
                if (errLabel) errLabel.classList.remove('active');
            }
        }
    });
}

/* --- FORM VALIDATIONS & CREATE SUBMIT --- */

function validateUrl(string) {
    if (!string || !string.trim()) return false;
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;  
    }
}

function setupFormSubmission() {
    const form = document.getElementById('add-movie-form');
    
    // Grab all inputs
    const titleEl = document.getElementById('movie-title');
    const imageEl = document.getElementById('movie-image');
    const releaseEl = document.getElementById('movie-release');
    const yearEl = document.getElementById('movie-year');
    const categoryEl = document.getElementById('movie-category');
    const languageEl = document.getElementById('movie-language');
    const durationEl = document.getElementById('movie-duration');
    const directorEl = document.getElementById('movie-director');
    const starringEl = document.getElementById('movie-starring');
    const storyEl = document.getElementById('movie-story');
    
    const link460El = document.getElementById('movie-link-460p');
    const link720El = document.getElementById('movie-link-720p');
    const link1080El = document.getElementById('movie-link-1080p');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let isValid = true;

        // Helper to validate and toggle visibility of errors
        const checkField = (element, errorId, condition = true) => {
            const errEl = document.getElementById(errorId);
            if (!condition || !element.value.trim()) {
                if (errEl) errEl.classList.add('active');
                isValid = false;
            } else {
                if (errEl) errEl.classList.remove('active');
            }
        };

        // Standard Text fields
        checkField(titleEl, 'err-movie-title');
        checkField(releaseEl, 'err-movie-release');
        checkField(languageEl, 'err-movie-language');
        checkField(durationEl, 'err-movie-duration');
        checkField(directorEl, 'err-movie-director');
        checkField(starringEl, 'err-movie-starring');
        checkField(storyEl, 'err-movie-story');
        checkField(categoryEl, 'err-movie-category', categoryEl.value !== '');

        // Year field validation
        const yearVal = parseInt(yearEl.value, 10);
        checkField(yearEl, 'err-movie-year', !isNaN(yearVal) && yearVal >= 1900 && yearVal <= 2100);

        // Poster image link validation
        checkField(imageEl, 'err-movie-image', validateUrl(imageEl.value));

        // Resolution links validation (only check if not empty)
        const checkResLink = (element, errorId) => {
            const val = element.value.trim();
            const errEl = document.getElementById(errorId);
            if (val && !validateUrl(val)) {
                if (errEl) errEl.classList.add('active');
                isValid = false;
            } else {
                if (errEl) errEl.classList.remove('active');
            }
        };

        checkResLink(link460El, 'err-movie-link-460p');
        checkResLink(link720El, 'err-movie-link-720p');
        checkResLink(link1080El, 'err-movie-link-1080p');

        if (!isValid) {
            showToast('Form Error', 'Please correct the highlighted input fields.', 'error');
            // Scroll to top of form card
            form.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        // package movie object
        const moviePayload = {
            title: titleEl.value.trim(),
            image: imageEl.value.trim(),
            release: releaseEl.value.trim(),
            language: languageEl.value.trim(),
            year: yearEl.value.trim(),
            category: categoryEl.value,
            duration: durationEl.value.trim(),
            director: directorEl.value.trim(),
            starring: starringEl.value.trim(),
            story: storyEl.value.trim(),
            "460p": link460El.value.trim() || "https://example.com/360.mp4",
            "720p": link720El.value.trim() || "https://example.com/720.mp4",
            "1080p": link1080El.value.trim() || "https://example.com/1080.mp4"
        };

        try {
            const result = await window.api.addMovie(moviePayload);
            if (result) {
                showToast('Success', `"${moviePayload.title}" added to the database.`, 'success');
                // Wait 1.5 seconds and redirect back to movies catalog
                setTimeout(() => {
                    window.location.href = 'movies.html';
                }, 1500);
            } else {
                throw new Error('Server rejected creation payload.');
            }
        } catch (err) {
            console.error('Failed to create movie record: ', err);
            showToast('API Error', 'Failed to save new movie records.', 'error');
        }
    });

    // Clear validation tags on active inputs
    const bindClearError = (inputEl, errorId) => {
        inputEl.addEventListener('input', () => {
            const errEl = document.getElementById(errorId);
            if (inputEl.value.trim() && errEl) errEl.classList.remove('active');
        });
    };

    bindClearError(titleEl, 'err-movie-title');
    bindClearError(releaseEl, 'err-movie-release');
    bindClearError(languageEl, 'err-movie-language');
    bindClearError(durationEl, 'err-movie-duration');
    bindClearError(directorEl, 'err-movie-director');
    bindClearError(starringEl, 'err-movie-starring');
    bindClearError(storyEl, 'err-movie-story');
    categoryEl.addEventListener('change', () => {
        const errEl = document.getElementById('err-movie-category');
        if (categoryEl.value !== '' && errEl) errEl.classList.remove('active');
    });
}

// Toast Alerts system (identical style)
function showToast(title, desc, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconPath = '';
    if (type === 'success') {
        iconPath = '<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>';
    } else if (type === 'error') {
        iconPath = '<path d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2Z"/>';
    } else {
        iconPath = '<path d="M11,9H13V11H11V9M11,13H13V17H11V13M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22C17.53,22 22,17.53 22,12C22,6.47 17.53,2 12,2Z"/>';
    }

    toast.innerHTML = `
        <div class="toast-icon">
            <svg viewBox="0 0 24 24">${iconPath}</svg>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-desc">${desc}</div>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}
