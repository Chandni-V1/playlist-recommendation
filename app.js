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
            console.log('Starting recommendation flow with token:', this.token ? 'Token exists' : 'No token');
            
            // Get user's top artists and tracks
            const [topArtists, topTracks] = await Promise.all([
                this.fetchTopArtists(),
                this.fetchTopTracks()
            ]);
            console.log('Fetched top artists and tracks:', { topArtists, topTracks });

            // Get recommended tracks using just artists and tracks as seeds
          async getRecommendedTracks(seedArtists, seedTracks) {
        if (!seedArtists.length && !seedTracks.length) {
            throw new Error('No seed artists or tracks available');
        }

        // Create base URL
        let url = 'https://api.spotify.com/v1/recommendations?limit=20';

        // Add seed artists if available
        if (seedArtists.length > 0) {
            // Use plain comma without encoding
            url += `&seed_artists=${seedArtists.map(artist => artist.id).join(',')}`;
        }

        // Add seed tracks if available
        if (seedTracks.length > 0) {
            // Use plain comma without encoding
            url += `&seed_tracks=${seedTracks.map(track => track.id).join(',')}`;
        }

        console.log('Recommendations URL:', url); // For debugging

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Recommendations API error:', errorText);
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;
            throw error;
        }
        
        const data = await response.json();
        return data.tracks || [];
    }


    async fetchTopArtists() {
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;
            throw error;
        }
        
        const data = await response.json();
        return data.items || [];
    }

    async fetchTopTracks() {
        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=medium_term', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;
            throw error;
        }
        
        const data = await response.json();
        return data.items || [];
    }

    async getRecommendedTracks(seedArtists, seedTracks) {
        if (!seedArtists.length && !seedTracks.length) {
            throw new Error('No seed artists or tracks available');
        }

        const params = new URLSearchParams();
        
        if (seedArtists.length) {
            params.append('seed_artists', seedArtists.map(artist => artist.id).join(','));
        }
        
        if (seedTracks.length) {
            params.append('seed_tracks', seedTracks.map(track => track.id).join(','));
        }
        
        params.append('limit', '20');

        const response = await fetch(`https://api.spotify.com/v1/recommendations?${params}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
            console.error('Recommendations API error:', await response.text());
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;
            throw error;
        }
        
        const data = await response.json();
        return data.tracks || [];
    }

    async findPlaylistsWithTracks(recommendedTracks) {
        const playlists = new Set();
        const processedPlaylistIds = new Set();

        for (const track of recommendedTracks) {
            try {
                const response = await fetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(track.name)}${
                        encodeURIComponent(' ' + track.artists[0].name)
                    }&type=playlist&limit=5`, {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    }
                );
                
                if (!response.ok) {
                    console.error(`Failed to search playlists for track ${track.name}:`, response.status);
                    continue;
                }

                const data = await response.json();
                const validPlaylists = (data.playlists?.items || []).filter(playlist => 
                    playlist &&
                    playlist.owner &&
                    playlist.owner.id !== 'spotify' &&
                    !playlist.owner.id.startsWith('spotify') &&
                    !processedPlaylistIds.has(playlist.id) &&
                    playlist.tracks.total >= 20 // Only include substantial playlists
                );

                for (const playlist of validPlaylists) {
                    processedPlaylistIds.add(playlist.id);
                    playlists.add(playlist);
                }
            } catch (error) {
                console.error(`Error processing track ${track.name}:`, error);
                continue;
            }
        }

        return Array.from(playlists);
    }

    displayPlaylists(playlists) {
        const container = document.getElementById('playlists-container');
        
        if (playlists.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No matching playlists found. Try again later!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = playlists.map(playlist => `
            <div class="playlist-card">
                <img src="${playlist.images[0]?.url || 'default-playlist.png'}" alt="${playlist.name || 'Untitled Playlist'}">
                <div class="playlist-info">
                    <h3>${playlist.name || 'Untitled Playlist'}</h3>
                    <p>Created by: ${playlist.owner?.display_name || 'Unknown Creator'}</p>
                    <p>${playlist.tracks?.total || 0} tracks</p>
                    <a href="${playlist.external_urls?.spotify || '#'}" target="_blank" class="spotify-button">
                        Open in Spotify
                    </a>
                </div>
            </div>
        `).join('');
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
        document.getElementById('playlists-container').innerHTML = '';
    }
}

// Initialize the app
new SpotifyPlaylistDiscovery();
