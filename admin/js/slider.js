/**
 * TVK Movies Admin - Slider Controller
 * Manages slider images, go URLs, validation, cap limits, and page bindings.
 */

let activeSlides = [];
let activeDeleteIndex = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize user profile
    initUserProfile();

    // 2. Setup sidebar controls
    setupSidebarToggle();

    // 3. Bind UI listeners
    setupListeners();

    // 4. Fetch slider data
    await fetchSlider();
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

// Global modal controls helper
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
};

window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
};

/**
 * Resolves paths relative to website root for local previewing
 */
function resolveImagePath(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    // Remove leading ./ or /
    const cleanPath = path.replace(/^\.?\//, '');
    return '../../' + cleanPath;
}

function setupListeners() {
    const addTrigger = document.getElementById('add-slide-trigger');
    const imageInput = document.getElementById('slide-image-input');
    const saveBtn = document.getElementById('save-slide-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    // Add slide modal opener
    if (addTrigger) {
        addTrigger.addEventListener('click', () => {
            if (activeSlides.length >= 6) {
                showToast('Limit Reached', 'Only a maximum of 6 slides can be added.', 'warning');
                return;
            }
            openAddSlideModal();
        });
    }

    // Live preview loader
    if (imageInput) {
        imageInput.addEventListener('input', () => {
            updateLivePreview(imageInput.value.trim());
        });
    }

    // Save slide click
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveSlideForm();
        });
    }

    // Confirm Delete click
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (activeDeleteIndex !== null) {
                await deleteSlide(activeDeleteIndex);
            }
        });
    }
}

/**
 * Load slider data from API Client
 */
