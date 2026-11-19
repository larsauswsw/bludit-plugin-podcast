# Changelog

All notable changes to the Podcast plugin for Bludit are documented in this
file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the plugin uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-11-19

### Added

- Setting "Max. episodes in the feed" in the channel settings: only the newest
  episodes appear in the feed, older ones stay on the website.
- Optional download statistics: with "Count downloads" turned on in the
  channel settings, feed and player link to a counting address of the site
  that redirects to the audio file. The new page **Podcast → Statistics**
  shows the downloads of a chosen period (30 days, 90 days, 12 months, all
  time) with a chart and broken down by app, platform and source (feed or
  website player), the subscribers that services such as Feedly or Overcast
  report when fetching the feed, and the downloads of each episode in the
  first day, week, 4 weeks and 3 months and in total, with a page per
  episode. Counted on your own server, similar to the IAB Podcast
  Measurement Guidelines (one download per episode, IP address and app per
  day; known bots, `HEAD` and test requests of podcast apps do not count);
  not certified. No cookies, no IP addresses stored (only a hash with a key
  that is deleted after the day), raw log kept for 90 days, then only daily
  sums per user agent.

### Changed

- The feed is sent with `ETag` and `Last-Modified` and answers unchanged
  requests with `304 Not Modified`, so podcast apps download it only after a
  change. `lastBuildDate` is the time of the last change instead of the time
  of the request.

## [1.1.0] - 2026-11-15

### Added

- Feed check: the channel settings and the episode list show what is still
  missing before the feed can be submitted to Apple Podcasts or Spotify, e.g.
  no published episode yet, episodes without audio, a missing owner email,
  description, author or cover, with a link to the field.
- Audio files are uploaded in parts as soon as you choose them, with a
  progress bar and a button to cancel the upload; files that are never saved
  are deleted again. Large files now work with PHP's default upload limits, also on
  shared hosting; the plugin setting "Max. upload size" is the only limit.
  If the web server accepts only small requests, smaller parts are used
  automatically.
- The duration is read from the chosen audio file or URL and filled in; a
  different duration you entered is kept, with an option to apply the
  detected one.
- A new episode suggests the next episode number and the season of the latest
  episode. Saving warns if another episode in the same season already has the
  number.
- New page **Podcast → Media**: all uploaded files with preview, size, upload
  date and time and where they are used (channel cover, episodes, page content), the total
  size, and deleting of unused files one by one or several at once. Used files
  and files uploaded less than an hour ago are kept.
- Episodes can use a file that is already uploaded ("From media"), and the
  channel settings can take the cover from the media.
- Deleting an episode or replacing its file offers to delete the previous
  audio file or image, if nothing else uses it.

### Changed

- The duration is saved as `HH:MM:SS`, also when entered as `MM:SS` or in
  seconds.

## [1.0.0] - 2026-11-02

First public release.

### Added

- Episodes are regular Bludit pages with the tag `podcast`. Audio, duration,
  episode and season number, episode type, explicit flag and artwork are
  stored as Bludit custom fields, so episodes work with your theme, categories,
  tags and the Bludit editor.
- Admin page **Podcast** for admins and editors: create, edit and delete
  episodes in the look of the Bludit admin, also on phones. Drafts, scheduled,
  sticky and static episodes are supported; dates use the website's time zone.
- Audio (MP3, M4A, OGG, WAV) and episode artwork (JPG, PNG) by URL or upload.
  The upload limits of the server are shown and checked before uploading.
- Channel settings (admins only): title, description, author, language, cover
  (URL or upload, checked against Apple's requirements), copyright, Apple
  Podcasts category, podcast type (episodic or serial), explicit flag, owner
  email, feed lock, and links to the podcast on Apple Podcasts, Spotify,
  Pocket Casts, Deezer and Castbox.
- RSS feed with iTunes tags that passes Apple's checks: show notes as HTML,
  file size of external audio files, `podcast:guid` and `podcast:locked`
  (Podcasting 2.0), a feed discovery link on every page and an optional
  different feed URL, e.g. for a CDN.
- Podlove Web Player 5.13, served from your own server without a CDN, placed
  in the page content above or below the text or at `{{ podcast-player }}`,
  with a subscribe button for podcast apps and the services above. A simple
  HTML5 player is available as an alternative and as fallback.
- Admin interface in English and German (Germany, Austria, Switzerland),
  following the language of the Bludit site.
- Works with Bludit 3.19 to 3.22, also in a subdirectory, and PHP 8.0 or newer.

### Security

- Changes to episodes go through the Bludit admin area with its login, role
  and CSRF checks.
- Uploads are checked for size, file extension and content, stored with a
  random file name and in folders that do not run scripts.
- The file size of external audio files is only requested from public
  addresses, with a time limit.
- All output is escaped for its context; show notes in the feed are limited to
  a safe set of HTML tags.
