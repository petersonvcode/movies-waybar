#!/bin/bash

CONFIG_FOLDER="$(realpath ~/.config/movies-cwb-ags-bar)"
mkdir -p "${CONFIG_FOLDER}"

echo "Configuration folder: ${CONFIG_FOLDER}"

get_config() {
  jq -c . "${CONFIG_FOLDER}/config.json"
}

init_default_config() {
  echo "Initializing default configuration..."
  cat > "${CONFIG_FOLDER}/config.json" <<EOF
{
  "dbFile": "${CONFIG_FOLDER}/movies.db",
  "barTopMargin": 30,
  "barRightMargin": 128,
  "barPollInterval": 30
}
EOF
}