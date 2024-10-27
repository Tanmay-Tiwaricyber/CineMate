require('dotenv').config(); // Load environment variables
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OMDB_API_KEY = process.env.OMDB_API_KEY; // Access the API key

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint to search for a movie and get recommendations by genre
app.get('/api/movies', async (req, res) => {
  const { query } = req.query;

  try {
    // Fetch movie details by title
    const movieResponse = await axios.get(`http://www.omdbapi.com/`, {
      params: {
        apiKey: OMDB_API_KEY,
        t: query
      }
    });

    const movie = movieResponse.data;

    if (movie && movie.Genre) {
      const genres = movie.Genre.split(',').map(g => g.trim());

      // Fetch movies with the same genre (using the first genre as a filter)
      const genreResponse = await axios.get(`http://www.omdbapi.com/`, {
        params: {
          apiKey: OMDB_API_KEY,
          s: genres[0],
          type: 'movie'
        }
      });

      res.json({
        movie: movie,
        recommendations: genreResponse.data.Search || []
      });
    } else {
      res.status(404).json({ error: "Movie not found or no genre available" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch movie data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
