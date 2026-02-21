#!/bin/bash

sqlite3 movies.db ".mode json" "SELECT * FROM movie_details"