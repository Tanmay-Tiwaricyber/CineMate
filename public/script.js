document.getElementById('searchButton').addEventListener('click', async () => {
    const query = document.getElementById('movieInput').value;
    if (!query) return;
  
    // Fetch the movie data from the server
    try {
      const response = await fetch(`/api/movies?query=${query}`);
      const data = await response.json();
  
      const { movie, recommendations } = data;
      const resultContainer = document.getElementById('resultContainer');
      resultContainer.innerHTML = ''; // Clear previous results
  
      // Display searched movie details
      if (movie) {
        const movieCard = document.createElement('div');
        movieCard.classList.add('movie-card');
  
        const banner = document.createElement('img');
        banner.classList.add('movie-banner');
        banner.src = movie.Poster !== "N/A" ? movie.Poster : "default-poster.jpg";
        movieCard.appendChild(banner);
  
        const details = document.createElement('div');
        details.classList.add('details');
        details.innerHTML = `
          <h2>${movie.Title} (${movie.Year})</h2>
          <div>${movie.Genre.split(', ').map(genre => `<span class="genre">${genre}</span>`).join('')}</div>
          <p><strong>Plot:</strong> ${movie.Plot}</p>
        `;
        movieCard.appendChild(details);
        resultContainer.appendChild(movieCard);
      }
  
      // Display recommendations by genre
      if (recommendations && recommendations.length) {
        const recommendationsHeader = document.createElement('h2');
        recommendationsHeader.textContent = `More ${movie.Genre.split(', ')[0]} Movies:`;
        resultContainer.appendChild(recommendationsHeader);
  
        recommendations.forEach(rec => {
          const recommendationCard = document.createElement('div');
          recommendationCard.classList.add('movie-card');
  
          const recBanner = document.createElement('img');
          recBanner.classList.add('movie-banner');
          recBanner.src = rec.Poster !== "N/A" ? rec.Poster : "default-poster.jpg";
          recommendationCard.appendChild(recBanner);
  
          const recDetails = document.createElement('div');
          recDetails.classList.add('details');
          recDetails.innerHTML = `
            <h2>${rec.Title} (${rec.Year})</h2>
            <div><span class="genre">${movie.Genre.split(', ')[0]}</span></div>
          `;
          recommendationCard.appendChild(recDetails);
          resultContainer.appendChild(recommendationCard);
        });
      }
    } catch (error) {
      console.error("Error fetching movie data:", error);
      document.getElementById('resultContainer').innerHTML = '<p>Error fetching movie data. Please try again later.</p>';
    }
  });
  