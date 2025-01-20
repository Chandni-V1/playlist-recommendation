class SpotifyPlaylistDiscovery {
    constructor() {
        this.token = null;
        this.loginButton = document.getElementById('login-button');
        this.getPlaylistsButton = document.getElementById('get-playlists');
        
        // Initialize the app
        this.init();
    }

    init() {
        // Add event listeners
        this.loginButton.addEventListener('click', () => {
            console.log('Login button clicked');
            this.handleLogin();
        });
        
        this.getPlaylistsButton.addEventListener('click', () => {
            console.log('Get playlists button clicked');
            this.getRecommendations();
        });

        // Check for returning auth
        if (window.location.hash) {
            console.log('Hash detected in URL');
            this.handleAuthCallback();
        }

        // Check for existing token
        const existingToken = sessionStorage.getItem('spotify_token');
        if (existingToken) {
            console.log('Existing token found');
            this.token = existingToken;
            this.showAppView();
        }
    }

    handleLogin() {
        console.log('Starting login process...');
        const scopes = SPOTIFY_CONFIG.SCOPES.join(' ');
        const redirectUri = encodeURIComponent(SPOTIFY_CONFIG.REDIRECT_URI);
        
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CONFIG.CLIENT_ID}&response_type=token&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes)}&show_dialog=true`;
        
        console.log('Redirecting to:', authUrl);
        window.location.href = authUrl;
    }

    handleAuthCallback() {
        console.log('Processing auth callback...');
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');

        if (token) {
            console.log('Token received');
            this.token = token;
            sessionStorage.setItem('spotify_token', token);
            this.showAppView();
            history.pushState('', document.title, window.location.pathname);
        } else {
            console.error('No token found in callback');
        }
    }

    showAppView() {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
    }

    async getRecommendations() {
        console.log('Getting recommendations...');
        if (!this.token) {
            console.error('No token available');
            alert('Please log in first');
            return;
        }

        this.showLoading(true);

        try {
            const artists = await this.getTopArtists();
            const tracks = await this.getTopTracks();

            if (!artists.length || !tracks.length) {
                throw new Error('Could not fetch top items');
            }

            const recommendations = await this.getRecommendedTracks(artists[0].id, tracks[0].id);
            const playlists = await this.findPlaylists(recommendations);
            this.displayPlaylists(playlists);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async getTopArtists() {
        console.log('Fetching top artists...');
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=5', {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch top artists');
        }

        const data = await response.json();
        return data.items;
    }

    async getTopTracks() {
        console.log('Fetching top tracks...');
        const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=5', {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch top tracks');
        }

        const data = await response.json();
        return data.items;
    }

    async getRecommendedTracks(artistId, trackId) {
        console.log('Getting recommendations...');
        const response = await fetch(`https://api.spotify.com/v1/recommendations?seed_artists=${artistId}&seed_tracks=${trackId}&limit=10`, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get recommendations');
        }

        const data = await response.json();
        return data.tracks;
    }

    async findPlaylists(tracks) {
        console.log('Finding playlists...');
        const playlists = new Set();

        for (const track of tracks.slice(0, 5)) {
            const query = `${track.name} ${track.artists[0].name}`;
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=5`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                }
            );

            if (!response.ok) continue;

            const data = await response.json();
            data.playlists.items.forEach(playlist => {
                if (playlist.tracks.total >= 20) {
                    playlists.add(playlist);
                }
            });
        }

        return Array.from(playlists);
    }

    displayPlaylists(playlists) {
        const container = document.getElementById('playlists-container');
        
        if (playlists.length === 0) {
            container.innerHTML = '<p>No playlists found. Try again!</p>';
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

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing app...');
    new SpotifyPlaylistDiscovery();
});
