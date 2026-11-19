# Podcast Plugin for Bludit

A podcast plugin for [Bludit](https://www.bludit.com/) CMS. Manage episodes in the Bludit admin panel, publish an RSS feed with iTunes tags, and play episodes on your site with an embedded audio player — all without touching your theme files.

## Features

- **Episodes are Bludit pages** with the tag `podcast`; episode details are stored as Bludit custom fields, so episodes work with your theme, categories, tags and the Bludit editor
- **Episode management** — create, edit and delete episodes on a dedicated admin page that matches the Bludit admin look and works on phones
- **File upload or URL** — upload audio (MP3, M4A, OGG, WAV) and episode artwork (JPG, PNG) or link to external files; audio is uploaded in parts with a progress bar, so PHP's default upload limits are enough; uploads are checked for size, file type and content
- **Media** — see all uploaded files with size and usage, delete unused ones, reuse files in episodes and as channel cover
- **Less typing** — the duration is read from the audio file, and a new episode suggests the next episode and season number
- **RSS feed** with `<itunes:*>` tags for episode, season, type, duration, explicit and artwork
- **Embedded audio player** — [Podlove Web Player 5](https://podlove.org/podlove-web-player/), served from your own server (no CDN), placed inside the page content of every episode; a plain HTML5 player is available as an alternative and as fallback
- **Apple Podcasts ready** — category from Apple's list, podcast type, cover check (square, 1400–3000 px, RGB), show notes as HTML, file sizes of external audio, Podcasting 2.0 `podcast:guid` and `podcast:locked`
- **Subscribe button** in the player with podcast apps and your links on Apple Podcasts, Spotify, Pocket Casts, Deezer and Castbox
- **Download statistics** (optional) — counts downloads on your own server, similar to the IAB guidelines: per episode after 1 day, 1 week, 4 weeks and 3 months and in total, history chart, apps, platforms and source, subscribers reported by services such as Feedly; no cookies, no IP addresses stored, no third parties
- **Role-based access** — admins and editors can manage episodes; channel settings are admin-only
- **English and German** — the admin interface follows the language of your Bludit site
- Works with Bludit installed in a subdirectory

---

## Requirements

- **Bludit** 3.19 or newer (tested up to 3.22)
- **PHP** 8.0 or newer (required by Bludit 3.22) with the **fileinfo** extension (enabled by default; needed to check uploaded files)
- A web server with PHP support (Apache with mod_php or PHP-FPM, Nginx with PHP-FPM)

---

## Installation

### 1. Download the plugin

Download `podcast-<version>.zip` from the [releases page](https://github.com/larsauswsw/bludit-plugin-podcast/releases) and unzip it. It contains the `podcast` folder.

### 2. Copy to your Bludit installation

Copy the `podcast` folder into the `bl-plugins/` directory of your Bludit installation:

```
your-bludit/
└── bl-plugins/
    └── podcast/          ← place the folder here
        ├── plugin.php
        ├── metadata.json
        ├── js/
        └── ...
```

### 3. Activate the plugin

1. Log in to your Bludit admin panel.
2. Go to **Settings → Plugins** (German: *Einstellungen → Plugins*).
3. Find **Podcast** in the list and click **Activate** (*Aktivieren*).

### 4. Upload limits

**Audio files** are uploaded in parts of up to 5 MB, so PHP's default limits (`upload_max_filesize = 2M`, `post_max_size = 8M`) are enough, also on shared hosting. The upload starts as soon as you choose the file, with a progress bar and a button to cancel it; you can fill in the other fields meanwhile, and **Save** waits for the upload to finish. A file that was uploaded but never saved (you chose another file or cancelled the form) is deleted again. The only limit is the plugin setting **Max. upload size** (default 512 MB). While uploading, the parts are collected in `bl-content/workspaces/podcast/chunks/` (not reachable from the web); after the upload the file is checked and moved to the upload folder, cancelled or abandoned parts are removed (at the latest after 24 hours). If the web server accepts less than one part per request (Nginx: `client_max_body_size`, default 1 MB), the browser automatically switches to smaller parts.

**Images** (channel cover, episode artwork) are uploaded in one piece and are limited by PHP's `upload_max_filesize`. Apple's covers (up to 3000 × 3000 px) can be larger than 2 MB. To allow larger images, raise the limit in your **server configuration**, outside the Bludit directory, so the setting survives Bludit updates:

**Option A — Apache VirtualHost** (only with **mod_php**; with PHP-FPM Apache rejects `php_value` — use Option B). Check with `apache2ctl -M | grep -E "php|proxy_fcgi"`:

```apache
<VirtualHost *:80>
    # ... your existing config ...
    php_value upload_max_filesize 16M
    php_value post_max_size 20M
</VirtualHost>
```
Then reload Apache: `sudo systemctl reload apache2`

**Option B — PHP-FPM pool config** (e.g. `/etc/php/8.x/fpm/pool.d/www.conf`):
```ini
php_admin_value[upload_max_filesize] = 16M
php_admin_value[post_max_size] = 20M
```
Then restart PHP-FPM: `sudo systemctl restart php8.x-fpm`

**Option C — `.user.ini`** in your Bludit webroot (needs re-adding after Bludit updates):
```ini
upload_max_filesize = 16M
post_max_size = 20M
```

The episode form shows both limits below the audio field and checks the file sizes in the browser before uploading.

### 5. Upload folder protection

Uploaded files are stored in `bl-content/uploads/podcast/audio/` and `bl-content/uploads/podcast/images/`.

- Every upload is checked by extension **and** by its actual content (PHP `fileinfo`; images additionally via `getimagesize`). Allowed: MP3, M4A, OGG, WAV for audio; JPG, PNG for images. SVG and HTML are never accepted.
- File names get a random part (e.g. `episode-1-3f9c0a7b12de4e5f.mp3`), so files of unpublished episodes cannot be guessed. Files uploaded with earlier versions keep their names.
- The plugin places an `index.php` (no directory listing) and an `.htaccess` in each upload folder. On **Apache** the `.htaccess` blocks scripts and HTML/SVG files and sends `X-Content-Type-Options: nosniff`.
- On **Nginx**, `.htaccess` files are ignored. Add an equivalent rule to your server block:

```nginx
location ^~ /bl-content/uploads/podcast/ {
    add_header X-Content-Type-Options "nosniff" always;
    location ~* \.(?:php\d*|phtml|phar|pht|phps|pl|py|cgi|sh|shtml|html?|svgz?|xml)$ {
        deny all;
    }
}
```

(Adjust the path if Bludit runs in a subdirectory.)

### Updating the plugin

Download the new release and copy its `podcast` folder over the existing `bl-plugins/podcast/` folder. Episodes, settings and uploads are stored in `bl-content/`, not in the plugin folder, so they are kept. The changes of each version are listed in the [changelog](https://github.com/larsauswsw/bludit-plugin-podcast/blob/main/CHANGELOG.md).

---

## Channel Settings

The admin interface follows the language of your Bludit site: English or German (Germany, Austria, Switzerland); other languages show English. Names below are the English ones.

Before publishing episodes, configure your podcast channel: **Admin → Podcast → Channel settings** (admins only), or **Settings → Plugins → Podcast → Settings**.

The settings are grouped like Bludit's own settings pages.

At the top, a box lists what is still missing before you submit the feed to Apple Podcasts or Spotify: no episode in the feed yet (with scheduled episodes and drafts named), published episodes without audio, a missing or invalid owner email (Spotify sends its verification code there), a missing description, author or cover, or a cover that does not meet Apple's requirements. Each item links to the field. When everything is there, the box says the feed is ready to be submitted. The episode list shows the same hints above the episodes; editors only see the ones about episodes. These are hints only and never block saving.

| Group | Setting | Description | Example |
|---|---|---|---|
| **Podcast** | **Podcast title** | The name of your podcast | `My Podcast` |
| | **Description** | Short summary of your podcast | `A show about...` |
| | **Author** | Podcast author name | `Jane Doe` |
| | **Language** | RSS language code | `en-us`, `de-de` |
| | **Cover URL** | URL of your podcast artwork; Apple requires a square JPG/PNG in RGB with 1400–3000 px. Also used as the RSS `<image>`. A cover uploaded to this site is checked and the form names any problem | `https://example.com/cover.jpg` |
| | **Upload cover** | Upload a cover (admins only). It is checked before it is stored — not square, too small/large or CMYK is refused with a message — and entered as *Cover URL* with a preview; then click **Save** | – |
| | **Copyright** | Optional copyright notice (`<copyright>`) | `© 2026 Jane Doe` |
| **Apple Podcasts & directories** | **Category** | Apple Podcasts category with optional subcategory, chosen from Apple's list (in German with the English name added; the feed contains the English names, subcategory nested). A previous free-text entry is kept if it matches an Apple category | `Kids & Family → Parenting` |
| | **Podcast type** | `<itunes:type>`: episodic (newest first) or serial (in order, oldest first) | Episodic |
| | **Explicit** | Whether the podcast contains explicit content (`true`/`false` in the feed) | `No` |
| | **Lock feed against transfer** | `<podcast:locked>`: *Yes* means other platforms only take over the podcast after ownership is confirmed via the owner email. Set to *No* before moving to another host | `No` |
| | **Owner email** | Owner email (`itunes:owner`, `managingEditor`). Public in the feed; directories such as Apple Podcasts and Spotify use it to verify ownership | `jane@example.com` |
| | **Apple Podcasts**, **Spotify**, **Pocket Casts**, **Deezer**, **Castbox** | Optional: the podcast's public link on that service (in the app: *Share → Copy link*). Shown in the player's subscribe button. The Apple link also adds Castro and – if no own link is set – Pocket Casts | `https://podcasts.apple.com/us/podcast/my-podcast/id1234567890` |
| **Feed** | **Feed file name** | Path at which the RSS feed is served | `podcast.xml` |
| | **Feed address** | Read-only: the public feed URL to submit to Apple Podcasts, Spotify etc., with a link to open the feed | `https://example.com/podcast.xml` |
| | **Podcast GUID** | Read-only: permanent podcast ID (`<podcast:guid>`), generated once from the feed URL (UUIDv5 as defined by Podcasting 2.0) and kept when the feed moves | `5c3f1a80-…` |
| | **Different feed URL (optional)** | Only if the feed is served from another address (e.g. a CDN); leave empty to use the site address | `https://cdn.example.com/podcast.xml` |
| | **Website URL** | Your podcast website; leave empty for the Bludit site | `https://example.com` |
| | **Max. episodes in the feed** | Only the newest episodes appear in the feed; older ones stay on the website. Empty or 0 = all | `100` |
| **Statistics** | **Count downloads** | Off by default. When on, feed and player link to a counting address of this site that redirects to the audio file; see [Download statistics](#download-statistics) | `No` |
| **Website & player** | **Player on episode pages** | Podlove Web Player (served locally) or a simple HTML5 player | Podlove |
| | **Player position** | At the start of the page content (below the title) or at the end | start |
| **Uploads** | **Max. upload size (MB)** | Largest audio file; images are also limited by PHP's `upload_max_filesize` | `512` |

The feed URL is built from the Bludit site address and the feed filename (subdirectory installations included). URLs that do not start with `http://` or `https://` are not used; the form marks them. Every page of the site links to the feed in its `<head>` (`<link rel="alternate" type="application/rss+xml">`), so browsers and podcast apps can find it from the website address.

Click **Save** after making changes.

---

## Managing Episodes

Go to **Admin → Podcast** (microphone icon in the sidebar). The list shows all episodes, sorted by episode number (highest first), with badges for drafts (*Draft*), scheduled (*Scheduled*), sticky (*Sticky*) and static (*Static*) episodes. It works on phones as well.

### Creating a new episode

1. Click **New episode**.
2. Fill in the episode details:

| Field | Description |
|---|---|
| **Title** | Episode title (required) |
| **Description** | Show notes / episode description (required) |
| **Episode** | Episode number, used for `<itunes:episode>`. A new episode suggests the next number; saving warns if another episode in the same season has the number already |
| **Season** | Season, used for `<itunes:season>`. A new episode suggests the season of the latest numbered episode |
| **Type** | Full, Trailer or Bonus (`full`, `trailer`, `bonus` in the feed) |
| **Explicit** | Explicit flag for this episode |
| **Duration** | Filled in from the audio file or URL when the browser can read it (you can change it); also accepts `MM:SS` or total seconds, saved as `HH:MM:SS` |
| **Episode image** | External URL, file upload (JPG, PNG) or a file already uploaded (**From media**), with a preview; the player falls back to the channel cover. An uploaded image that does not meet Apple's cover rules is saved with a warning |
| **Audio** | External URL, file upload (MP3, M4A, OGG, WAV) or a file already uploaded (**From media**) — required. Apple Podcasts does not play WAV or OGG; the form shows a hint. For an external URL the plugin asks the server for the file size when saving (see below) |
| **Publication date** | Publication date and time, in the website's time zone |
| **Status** | *Published* or *Draft* |

3. Click **Save**. The episode appears in the list and, if published, on your site.

A published episode with a date in the future becomes *Scheduled* in Bludit and appears on the site and in the feed at that time. If you set an episode to *Sticky* or *Static* in the Bludit editor, the podcast form keeps that type.

### Editing an episode

Click the episode title, or open the **☰** menu of the episode and choose **Edit**. The same menu offers **View** and **Open in the Bludit editor**. Tags you add in the Bludit editor are kept when you save in the podcast form.

### Deleting an episode

Open the **☰** menu and choose **Delete**, then confirm. The episode disappears from your site and the feed. If its uploaded audio file or episode image is not used anywhere else, a second question offers to delete those files as well. Episodes that have child pages cannot be deleted from the plugin (like in Bludit's own content list).

When you replace the uploaded audio file or image of an episode, saving asks whether to delete the previous file, again only if nothing else uses it.

### Media

**Podcast → Media** lists all files in `bl-content/uploads/podcast/` with a preview for images, size, upload date and time and where each file is used: as channel cover, as audio or episode image of a page, or anywhere in the content of a page (also pages without the `podcast` tag, drafts and links with another domain). The total size is shown at the top.

- Files that are not used anywhere can be deleted one by one (☰ → **Delete**) or several at once (filter by **Audio only** / **Images only** and **Show only unused files**, select, **Delete selected**). Used files cannot be deleted; change the episode first.
- Files uploaded less than an hour ago are marked *Just uploaded* and cannot be deleted yet, because someone may be about to save an episode with them.
- The episode form (**From media → Choose a file …**) and the channel settings (**Cover from media**) let you reuse a file that is already uploaded. A dialog lists the files newest first with size, upload time and usage; search by file name or usage (e.g. an episode title), show only unused files, 50 at a time with **Show more**. For the cover, images that do not meet Apple's requirements are marked.
- Opening the page restores the protection files `index.php` and `.htaccess` of the upload folders if they are missing.

Use this page instead of deleting files on the server: deleting everything in the upload folder by shell also removes the protection files and breaks episodes that still use the files.

### Where episode data is stored

Episode metadata (audio URL, file size, duration, episode/season number, type, explicit flag, episode image) is stored as **Bludit custom fields** directly in each page (`podcast_audio_url`, `podcast_audio_length`, `podcast_duration`, `podcast_episode`, `podcast_season`, `podcast_type`, `podcast_explicit`, `podcast_image`). The plugin registers these fields automatically under **Settings → General → Custom fields**, labelled in the site language at that time; existing custom fields are left untouched.

- The data lives in `bl-content/` together with your pages, so it is included in normal Bludit backups, survives plugin updates and follows the page when its slug changes.
- The fields also appear in the Bludit editor under **Options → Custom** for every page. Pages only become episodes when they are tagged `podcast`; any user who can edit a page in Bludit can also edit these fields there. Bludit does not validate custom fields in its editor: invalid values (e.g. a duration like `47:99` or a non-`http(s)` URL) are saved there, but ignored by the feed and the player. The plugin's edit form shows the stored value and asks for a valid one when you save.
- Deactivating the plugin does **not** delete episode data.

---

## RSS Feed

The feed is served at the configured feed filename, e.g. `https://example.com/podcast.xml` (also when Bludit runs in a subdirectory).

The feed includes:
- Standard RSS 2.0 channel and item elements with `<itunes:*>` tags (episode, season, type, duration, explicit, artwork)
- Podcasting 2.0: `<podcast:guid>` and `<podcast:locked>` (namespace `xmlns:podcast`, as the PSP-1 standard requires)
- Apple Podcasts channel tags: category and subcategory from Apple's list, `<itunes:type>`, `<itunes:explicit>true|false</itunes:explicit>`, optional `<copyright>` and the RSS `<image>` from the cover
- `<enclosure>` tags with file size and MIME type for each episode
- Show notes: `<content:encoded>` with the episode text as HTML (paragraphs, lists, links, emphasis; scripts, styles, embeds and attributes are removed, links only `http(s)`/`mailto`), `<description>` with the text without tags (max. 4000 characters)

**File size of external audio URLs:** when an episode with an external audio URL is saved, the plugin requests the size from that server (`HEAD`, or a 1-byte `Range` request if `HEAD` is not supported). Only `http`/`https` on ports 80/443 to public addresses is requested; internal networks, redirects to them and more than three redirects are refused, the request is limited to 10 seconds. If the size cannot be determined, the episode is saved anyway with a hint above the list, and the feed shows `length="0"`. Uploaded files and unchanged URLs keep their stored size.
- All publicly visible episodes — published, sticky and static; drafts and scheduled episodes are excluded, as are episodes without audio
- Episodes sorted by date, newest first; with **Max. episodes in the feed** only the newest ones

**Caching:** podcast apps check the feed often. It is sent with `ETag` and `Last-Modified`; an app that asks with the version it already has gets `304 Not Modified` without content, so the full feed is only downloaded after a change. `<lastBuildDate>` is the time of the last change (new, edited or deleted episode, channel settings, a scheduled episode going live), not the time of the request. The plugin remembers it in `bl-content/workspaces/podcast/feed-state.php`.

**Download statistics:** with **Count downloads** turned on, each `<enclosure>` points to the counting address of the episode instead of the audio file, see [Download statistics](#download-statistics). Turning it on or off changes the feed (new `ETag`); single downloads do not.

**Submit your feed** to podcast directories, for example:
- [Apple Podcasts Connect](https://podcastsconnect.apple.com/)
- [Spotify for Creators](https://creators.spotify.com/)

---

## Frontend Player

The [Podlove Web Player](https://podlove.org/podlove-web-player/) is added to every episode page automatically — no changes to your theme are required. The plugin inserts it into the page content, so it appears wherever your theme prints the content: at the start (below the title, default) or at the end, see **Player position**. To place it anywhere else, write a line `{{ podcast-player }}` into the episode text; the player appears exactly there. The placeholder is removed on list pages and in the feed.

- **Served locally:** the plugin ships Podlove Web Player 5.13.0 in `bl-plugins/podcast/player/` (MIT license, unmodified subset of the npm package; provenance and checksums in `player/SOURCE.md`). Visitors' browsers do **not** connect to a Podlove CDN.
- **Fallback:** a plain HTML5 `<audio>` player with a download link is shown until the Podlove player has loaded, and stays visible if JavaScript is disabled or the player cannot load.
- **Simple HTML5 player:** choose *Player on episode pages → Simple HTML5 player* in the channel settings to skip the Podlove player entirely.
- The player shows a subscribe button for the podcast feed. It lists the services whose link is set in the channel settings (Apple Podcasts, Spotify, Pocket Casts, Castro, Deezer, Castbox), podcast apps that subscribe via the feed URL (Overcast, Downcast, AntennaPod, Podcast Addict and others, filtered by the visitor's platform), Player.fm and the plain RSS link.

### Privacy policy note

The player itself sends no data to third parties. The audio file is loaded from wherever its URL points when a visitor presses play (the HTML5 player uses `preload="none"`). If your audio files are hosted on another server (e.g. a podcast hoster or CDN), mention that host in your privacy policy. Example text (German):

> Auf Episodenseiten binden wir den Podlove Web Player ein, der von unserem eigenen Server ausgeliefert wird; dabei werden keine Daten an Dritte übertragen. Beim Abspielen wird die Audiodatei von [Anbieter / unser Server] geladen; dabei wird Ihre IP-Adresse an diesen Server übermittelt, soweit dies für die Auslieferung technisch erforderlich ist.

---

## Download statistics

Turn on **Channel settings → Statistics → Count downloads** to count how often your episodes are downloaded — on your own server, without an external service. The numbers are on **Podcast → Statistics**.

**How it works:** the feed and the player on episode pages no longer link to the audio file directly, but to a counting address of your site, for example `https://example.com/podcast-download/feed/<episode-id>/episode-1.mp3` (`feed` for podcast apps, `player` for the player and download link on the website). It counts the request and redirects (HTTP `302`) to the audio URL stored in the episode — an uploaded file or an external URL. The file is still delivered by your web server or host. The redirect always goes to the stored URL, never to an address from the request. Turning counting off restores the direct links; the counting addresses keep redirecting (apps may have cached the feed) but no longer count.

**What counts as a download** — similar to the [IAB Podcast Measurement Guidelines](https://iabtechlab.com/standards/podcast-measurement-guidelines/), not certified:

- one download per episode, IP address and user agent (app) per calendar day in the website's time zone; IPv6 addresses count per `/64` network, IPv4 addresses in full;
- `HEAD` requests, the test requests of podcast apps via the feed (`Range: bytes=0-0` and `bytes=0-1`) and requests without a user agent do not count, nor do bots from the [OPAWG lists](https://github.com/opawg/user-agents-v2) (bots and libraries marked as bots) and a small supplement for bots missing there (all shipped in `data/`, see `data/SOURCE.md`);
- the player on the website loads the audio only when a visitor presses play. Safari sends only such a test request to the counting address and loads the rest directly from the audio URL, so for the player it counts;
- only published episodes count (published, sticky, static), from their publication date; unknown episodes and drafts get `404`;
- only `REMOTE_ADDR` is used as IP address; `X-Forwarded-For` and similar headers can be forged and are ignored.

**How to read the numbers:** they are in the same range as the numbers of podcast hosts, usually a little higher, because a download counts when it starts — whether the app loads the whole file cannot be seen after the redirect. They do not show how many people listen: apps download new episodes automatically, also ones nobody plays, and platforms with their own copy of the file, such as Spotify, download it only once for everyone listening there.

**The statistics page** (**Podcast → Statistics**) shows, for the chosen period (30 days, 90 days, 12 months or all time):

- the downloads in the period and the subscribers reported by services (see below);
- a chart of the downloads per day (up to 90 days), per week from Monday (up to two years) or per month; hover a column for its value, or open **Show as table**;
- the downloads by **app**, **platform** (iPhone, Android, computer, smart speaker …) and **source** (podcast apps via the feed, or the player on the website), as recognized by the lists of the Open Podcast Analytics Working Group; browsers and programming libraries are marked as such, the ninth and further entries are combined as *Other*;
- every published episode with its downloads in the first 1, 7, 28 and 91 days from the day of publication (*1 day*, *1 week*, *4 weeks*, *3 months*, marked `*` while the period is running) and in total, independent of the period. The title opens the episode's own page with these numbers, a chart since publication and its apps, platforms and sources.

Today's numbers are live; earlier days are summed up once a day.

**Subscribers (reported):** some services, e.g. Feedly, Inoreader, NewsBlur or Overcast, name their number of subscribers in the user agent when they fetch the feed (`… 16 subscribers …`). The plugin keeps the highest number per service and day (no IP address, no hash) and shows each service's latest value of the last 30 days and their sum. Apple Podcasts, Spotify and most apps don't report a number, so the sum is a lower limit; the numbers cannot be verified.

**Storage and privacy** — everything stays in `bl-content/workspaces/podcast/stats/` (not reachable over HTTP; every file starts with Bludit's protection line):

- **No IP addresses** are stored. From the IP address, user agent and episode the plugin computes a hash (HMAC-SHA-256) with a random key of the day (`salt.php`). The key is deleted when the day is over, after that no hash can be traced back to an IP address — not in backups either.
- **Raw log** (`raw-YYYY-MM-DD.php`, one file per day): time, episode, source, requested range, user agent and the hash of each request. Completed days are compressed. Deleted after 90 days. At most 16 MB per day (about 50,000 requests); further requests that day are redirected but not counted, so a flood of requests cannot fill the disk.
- **Sums** (`sums-YYYY-MM.php`): downloads per day, episode, source and user agent (without time and without hash), kept permanently, so that newer lists of bots, apps and devices also apply to older days.
- **Reported subscribers** (`subs-YYYY-MM.php`): per day the service name and the highest number it reported, kept permanently; at most 50 services per day.
- Without cron (Bludit has none), completed days are summed up with the first download of a new day and when the statistics page is opened. **Recalculate** on the statistics page rebuilds the sums of all days whose raw log still exists, e.g. after a plugin update with changed rules.
- No cookies, no data to third parties, no location lookup.
- Deactivating the plugin in Bludit (**Settings → Plugins**) deletes its settings and workspace, including the statistics (episodes are kept).

### Privacy policy note for the download statistics

Example text (German), adapt it to your situation:

> **Reichweitenmessung des Podcasts.** Beim Abruf einer Podcast-Episode über unseren Feed oder den Player auf dieser Website zählen wir den Abruf auf unserem eigenen Server, um die Reichweite des Podcasts zu ermitteln (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO). Dazu wird Ihre IP-Adresse nur kurzzeitig verarbeitet: Aus ihr, der Kennung Ihrer Podcast-App bzw. Ihres Browsers (User-Agent) und der Episode wird mit einem täglich wechselnden Zufallsschlüssel ein Prüfwert (Hash) gebildet, der nur erkennt, ob dieselbe Episode am selben Tag mehrfach abgerufen wurde. Die IP-Adresse wird nicht gespeichert; der Schlüssel wird nach Ablauf des Tages gelöscht, danach ist kein Rückschluss auf die IP-Adresse mehr möglich. Gespeichert werden Zeitpunkt, Episode, Quelle (Feed oder Website), angeforderter Dateibereich, User-Agent und dieser Prüfwert; diese Einträge löschen wir nach 90 Tagen. Dauerhaft bleiben nur Summen je Tag, Episode, Quelle und User-Agent. Es werden keine Cookies gesetzt und keine Daten an Dritte weitergegeben.

The text covers the plugin's counting only. Like for every page of your site, your web server usually writes each request with the IP address to its access log, independently of the plugin; that belongs in the general part of your privacy policy (and the log's retention period in your server settings).

If your audio files are stored on another server (podcast host, CDN), the redirect makes the app load the file from there as before; mention that host as well (see the [privacy policy note](#privacy-policy-note) for the player).

---

## Troubleshooting

**"… file is larger than … MB" or "Upload too large: …" when saving**

An audio file exceeds the plugin setting **Max. upload size**, or an image exceeds PHP's `upload_max_filesize`. The episode form shows both limits below the audio field. See [Upload limits](#4-upload-limits) above.

**"The request is too large for the web server (HTTP 413)"**

The web server rejected an image upload before PHP saw it. Raise its limit as well (Apache `LimitRequestBody`, Nginx `client_max_body_size`). Audio uploads switch to smaller parts by themselves.

**"Session expired or security token invalid"**

Your Bludit session has expired. Log in again and repeat the action.

**"Server error (HTTP 500)"**

A PHP error occurred. Check the PHP error log and `bl-content/databases/syslog.php`.

**Feed is empty or missing episodes**

- Make sure your episodes are published (not *Draft*) and their date is not in the future.
- Check that the feed filename in the channel settings matches the URL you are accessing.
- Verify that the episode has audio — episodes without an audio URL are excluded from the feed.

**Statistics stay at 0**

- **Count downloads** must be on in the channel settings; the statistics page says so if it is off.
- Requests from bots, without user agent, `HEAD` requests and the test requests of apps do not count. Test with a podcast app or a browser, not with `curl`.
- The counting address is a normal Bludit address: on Apache Bludit's `.htaccess` must be active, on Nginx `try_files … /index.php` (as for every Bludit page). A `404` page of your web server instead of a redirect means the request did not reach Bludit.
- Check that `bl-content/workspaces/podcast/` is writable by the web server.

**Player does not appear on episode pages**

- The episode must have an `http(s)` audio URL in its custom field `podcast_audio_url`.
- The page must have the tag `podcast` (set automatically when you create episodes through the plugin; other tags may be added).
- Check the browser console for errors loading `bl-plugins/podcast/player/embed.js`; if it fails, the HTML5 fallback player is shown instead.

---

## License

The plugin is released under the [MIT License](LICENSE). The bundled Podlove Web Player in `player/` is MIT-licensed as well (see `player/LICENSE`), as are the OPAWG lists in `data/` (see `data/LICENSE`).
