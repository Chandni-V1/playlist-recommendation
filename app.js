class SpotifyPlaylistDiscovery {
    // ... previous methods remain the same until getRecommendedTracks ...

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

    // ... rest of the methods remain the same ...
}
