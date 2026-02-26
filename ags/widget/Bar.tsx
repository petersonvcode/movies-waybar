import { execAsync, exec } from "ags/process"
import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { createComputed, createState, With } from "ags"
import Adw from "gi://Adw"
import Pango from "gi://Pango?version=1.0"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { getConfig } from "./config"

const goldenRatio = 1.61803398875
const width = 400
const height = width * goldenRatio
const titleHeight = 32

const projectPath = '/home/pet/Work/repos/movies-waybar'

export type MovieDetails = {
  id: string
  scraped_movie_id: string
  title: string
  director: string
  year: number
  group: string
  /** YYYY/MM/DD HH:MM 24 hours format string */
  when: string
  summary: string
  image_url: string
  more_info_url: string
  days_ahead_to_check: number
}

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const rawConfigPath = '~/.config/movies-cwb-ags-bar/config.json'
  const expandedPath = rawConfigPath.replace(/^~(?=\/|$)/, GLib.get_home_dir())
  const absoluteConfigPath = exec(['realpath', expandedPath])
  const config = getConfig(absoluteConfigPath)

  const rawMoviesJson = createPoll("", config.barPollInterval * 60 * 1000, `bash -c ". ${projectPath}/bin/get-waybar-content.sh"`)
  return (
    <window
      class="window"
      visible
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={Astal.WindowAnchor.RIGHT | Astal.WindowAnchor.TOP}
      marginTop={config.barTopMargin}
      marginRight={config.barRightMargin}
      application={app}
    >
      <With value={rawMoviesJson}>
        {(moviesJson) => {
          if (!moviesJson) return null
          const parsed = JSON.parse(moviesJson) as MovieDetails[]
          const daysRange = parsed?.[0]?.days_ahead_to_check ?? 0
          return (
            <box class="outer-box" orientation={Gtk.Orientation.VERTICAL} width_request={width} height_request={height}>
              <TopBox movieCount={parsed.length} daysRange={daysRange} />
              <Adw.ClampScrollable maximumSize={height} width_request={width} height_request={height} >
                <Gtk.ScrolledWindow vscrollbar_policy={Gtk.PolicyType.AUTOMATIC} hscrollbar_policy={Gtk.PolicyType.NEVER} >
                  <box orientation={Gtk.Orientation.VERTICAL} width_request={width}>
                    {parsed.map(movie => <MovieCard movie={movie} />)}
                  </box>
                </Gtk.ScrolledWindow>
              </Adw.ClampScrollable>
            </box>
          )
        }}
      </With>
    </window>
  )
}

const TopBox = ({ movieCount, daysRange }: { movieCount: number, daysRange: number }) => {
  return (
    <box class="top-box" orientation={Gtk.Orientation.HORIZONTAL} hexpand={true} height_request={titleHeight}>
      <label class="top-box-text" hexpand={true} label={`${movieCount} filmes nos próximos ${daysRange} dias`} />
      <CloseButton />
    </box>
  )
}

const CloseButton = () => {
  return (
    <button
      class="close-button"
      cursor={Gdk.Cursor.new_from_name('pointer', null)}
      onClicked={(btn?: Gtk.Widget) => {
        const root = btn?.get_root()
        if (root && root instanceof Gtk.Window) root.destroy()
        execAsync(['ags', 'quit'])
      }}
    >
      <image file={`${SRC}/icons/hicolor/scalable/actions/close-icon.svg`} pixelSize={23} />
    </button>
  )
}

const imagesPath = '/home/pet/Work/repos/movies-waybar/ags/.tmp/images'
const fallbackImage = imagesPath + '/fallback.png'

const getImagePath = (movie: MovieDetails) => {
  const imageExtension = movie.image_url.split('.').pop() ?? 'png'
  return `${imagesPath}/${movie.id}.${imageExtension}`
}

