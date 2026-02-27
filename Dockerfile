# Build scrape and fill binaries
FROM node:24-trixie AS build

WORKDIR /app

COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .
COPY src/ ./src/

RUN npm install
RUN npm run build
RUN npm run pkg


# -----------------------------------------------------------------------------
# AGS bar built on Arch: use this so the widget runs correctly on Arch hosts
# (same lib paths and GTK/gjs versions as the host). Requires Astal + AGS from source.
# -----------------------------------------------------------------------------
FROM archlinux:latest AS ags-bar-arch

RUN pacman -Syu --noconfirm --needed \
    base-devel git meson ninja go vala valadoc \
    gobject-introspection gtk3 gtk-layer-shell gtk4 gtk4-layer-shell \
    wayland-protocols gjs \
    curl sassc

# Node 24 via nvm (Arch repos don't ship 24)
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" && nvm install 24 && nvm use 24 \
    && NODEVER=$(ls "$NVM_DIR/versions/node") && cp -r "$NVM_DIR/versions/node/$NODEVER" /opt/node24 \
    && ln -sf /opt/node24/bin/node /usr/local/bin/node \
    && ln -sf /opt/node24/bin/npm /usr/local/bin/npm \
    && ln -sf /opt/node24/bin/npx /usr/local/bin/npx
ENV PATH="/opt/node24/bin:${PATH}"

# Build and install Astal (required by AGS). gtk3/gtk4 need to find astal-io via pkg-config.
ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig
# So the linker finds libastal-io when building gtk3/gtk4 and when running ags
ENV LD_LIBRARY_PATH=/usr/local/lib

RUN git clone --depth 1 https://github.com/Aylur/astal.git /tmp/astal \
    && cd /tmp/astal/lib/astal/io && meson setup build && meson install -C build \
    && ldconfig \
    && cd /tmp/astal/lib/astal/gtk3 && meson setup build && meson install -C build \
    && cd /tmp/astal/lib/astal/gtk4 && meson setup build && meson install -C build \
    && rm -rf /tmp/astal

# Build and install AGS from source
RUN git clone --depth 1 https://github.com/Aylur/ags.git /tmp/ags \
    && cd /tmp/ags && npm install && meson setup build && meson install -C build \
    && rm -rf /tmp/ags

# Bundle uses sass; Arch has sassc (CLI). AGS may expect 'sass' - install via npm if needed.
RUN npm install -g sass

WORKDIR /app
COPY ags/icons/ ./icons/
COPY ags/widget/ ./widget/
COPY ags/app.ts .
COPY ags/package.json .
COPY ags/env.d.ts .
COPY ags/style.scss .
COPY ags/tsconfig.json .

RUN ags bundle app.ts display-movies-widget -d "SRC='/usr/share/movies-cwb-ags-bar'"

# Docker image to hold the binaries
FROM alpine AS binaries

RUN mkdir -p /binaries
COPY --from=build /app/dist/movies-scrape /binaries/movies-scrape
COPY --from=build /app/dist/movies-fill /binaries/movies-fill
COPY --from=ags-bar-arch /app/display-movies-widget /binaries/display-movies-widget
COPY --from=ags-bar-arch /app/icons /binaries/icons

# This is a dummy entrypoint to keep the container running
# while the binaries are being copied
# You can also use 'docker create <image>' to create the container without running it
ENTRYPOINT ["sh", "-c", "sleep infinity"]