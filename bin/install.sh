#!/bin/bash

set -e

TMP_DIR=$(mktemp -d)
BIN_DIR=/usr/local/bin

is_arch() {
  [[ -f /etc/arch-release ]] || grep -q '^ID=arch' /etc/os-release 2>/dev/null
}

check_dependencies() {
  if ! is_arch; then
    echo "The widget was built for Arch Linux. Please install the dependencies manually."
    return 1
  fi

  pacman -Q aylurs-gtk-shell-git &>/dev/null
  if [ $? -ne 0 ]; then
    echo "The package aylurs-gtk-shell-git is not installed. Please install with: sudo pacman -Syu aylurs-gtk-shell-git"
    return 1
  fi

  return 0
}

download_files() {
  URL=https://github.com/petersonvcode/movies-cwb-ags/releases/download/latest/movies-cwb-arch-x64.zip
  curl -fsSL $URL -o ${TMP_DIR}/movies-cwb-arch-x64.zip || { echo "Failed to download files from $URL"; return 1; }
  unzip ${TMP_DIR}/movies-cwb-arch-x64.zip -d ${TMP_DIR}
  }

install() {
  sudo mv ${TMP_DIR}/movies-scrape ${BIN_DIR}/movies-scrape
  sudo mv ${TMP_DIR}/movies-fill ${BIN_DIR}/movies-fill
  sudo mv ${TMP_DIR}/display-movies-widget ${BIN_DIR}/display-movies-widget
  sudo mkdir -p /usr/share/movies-cwb-ags-bar
  sudo cp -r ${TMP_DIR}/icons /usr/share/movies-cwb-ags-bar/

  ${TMP_DIR}/bin/config.sh
  cp -r ${TMP_DIR}/bin ~/.config/movies-cwb-ags-bar/bin
}

check_dependencies
download_files
install