const MovieCard = ({ movie }: { movie: MovieDetails }) => {
  const leftSize = width * 0.68
  const rightSize = width * 0.32
  const cardHeight = (height - titleHeight) / 3

  const imagePath = getImagePath(movie)
  const saturation = 1.25
  const backgroundColor = createComputed(() => {
    const defaultBackgroundColor = '#5E2C70'
    const defaultTextColor = '#FFFFFF'
    let exists = true
    try {
      exec(['test', '-f', imagePath])
      exists = true
    } catch (e) {
      exists = false
    }
    if (!exists) return { backgroundColor: defaultBackgroundColor, textColor: defaultTextColor }
    try {
      const backgroundColorResult = exec([
        'bash', '-c',
        `magick "${imagePath}" -resize 50x50 -colorspace HSL -channel G -evaluate multiply ${saturation} -colorspace sRGB -format "#%[hex:p{25,25}]" info:`
      ]).trim()
      
      // Use imagemagick to determine an ideal text color (black/white) for contrast
      let textColor = defaultTextColor
      try {
        const textColorResult = exec([
          'bash', '-c',
          `magick identify -format "%[fx:(maxima.r*0.2126+maxima.g*0.7152+maxima.b*0.0722)>0.5?0:1]" xc:"${backgroundColorResult}"`
        ]).trim()
        if (textColorResult === "0")
          textColor = "#000000"
        else if (textColorResult === "1")
          textColor = "#FFFFFF"
      } catch (e) {
        console.error('error getting text color', imagePath, e)
        textColor = defaultTextColor
      }
      
      return { backgroundColor: backgroundColorResult, textColor: textColor }
    } catch (e) {
      console.error('error getting background color', imagePath, e)
      return { backgroundColor: defaultBackgroundColor, textColor: defaultTextColor }
    }
  })

  return (
    <With value={backgroundColor}>
      {({ backgroundColor, textColor }) => (
        <box
          class="movie-card"
          orientation={Gtk.Orientation.HORIZONTAL} width_request={width}
          height_request={cardHeight}
          css={`background-color: ${backgroundColor}; color: ${textColor};`}
        >
          <box orientation={Gtk.Orientation.VERTICAL} width_request={leftSize}>
            <label
              label={movie.title}
              max_width_chars={26}
              lines={2}
              ellipsize={Pango.EllipsizeMode.END}
              wrapMode={Gtk.WrapMode.WORD}
              halign={Gtk.Align.START}
              class="movie-title"
            />
            <label label={movie.director} halign={Gtk.Align.END} class="movie-director" />
            <label label={movie.when} halign={Gtk.Align.START} class="movie-when" />
            <label
              lines={2}
              max_width_chars={34}
              ellipsize={Pango.EllipsizeMode.END}
              wrapMode={Gtk.WrapMode.WORD}
              label={movie.group}
              halign={Gtk.Align.START}
              class="movie-group"
            />

            <box class="movie-synopsis" >
              <label
                lines={7}
                max_width_chars={49}
                ellipsize={Pango.EllipsizeMode.END}
                wrapMode={Gtk.WrapMode.WORD}
                label={movie.summary}
                halign={Gtk.Align.START}
              />
            </box>
            <button
              class="movie-more-info-button"
              cursor={Gdk.Cursor.new_from_name('pointer', null)}
              onClicked={() => execAsync(['xdg-open', movie.more_info_url])}
              halign={Gtk.Align.START}
            >
              <image file={`${SRC}/icons/hicolor/scalable/actions/info-icon.svg`} pixelSize={22} />
            </button>
          </box>
          <MovieImage movie={movie} cardHeight={cardHeight} rightSize={rightSize} />
        </box>
      )}
    </With>
  )
}

const MovieImage = ({ movie, cardHeight, rightSize }: { movie: MovieDetails, cardHeight: number, rightSize: number }) => {
  const imagePath = getImagePath(movie)
  const [isLoadingImage, setIsLoadingImage] = createState(false)
  const existingImage = createPoll("", 30 * 1000, `bash -c "test -f ${imagePath} && echo ${imagePath} || echo ${fallbackImage}"`)

  const url = createComputed(() => {
    if (existingImage() === fallbackImage && !isLoadingImage()) {
      console.log('loading image', movie.image_url)
      setIsLoadingImage(true)
      // Server requires full browser-like headers (CDN blocks minimal curl)
      execAsync([
        'curl', '-L', '-o', imagePath, movie.image_url,
        '-H', 'sec-ch-ua-platform: "Linux"',
        '-H', 'sec-fetch-dest: document',
        '-H', 'sec-fetch-mode: navigate',
        '-H', 'sec-fetch-site: none',
        '-H', 'sec-fetch-user: ?1',
        '-H', 'upgrade-insecure-requests: 1',
        '-H', 'user-agent: MeuPau/22.14 Chrome/666.1337.420.337',
      ]).then(() => console.log('image loaded', imagePath))
        .catch((err) => console.error('error loading image ' + imagePath, err))
      return fallbackImage
    } else if (existingImage() !== fallbackImage && existingImage() && !isLoadingImage()) {
      setIsLoadingImage(false)
      return existingImage()
    } else {
      return existingImage()
    }
  })

  return (
    <With value={url}>
      {(url) => (
        <box class="movie-image" height_request={cardHeight} width_request={rightSize}>
          <button class="no-padding rounded-corners" cursor={Gdk.Cursor.new_from_name('pointer', null)} onClicked={() => execAsync(['xdg-open', movie.more_info_url])}>
            <Gtk.Picture
              hexpand={true}
              vexpand={true}
              halign={Gtk.Align.FILL}
              valign={Gtk.Align.FILL}
              content_fit={Gtk.ContentFit.COVER}
              class="movie-image-icon rounded-corners"
              file={Gio.File.new_for_path(url)}
            >
            </Gtk.Picture>
          </button>
        </box>
      )}
    </With>
  )
}