async function fetchSlider() {
    try {
        activeSlides = await window.api.getSlider();
        if (!Array.isArray(activeSlides)) activeSlides = [];
        renderTable();
    } catch (err) {
        console.error('Failed to fetch slider config: ', err);
        showToast('Data Error', 'Failed to retrieve slider configuration.', 'error');
        
        const tableBody = document.getElementById('slider-rows');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:40px 20px; color:var(--status-error);">
                        Failed to connect to the slider database.
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Renders the slides table and updates the limit status banner
 */
function renderTable() {
    const tableBody = document.getElementById('slider-rows');
    const limitText = document.getElementById('slider-limit-text');
    const limitIndicator = document.getElementById('slider-limit-indicator');
    const addTrigger = document.getElementById('add-slide-trigger');
    
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const total = activeSlides.length;

    // Update status indicator
    if (limitText && limitIndicator) {
        limitText.textContent = `${total} of 6 Slides Active`;
        if (total >= 6) {
            limitIndicator.className = 'slide-limit-info'; // Yellow/Warning border
            limitText.textContent += ' (Maximum Capped)';
            if (addTrigger) {
                addTrigger.disabled = true;
                addTrigger.style.opacity = '0.5';
                addTrigger.style.cursor = 'not-allowed';
            }
        } else {
            limitIndicator.className = 'slide-limit-info success-limit'; // Green/Success border
            limitText.textContent += ` (${6 - total} slot${6 - total === 1 ? '' : 's'} available)`;
            if (addTrigger) {
                addTrigger.disabled = false;
                addTrigger.style.opacity = '1';
                addTrigger.style.cursor = 'pointer';
            }
        }
    }

    if (total === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;color:var(--text-muted);padding:50px 0;">
                    No slides active. Click 'Add Slide' to upload the first one!
                </td>
            </tr>
        `;
        return;
    }

    activeSlides.forEach((slide, idx) => {
        const row = document.createElement('tr');
        const previewUrl = resolveImagePath(slide.image);
        const urlVal = slide.url || slide.title || ''; // Fallback for backwards compatibility if needed
        
        row.innerHTML = `
            <td style="font-weight: 700; color: var(--primary);">#${idx + 1}</td>
            <td>
                <img class="slider-img-preview" src="${previewUrl}" alt="Slide ${idx + 1}" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=150'">
            </td>
            <td class="url-cell" title="${slide.image}">${slide.image}</td>
            <td class="url-cell">
                <a href="${urlVal}" target="_blank" title="Go to Link">${urlVal}</a>
            </td>
            <td>
                <div class="action-buttons" style="justify-content: center;">
                    <button class="btn-action btn-action-edit" onclick="triggerEditSlide(${idx})" title="Edit Slide Details">
                        <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.07,6.18L3,17.25Z"/></svg>
                    </button>
                    <button class="btn-action btn-action-delete" onclick="triggerDeleteSlide(${idx})" title="Remove Slide">
                        <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updateLivePreview(url) {
    const previewImg = document.getElementById('image-live-preview');
    const placeholder = document.getElementById('preview-placeholder');
    
    if (!previewImg || !placeholder) return;

    if (!url) {
        previewImg.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.textContent = 'Live Image Preview';
        return;
    }

    const resolved = resolveImagePath(url);
    previewImg.src = resolved;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';

    previewImg.onerror = () => {
        previewImg.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.textContent = '❌ Failed to load image preview';
    };
}

function openAddSlideModal() {
    const titleText = document.getElementById('modal-title-text');
    const indexInput = document.getElementById('slide-index');
    const imageInput = document.getElementById('slide-image-input');
    const linkInput = document.getElementById('slide-link-input');

    if (titleText) titleText.textContent = 'Add New Slide';
    if (indexInput) indexInput.value = '-1';
    if (imageInput) imageInput.value = '';
    if (linkInput) linkInput.value = '';
    
    updateLivePreview('');
    openModal('slide-modal');
}

window.triggerEditSlide = function(idx) {
    const slide = activeSlides[idx];
    if (!slide) return;

    const titleText = document.getElementById('modal-title-text');
    const indexInput = document.getElementById('slide-index');
    const imageInput = document.getElementById('slide-image-input');
    const linkInput = document.getElementById('slide-link-input');

    if (titleText) titleText.textContent = `Edit Slide #${idx + 1}`;
    if (indexInput) indexInput.value = idx.toString();
    if (imageInput) imageInput.value = slide.image;
    // URL field holds the click destination
    if (linkInput) linkInput.value = slide.url || slide.title || '';

    updateLivePreview(slide.image);
    openModal('slide-modal');
};

window.triggerDeleteSlide = function(idx) {
    activeDeleteIndex = idx;
    const numSpan = document.getElementById('delete-slide-num');
    if (numSpan) numSpan.textContent = `#${idx + 1}`;
    openModal('delete-modal');
};

async function saveSlideForm() {
    const indexInput = document.getElementById('slide-index');
    const imageInput = document.getElementById('slide-image-input');
    const linkInput = document.getElementById('slide-link-input');

    if (!imageInput || !linkInput || !indexInput) return;

    const imgVal = imageInput.value.trim();
    const urlVal = linkInput.value.trim(); // Changed from 'title' to 'url'
    const idx = parseInt(indexInput.value, 10);

    if (!imgVal) {
        showToast('Input Required', 'Please enter a slide image URL.', 'error');
        imageInput.focus();
        return;
    }

    if (!urlVal) {
        showToast('Input Required', 'Please enter a click-redirect destination URL.', 'error');
        linkInput.focus();
        return;
    }

    // Payload matches database columns: url + image
    const slidePayload = {
        url: urlVal,
        image: imgVal
    };

    closeModal('slide-modal');

    try {
        if (idx === -1) {
            // CREATE new slide
            if (activeSlides.length >= 6) {
                showToast('Limit Reached', 'Cannot exceed maximum limit of 6 slides.', 'error');
                return;
            }
            await window.api.createSlider(slidePayload);
            showToast('Slide Created', 'New slide added to home page rotation.', 'success');
        } else {
            // UPDATE existing slide
            if (idx >= 0 && idx < activeSlides.length) {
                const existingId = activeSlides[idx].id;
                await window.api.updateSlider(existingId, slidePayload);
                showToast('Slide Updated', `Slide #${idx + 1} was updated successfully.`, 'success');
            }
        }
        await fetchSlider();
    } catch (err) {
        console.error('Failed to commit slider changes: ', err);
        showToast('Save Failed', 'Could not reach server. Please check connection.', 'error');
        // Re-fetch to stay in sync
        await fetchSlider();
    }
}

async function deleteSlide(idx) {
    closeModal('delete-modal');
    
    if (idx < 0 || idx >= activeSlides.length) return;

    const slide = activeSlides[idx];
    const slideId = slide.id;

    try {
        await window.api.deleteSlider(slideId);
        showToast('Slide Removed', `Slide #${idx + 1} was successfully deleted.`, 'success');
        await fetchSlider();
    } catch (err) {
        console.error('Failed to delete slide record:', err);
        showToast('Deletion Failed', 'Could not delete from server.', 'error');
        // Re-fetch to stay in sync
        await fetchSlider();
    } finally {
        activeDeleteIndex = null;
    }
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
