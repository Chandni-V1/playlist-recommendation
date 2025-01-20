class SpotifyPlaylistDiscovery {
    constructor() {
        this.token = null;
        this.initializeApp();
    }

    initializeApp() {
        // Check if we're returning from Spotify auth
        if (window.location.hash) {
            this.handleAuthCallback();
        }

        // Setup button listeners
        document.getElementById('login-button').addEventListener('click', () => this.login());
        document.getElementById('get-playlists').addEventListener('click', () => this.getRecommendations());

        // Check if we have a token
        if (sessionStorage.getItem('spotify_token')) {
            this.token = sessionStorage.getItem('spotify_token');
            this.showAppView();
        }
    }

    login() {
        const authUrl = 
            'https://accounts.spotify.com/authorize' +
            '?client_id=' + SPOTIFY_CONFIG.CLIENT_ID +
            '&response_type=token' +
            '&redirect_uri=' + encodeURIComponent(SPOTIFY_CONFIG.REDIRECT_URI) +
            '&scope=' + SPOTIFY_CONFIG.SCOPES.join('%20') +
            '&show_dialog=true';
        
        window.location.href = authUrl;
    }

    handleAuthCallback() {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        this.token = params.get('access_token');
        
        if (this.token) {
            sessionStorage.setItem('spotify_token', this.token);
            this.showAppView();
            // Clear the URL hash
            history.pushState("", document.title, window.location.pathname);
        }
    }

    showAppView() {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
    }

    async getRecommendations() {
        this.showLoading(true);
        try {
            // First get user's top items
            const topArtists = await this.fetchTopArtists();
            const topTracks = await this.fetchTopTracks();

            if (!topArtists.length || !topTracks.length) {
                throw new Error('No top artists or tracks found');
            }

            // Get recommendations based on top items
            const recommendedTracks = await this.getRecommendedTracks(topArtists, topTracks);
            
            if (!recommendedTracks.length) {
                throw new Error('No recommended tracks found');
            }

            // Find playlists containing these tracks
            const playlists = await this.findPlaylistsWithTracks(recommendedTracks);
            this.displayPlaylists(playlists);
        } catch (error) {
            console.error('Error:', error);
            if (!this.token) {
                alert('Please log in again.');
                sessionStorage.removeItem('spotify_token');
                window.location.reload();
            } else if (error.status === 401) {
                alert('Session expired. Please log in again.');
                sessionStorage.removeItem('spotify_token');
                window.location.reload();
            } else {
                alert('An error occurred. Please try again.');
            }
        }
        this.showLoading(false);
    }

    async fetchTopArtists() {
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=5&time_range=medium_term', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.items;
    }

    async fetchTopTracks() {
        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=medium_term', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.items;
    }

    async getRecommendedTracks(seedArtists, seedTracks) {
        // Take up to 2 seed artists and 3 seed tracks
        const seedArtistIds = seedArtists.slice(0, 2).map(artist => artist.id).join(',');
        const seedTrackIds = seedTracks.slice(0, 3).map(track => track.id).join(',');

        const params = new URLSearchParams({
            seed_artists: seedArtistIds,
            seed_tracks: seedTrackIds,
            limit: 20
        });

        const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.tracks;
    }

    async findPlaylistsWithTracks(recommendedTracks) {
        const playlists = new Set();
        const processedPlaylistIds = new Set();

        // Only process first 5 recommended tracks to avoid too many API calls
        for (const track of recommendedTracks.slice(0, 5)) {
            try {
                const searchQuery = `${track.name} ${track.artists[0].name}`;
                const response = await fetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=playlist&limit=5`, {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    }
                );
                
                if (!response.ok) continue;

                const data = await response.json();
                const validPlaylists = (data.playlists?.items || []).filter(playlist => 
                    playlist &&
                    playlist.owner &&
                    playlist.owner.id !== 'spotify' &&
                    !processedPlaylistIds.has(playlist.id) &&
                    playlist.tracks.total >= 20
                );

                for (const playlist of validPlaylists) {
                    processedPlaylistIds.add(playlist.id);
                    playlists.add(playlist);
                }
            } catch (error) {
                console.error(`Error searching playlists:`, error);
            }
        }

        return Array.from(playlists);
    }

    displayPlaylists(playlists) {
        const container = document.getElementById('playlists-container');
        
        if (!playlists.length) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No matching playlists found. Try again!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = playlists.map(playlist => `
            <div class="playlist-card">
                <img src="${playlist.images[0]?.url || 'https://via.placeholder.com/300'}" alt="${playlist.name}">
                <div class="playlist-info">
                    <h3>${playlist.name}</h3>
                    <p>By ${playlist.owner.display_name}</p>
                    <p>${playlist.tracks.total} tracks</p>
                    <a href="${playlist.external_urls.spotify}" target="_blank" class="spotify-button">
                        Open in Spotify
                    </a>
                </div>
            </div>
        `).join('');
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
        document.getElementById('playlists-container').classList.toggle('hidden', show);
    }
}

// Initialize the app
new SpotifyPlaylistDiscovery();
