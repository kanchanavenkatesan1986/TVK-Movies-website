/**
 * TVK Movies Admin - API Client
 * Centralized fetch wrapper for communicating with:
 * https://database.kanchanavenkatesan1986.workers.dev
 */

const API_BASE_URL = 'https://database.teamakatsuki.workers.dev';
const API_MODE_KEY = 'tvk_api_mode'; // 'live' or 'local'
const LOCAL_MOVIES_KEY = 'tvk_local_movies';

class MovieAPI {
    constructor() {
        // Enforce live mode only
        this.mode = 'live';
    }

    /**
     * Show/Hide global loading overlay
     */
    showLoader(show) {
        const loader = document.getElementById('global-loader');
        if (loader) {
            if (show) loader.classList.add('active');
            else loader.classList.remove('active');
        }
    }

    /**
     * Set the current mode (No-op now since we enforce live)
     */
    setMode(mode) {
        this.mode = 'live';
        console.warn('API mode is locked to live database only.');
    }

    /**
     * Get the current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Sanitizes inputs to prevent basic HTML injection/XSS
     */
    sanitize(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    sanitizeMovie(movie) {
        const clean = { ...movie };
        for (let key in clean) {
            if (typeof clean[key] === 'string') {
                clean[key] = this.sanitize(clean[key]);
            }
        }
        return clean;
    }

    /**
     * Map database keys (p460, p720, p1080) to frontend keys (460p, 720p, 1080p)
     */
    mapDbToFrontend(movie) {
        if (!movie) return movie;
        const mapped = { ...movie };
        if (mapped.p460 !== undefined) mapped['460p'] = mapped.p460;
        if (mapped.p720 !== undefined) mapped['720p'] = mapped.p720;
        if (mapped.p1080 !== undefined) mapped['1080p'] = mapped.p1080;
        return mapped;
    }

    /**
     * Map frontend keys (460p, 720p, 1080p) to database keys (p460, p720, p1080)
     */
    mapFrontendToDb(movieData) {
        if (!movieData) return movieData;
        const mapped = { ...movieData };
        if (mapped['460p'] !== undefined) mapped.p460 = mapped['460p'];
        if (mapped['720p'] !== undefined) mapped.p720 = mapped['720p'];
        if (mapped['1080p'] !== undefined) mapped.p1080 = mapped['1080p'];
        return mapped;
    }

    /**
     * Fetches all movies
     */
    async getMovies() {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/movies`);
            if (!res.ok) throw new Error('API server returned error status ' + res.status);
            const data = await res.json();
            const movies = Array.isArray(data) ? data : [];
            return movies.map(m => this.mapDbToFrontend(m));
        } catch (err) {
            console.error('API Fetch failed: ', err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Gets a single movie by ID
     */
    async getMovie(id) {
        this.showLoader(true);
        const movieId = parseInt(id, 10);
        try {
            const res = await fetch(`${API_BASE_URL}/movies/${movieId}`);
            if (!res.ok) throw new Error('API server returned status ' + res.status);
            const movie = await res.json();
            return this.mapDbToFrontend(movie);
        } catch (err) {
            console.error(`API Single fetch for ID ${id} failed: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Creates a new movie
     */
    async addMovie(movieData) {
        this.showLoader(true);
        const cleanData = this.sanitizeMovie(movieData);
        try {
            const dbPayload = this.mapFrontendToDb(cleanData);
            const res = await fetch(`${API_BASE_URL}/movies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbPayload)
            });
            if (!res.ok) throw new Error('Failed to create movie on server');
            const data = await res.json();
            return this.mapDbToFrontend(data);
        } catch (err) {
            console.error('API Add failed: ', err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Updates an existing movie
     */
    async updateMovie(id, movieData) {
        this.showLoader(true);
        const movieId = parseInt(id, 10);
        const cleanData = this.sanitizeMovie(movieData);
        try {
            const dbPayload = this.mapFrontendToDb(cleanData);
            const res = await fetch(`${API_BASE_URL}/movies/${movieId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbPayload)
            });
            if (!res.ok) throw new Error('Failed to update movie on server');
            const data = await res.json();
            return this.mapDbToFrontend(data);
        } catch (err) {
            console.error(`API Update failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Deletes a movie
     */
    async deleteMovie(id) {
        this.showLoader(true);
        const movieId = parseInt(id, 10);
        try {
            const res = await fetch(`${API_BASE_URL}/movies/${movieId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete movie on server');
            return true;
        } catch (err) {
            console.error(`API Delete failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Fetches slider slides (maximum 6 slides)
     */
    async getSlider() {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/slider`);
            if (!res.ok) throw new Error('Slider endpoint not found on server');
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('API Fetch slider failed: ', err);
            return [];
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Creates a new slider record
     * POST /slider  body: { url, image }
     */
    async createSlider(slideData) {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/slider`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slideData)
            });
            if (!res.ok) throw new Error('Failed to create slider on server');
            return true;
        } catch (err) {
            console.error('API Create slider failed: ', err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Updates an existing slider record by ID
     * PUT /slider/{id}  body: { url, image }
     */
    async updateSlider(id, slideData) {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/slider/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(slideData)
            });
            if (!res.ok) throw new Error('Failed to update slider on server');
            return true;
        } catch (err) {
            console.error(`API Update slider failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }

    /**
     * Deletes a slider record by ID
     * DELETE /slider/{id}
     */
    async deleteSlider(id) {
        this.showLoader(true);
        try {
            const res = await fetch(`${API_BASE_URL}/slider/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete slider on server');
            return true;
        } catch (err) {
            console.error(`API Delete slider failed for ID ${id}: `, err);
            throw err;
        } finally {
            this.showLoader(false);
        }
    }
}

// Global Single Instance
window.api = new MovieAPI();
