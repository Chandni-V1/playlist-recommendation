async getRecommendedTracks(seedArtists, seedTracks) {
    console.log('Getting recommendations with seeds:', {
        artists: seedArtists.map(a => a.id),
        tracks: seedTracks.map(t => t.id)
    });

    let baseUrl = 'https://api.spotify.com/v1/recommendations';
    const params = new URLSearchParams({
        limit: 20
    });

    // Only add the first artist and track as seeds
    if (seedArtists.length > 0) {
        params.append('seed_artists', seedArtists[0].id);
    }
    if (seedTracks.length > 0) {
        params.append('seed_tracks', seedTracks[0].id);
    }

    const url = `${baseUrl}?${params.toString()}`;
    console.log('Recommendations URL:', url);

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('Recommendations API error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.tracks || [];
}
