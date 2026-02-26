import db, { type Database } from 'better-sqlite3'
import type { ScrappedMovie } from './scrapeMoviesList.js'
import type { MovieDetails } from './fillMovieDetails.js';
import { getConfig } from './config.js';

type ScrappedMovieRow = {
  id: string;
  scrapped_at: string;
  raw_origin_html: string;
  place: string;
  image_url: string;
  event_name: string;
  when: string;
  more_info_url: string;
  start_time: string;
  end_time: string;
  description: string;
}

let client: Database | null = null
const getClient = (): Database => {
  if (!client) {
    client = db(getConfig().dbFile)
    initializeDatabase(client)
  }
  return client
}

const initializeDatabase = (client: Database) => {
  console.log('Initializing database ...')

  client.pragma('foreign_keys = ON')
  client.pragma('synchronous = NORMAL')
  client.pragma('journal_size_limit = 1024000')
  client.pragma('journal_mode = WAL')
  client.pragma('journal_size_limit = 1024000')

  // Create movies table
  client.exec(`
    CREATE TABLE IF NOT EXISTS scraped_movies (
      id TEXT PRIMARY KEY,
      scrapped_at TEXT NOT NULL,
      raw_origin_html TEXT NOT NULL,
      place TEXT NOT NULL,
      image_url TEXT NOT NULL,
      event_name TEXT NOT NULL,
      "when" TEXT NOT NULL,
      more_info_url TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `)

  client.exec(`
    CREATE TABLE IF NOT EXISTS movie_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scraped_movie_id TEXT NOT NULL,
      title TEXT NOT NULL,
      director TEXT NOT NULL,
      year INTEGER NOT NULL,
      "group" TEXT NOT NULL,
      "when" TEXT NOT NULL,
      summary TEXT NOT NULL,
      image_url TEXT NOT NULL,
      more_info_url TEXT NOT NULL,
      FOREIGN KEY (scraped_movie_id) REFERENCES scraped_movies(id)
    )
  `)

  console.log('Database initialized !!')
}

export const insertMovies = (movies: ScrappedMovie[]) => {
  const client = getClient()
  const stmt = client.prepare(`
    INSERT OR REPLACE INTO scraped_movies (id, scrapped_at, raw_origin_html, place, image_url, event_name, "when", more_info_url, start_time, end_time, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const movie of movies) {
    stmt.run(movie.id, movie.scrappedAt, movie.rawOriginHTML, movie.place, movie.imageURL, movie.eventName, movie.when, movie.moreInfoURL, movie.startTime, movie.endTime, movie.description)
  }
}

export const getUnprocessedMovies = () => {
  const client = getClient()
  const stmt = client.prepare(`
    SELECT id, scrapped_at, raw_origin_html, place, image_url, event_name, "when", more_info_url, start_time, end_time, description FROM scraped_movies
    WHERE id NOT IN (SELECT scraped_movie_id FROM movie_details)
  `)

  const result: ScrappedMovie[] = (stmt.all() as ScrappedMovieRow[]).map(row => {
    return {
      id: row.id,
      scrappedAt: row.scrapped_at,
      rawOriginHTML: row.raw_origin_html,
      place: row.place,
      imageURL: row.image_url,
      eventName: row.event_name,
      when: row.when,
      moreInfoURL: row.more_info_url,
      startTime: row.start_time,
      endTime: row.end_time,
      description: row.description,
    }
  })

  return result
}

export const insertMovieDetails = (movieDetail: Omit<MovieDetails, 'id'>) => {
  const client = getClient()
  const stmt = client.prepare(`
    INSERT OR REPLACE INTO movie_details (scraped_movie_id, title, director, year, "group", "when", summary, image_url, more_info_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    movieDetail.scrapedMovieId,
    movieDetail.title,
    movieDetail.director,
    movieDetail.year,
    movieDetail.group,
    movieDetail.when,
    movieDetail.summary,
    movieDetail.imageURL,
    movieDetail.moreInfoURL
  )
  console.log(`Movie details inserted: ${movieDetail.title}`)
}
