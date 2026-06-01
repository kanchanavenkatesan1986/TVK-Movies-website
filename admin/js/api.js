/**
 * TVK Movies Admin - API Client
 * Centralized fetch wrapper for communicating with:
 * https://database.kanchanavenkatesan1986.workers.dev
 */

const API_BASE_URL = 'https://database.kanchanavenkatesan1986.workers.dev';
const API_MODE_KEY = 'tvk_api_mode'; // 'live' or 'local'
const LOCAL_MOVIES_KEY = 'tvk_local_movies';

// Default mock data is kept empty as requested
const DEFAULT_MOCK_DATA = [];

class MovieAPI {
    constructor() {
        // Initialize API mode
        if (!localStorage.getItem(API_MODE_KEY)) {
            localStorage.setItem(API_MODE_KEY, 'live');
        }
        
        // Proactive migration check: If local storage has the old mock data, clear it!
        try {
            const currentLocal = localStorage.getItem(LOCAL_MOVIES_KEY);
            if (currentLocal) {
                const parsed = JSON.parse(currentLocal);
                if (Array.isArray(parsed) && parsed.some(m => m.title === "Couple Friendly" && m.director === "Ashwin Chandrasekar")) {
                    localStorage.removeItem(LOCAL_MOVIES_KEY);
                }
            }
        } catch (e) {
            console.warn('Local storage migration failed: ', e);
        }

        // Seed local storage with mock data if it doesn't exist
        if (!localStorage.getItem(LOCAL_MOVIES_KEY)) {
            localStorage.setItem(LOCAL_MOVIES_KEY, JSON.stringify(DEFAULT_MOCK_DATA));
        }
    }

    get mode() {
        return localStorage.getItem(API_MODE_KEY);
    }

    set mode(value) {
        if (value === 'live' || value === 'local') {
            localStorage.setItem(API_MODE_KEY, value);
        }
    }

    /**
     * Helper to show loading states and toast messages
     */
    showLoader(show) {
        const loader = document.getElementById('global-loader');
        if (loader) {
            if (show) loader.classList.add('active');
            else loader.classList.remove('active');
        }
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
            if (this.mode === 'local') {
                // Return local storage mock
                return this.getLocalMovies();
            }
            
            // Try fetching from the database worker
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
            if (this.mode === 'local') {
                return this.getLocalMovie(movieId);
            }
            
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
            if (this.mode === 'local') {
                return this.addLocalMovie(cleanData);
            }
            
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
            if (this.mode === 'local') {
                return this.updateLocalMovie(movieId, cleanData);
            }
            
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
            if (this.mode === 'local') {
                return this.deleteLocalMovie(movieId);
            }
            
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

    /* --- LOCAL STORAGE DATABASE ENGINES --- */
    getLocalMovies() {
        const data = localStorage.getItem(LOCAL_MOVIES_KEY);
        return data ? JSON.parse(data) : [];
    }

    getLocalMovie(id) {
        const movies = this.getLocalMovies();
        return movies.find(m => m.id === id) || null;
    }

    addLocalMovie(movie) {
        const movies = this.getLocalMovies();
        const maxId = movies.reduce((max, m) => m.id > max ? m.id : max, 0);
        const newMovie = {
            ...movie,
            id: maxId + 1
        };
        movies.push(newMovie);
        localStorage.setItem(LOCAL_MOVIES_KEY, JSON.stringify(movies));
        return newMovie;
    }

    updateLocalMovie(id, data) {
        const movies = this.getLocalMovies();
        const index = movies.findIndex(m => m.id === id);
        if (index === -1) throw new Error(`Movie with ID ${id} not found locally.`);
        
        movies[index] = {
            ...data,
            id: id // Ensure ID doesn't change
        };
        localStorage.setItem(LOCAL_MOVIES_KEY, JSON.stringify(movies));
        return movies[index];
    }

    deleteLocalMovie(id) {
        const movies = this.getLocalMovies();
        const filtered = movies.filter(m => m.id !== id);
        localStorage.setItem(LOCAL_MOVIES_KEY, JSON.stringify(filtered));
        return true;
    }
}

// Global Single Instance
window.api = new MovieAPI();
