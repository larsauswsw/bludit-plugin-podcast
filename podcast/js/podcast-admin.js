/**
 * Podcast Plugin Admin UI
 * Handles: episode list ↔ form toggle, URL/file switching, AJAX save/delete
 */
(function () {
    'use strict';

    // ── Texte (Roadmap 014) ───────────────────────────────────────────
    // Vom Plugin in der Sitesprache übergeben (adminScript(), Schlüssel
    // „js-…“ aus languages/*.json); {name} wird durch vars.name ersetzt.
    var TEXTS = (typeof PODCAST_TEXTS === 'object' && PODCAST_TEXTS) || {};

    function t(key, vars) {
        var text = Object.prototype.hasOwnProperty.call(TEXTS, key) ? String(TEXTS[key]) : key;
        if (!vars) return text;
        return text.replace(/\{([a-z]+)\}/g, function (match, name) {
            return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
        });
    }

    // Bytes als MB mit höchstens einer Nachkommastelle, z. B. „0,5 MB“
    function formatMB(bytes) {
        return (bytes / 1048576).toFixed(1).replace(/\.0$/, '').replace('.', t('decimal-separator')) + ' MB';
    }

    // ── DOM refs ──────────────────────────────────────────────────────
    var list      = document.getElementById('podcast-episode-list');
    var form      = document.getElementById('podcast-episode-form');
    var formTitle = document.getElementById('podcast-form-title');
    var newBtn    = document.getElementById('podcast-new-btn');
    var saveBtn   = document.getElementById('podcast-save-btn');
    var cancelBtn = document.getElementById('podcast-cancel-btn');
    var saving    = document.getElementById('podcast-saving');
    var errorBox  = document.getElementById('podcast-save-error');

    var peKey       = document.getElementById('pe-key');
    var peTitle     = document.getElementById('pe-title');
    var peContent   = document.getElementById('pe-content');
    var peEpisode   = document.getElementById('pe-episode');
    var peSeason    = document.getElementById('pe-season');
    var peType      = document.getElementById('pe-type');
    var peExplicit  = document.getElementById('pe-explicit');
    var peDuration  = document.getElementById('pe-duration');
    var peDate      = document.getElementById('pe-date');
    var peStatus    = document.getElementById('pe-status');
    var peImageUrl  = document.getElementById('pe-image-url');
    var peImageFile = document.getElementById('pe-image-file');
    var peAudioUrl  = document.getElementById('pe-audio-url');
    var peAudioFile = document.getElementById('pe-audio-file');
    var peImageFileWrap = document.getElementById('pe-image-file-wrap');
    var peAudioFileWrap = document.getElementById('pe-audio-file-wrap');
    var peFormatHint    = document.getElementById('pe-audio-format-hint');
    var peImagePreview  = document.getElementById('pe-image-preview');
    var peAudioMedia    = document.getElementById('pe-audio-media');
    var peImageMedia    = document.getElementById('pe-image-media');
    var peAudioMediaWrap = document.getElementById('pe-audio-media-wrap');
    var peImageMediaWrap = document.getElementById('pe-image-media-wrap');
    var previewObjectUrl = null;
    var peDurationHint  = document.getElementById('pe-duration-hint');
    var peDurationText  = document.getElementById('pe-duration-hint-text');
    var peDurationApply = document.getElementById('pe-duration-apply');
    var peProgress      = document.getElementById('pe-upload-progress');
    var peProgressBar   = document.getElementById('pe-upload-progress-bar');
    var peProgressText  = document.getElementById('pe-upload-progress-text');
    var peUploadCancel  = document.getElementById('pe-upload-cancel');

    // ── Kanaleinstellungen: Cover hochladen (Roadmap 022) ─────────────
    // Lädt das Bild über die Episoden-API hoch (dort geprüft) und trägt die
    // Adresse in „Cover-URL“ ein; gespeichert wird mit Bludits „Speichern“.
    var coverFile = document.getElementById('podcast-cover-file');
    if (coverFile) {
        var coverUrl     = document.getElementById('podcast-cover');
        var coverStatus  = document.getElementById('podcast-cover-status');
        var coverPreview = document.getElementById('podcast-cover-preview');
        var setCoverStatus = function (text, isError) {
            coverStatus.textContent = text;
            coverStatus.classList.toggle('podcast-tip-error', !!isError);
        };
        coverFile.addEventListener('change', function () {
            var file = coverFile.files && coverFile.files[0];
            if (!file) return;
            var maxFile = parseInt(coverFile.dataset.maxFile, 10) || 0;
            if (maxFile && file.size > maxFile) {
                setCoverStatus(t('cover-too-large', { limit: formatMB(maxFile) }), true);
                coverFile.value = '';
                return;
            }
            var fd = new FormData();
            fd.append('tokenCSRF', (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''));
            fd.append('podcast_api_action', 'upload_cover');
            fd.append('cover_file', file);
            coverFile.disabled = true;
            setCoverStatus(t('cover-uploading'), false);
            fetch(coverFile.dataset.apiUrl, { method: 'POST', body: fd, credentials: 'same-origin' })
                .then(function (response) {
                    return response.json().catch(function () {
                        throw new Error(t('unexpected-response'));
                    });
                })
                .then(function (data) {
                    if (!data || data.error || !data.url) {
                        throw new Error(data && data.error ? data.error : t('error-upload-failed'));
                    }
                    coverUrl.value = data.url;
                    coverPreview.src = data.url;
                    coverPreview.hidden = false;
                    setCoverStatus(t('cover-uploaded'), false);
                })
                .catch(function (err) {
                    setCoverStatus(err && err.message ? err.message : t('network-error-upload'), true);
                })
                .then(function () {
                    coverFile.disabled = false;
                    coverFile.value = '';
                });
        });
    }

    // ── Dialog „Aus Mediathek wählen“ (Roadmap 025) ───────────────────
    // Die Liste kommt erst beim Öffnen vom Server (list_media); Suche nach
    // Name und Verwendung, Filter „unbenutzt“, je 50 Einträge. Daten nur als Text.
    var PICKER_PAGE = 50;
    var pickerEl = document.getElementById('podcast-media-picker');
    var openPicker = null;
    if (pickerEl) {
        var pickerSearch = document.getElementById('podcast-picker-search');
        var pickerUnused = document.getElementById('podcast-picker-unused');
        var pickerStatus = document.getElementById('podcast-picker-status');
        var pickerList   = document.getElementById('podcast-picker-list');
        var pickerMore   = document.getElementById('podcast-picker-more');
        var pickerTitle  = document.getElementById('podcast-picker-title');
        var picker = { files: [], limit: PICKER_PAGE, onPick: null, type: '', request: 0 };
        var jq = window.jQuery && window.jQuery.fn && window.jQuery.fn.modal ? window.jQuery : null;

        var showPicker = function (on) {
            if (jq) {
                jq(pickerEl).modal(on ? 'show' : 'hide');
                return;
            }
            // Ohne Bootstrap-Skript: einfach ein-/ausblenden
            pickerEl.style.display = on ? 'block' : 'none';
            pickerEl.classList.toggle('show', on);
        };

        var el = function (tag, className, text) {
            var node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
        };

        // Kleinbuchstaben, - _ . als Leerzeichen: „folge 7“ findet „folge-7-….mp3“
        var normalize = function (text) {
            return ' ' + String(text).toLowerCase().replace(/[-_.\s]+/g, ' ') + ' ';
        };

        var renderPicker = function () {
            var words = normalize(pickerSearch.value).trim().split(' ').filter(Boolean);
            var matches = picker.files.filter(function (file) {
                if (pickerUnused.checked && !file.unused) return false;
                var haystack = normalize(file.name + ' ' + file.uses.join(' '));
                return words.every(function (word) { return haystack.indexOf(word) !== -1; });
            });
            var shown = matches.slice(0, picker.limit);
            pickerList.textContent = '';
            shown.forEach(function (file) {
                var item = el('button', 'list-group-item list-group-item-action d-flex align-items-start text-left');
                item.type = 'button';
                if (picker.type === 'image') {
                    var img = el('img', 'podcast-media-thumb border rounded mr-2');
                    img.src = file.url;
                    img.alt = '';
                    img.loading = 'lazy';
                    item.appendChild(img);
                } else {
                    var icon = el('span', 'podcast-media-thumb podcast-media-icon border rounded mr-2');
                    icon.appendChild(el('span', 'fa fa-music'));
                    item.appendChild(icon);
                }
                var body = el('div', 'text-break');
                body.appendChild(el('div', '', file.name));
                body.appendChild(el('div', 'small text-muted', file.size + ' · ' + file.date));
                if (file.uses.length) {
                    body.appendChild(el('div', 'small', file.uses.join(' · ')));
                } else {
                    body.appendChild(el('span', 'badge badge-warning', t('picker-unused')));
                }
                if (file.problems) body.appendChild(el('div', 'small text-danger', file.problems));
                item.appendChild(body);
                item.addEventListener('click', function () {
                    var onPick = picker.onPick;
                    showPicker(false);
                    if (onPick) onPick(file);
                });
                pickerList.appendChild(item);
            });
            if (!matches.length) {
                pickerStatus.textContent = t('picker-none');
            } else if (shown.length < matches.length) {
                pickerStatus.textContent = t('picker-shown', { shown: shown.length, count: matches.length });
            } else {
                pickerStatus.textContent = t('picker-count', { count: matches.length });
            }
            pickerMore.hidden = shown.length >= matches.length;
        };

        pickerSearch.addEventListener('input', function () {
            picker.limit = PICKER_PAGE;
            renderPicker();
        });
        pickerUnused.addEventListener('change', function () {
            picker.limit = PICKER_PAGE;
            renderPicker();
        });
        pickerMore.addEventListener('click', function () {
            picker.limit += PICKER_PAGE;
            renderPicker();
        });
        if (jq) {
            // Suchfeld nur mit Maus fokussieren; am Handy ginge sonst gleich die Tastatur auf
            jq(pickerEl).on('shown.bs.modal', function () {
                if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) pickerSearch.focus();
            });
        }

        // type: 'audio' | 'image'; purpose 'cover' prüft Bilder auf Apples Vorgaben
        openPicker = function (type, purpose, onPick) {
            var request = ++picker.request;
            picker.type   = type;
            picker.onPick = onPick;
            picker.files  = [];
            picker.limit  = PICKER_PAGE;
            pickerSearch.value = '';
            pickerUnused.checked = false;
            pickerList.textContent = '';
            pickerMore.hidden = true;
            pickerTitle.textContent = purpose === 'cover' ? t('picker-title-cover')
                : (type === 'audio' ? t('picker-title-audio') : t('picker-title-image'));
            pickerStatus.textContent = t('picker-loading');
            showPicker(true);

            var body = new URLSearchParams({
                tokenCSRF:          (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''),
                podcast_api_action: 'list_media',
                type:               type,
                purpose:            purpose || ''
            });
            fetch(pickerEl.dataset.apiUrl, { method: 'POST', body: body, credentials: 'same-origin' })
                .then(readJson)
                .then(function (data) {
                    if (request !== picker.request) return;
                    if (data.error) throw new Error(String(data.error));
                    picker.files = Array.isArray(data.files) ? data.files : [];
                    renderPicker();
                })
                .catch(function (err) {
                    if (request !== picker.request) return;
                    pickerStatus.textContent = err && err.message ? err.message : t('unexpected-response');
                });
        };
    }

    // ── Kanaleinstellungen: Cover aus der Mediathek (Roadmap 025) ─────
    var coverMedia = document.getElementById('podcast-cover-media');
    if (coverMedia && openPicker) {
        coverMedia.addEventListener('click', function () {
            openPicker('image', 'cover', function (file) {
                var url     = document.getElementById('podcast-cover');
                var preview = document.getElementById('podcast-cover-preview');
                var status  = document.getElementById('podcast-cover-status');
                url.value = file.url;
                preview.src = file.url;
                preview.hidden = false;
                status.textContent = file.problems || t('cover-chosen');
                status.classList.toggle('podcast-tip-error', !!file.problems);
            });
        });
    }

    // Hinweis nach Neuladen der Seite (sessionStorage), Anzeige nur als Text
    var NOTICE_KEY = 'podcast-admin-notice';
    function showStoredNotice(container) {
        var text = null;
        try {
            text = window.sessionStorage.getItem(NOTICE_KEY);
            window.sessionStorage.removeItem(NOTICE_KEY);
        } catch (e) { /* Speicher nicht verfügbar */ }
        if (!text) return;
        var box = document.createElement('div');
        box.className = 'alert alert-warning mt-3';
        box.setAttribute('role', 'alert');
        box.textContent = text;
        container.insertBefore(box, container.firstChild);
    }

    function storeNotice(text) {
        try {
            window.sessionStorage.setItem(NOTICE_KEY, String(text));
        } catch (e) {
            window.alert(String(text));
        }
    }

    // ── Medien (Roadmap 025) ──────────────────────────────────────────
    var mediaPage = document.getElementById('podcast-media');
    if (mediaPage) {
        showStoredNotice(mediaPage);
        var onlyUnused = document.getElementById('podcast-media-unused');
        var typeFilter = document.getElementById('podcast-media-type');
        var selectAll  = document.getElementById('podcast-media-all');
        var deleteBtn  = document.getElementById('podcast-media-delete');
        var rows       = Array.prototype.slice.call(mediaPage.querySelectorAll('.podcast-media-row'));
        var visibleChecks = function () {
            return rows.filter(function (row) { return !row.hidden; })
                .map(function (row) { return row.querySelector('.podcast-media-check'); })
                .filter(function (box) { return box; });
        };
        var updateSelection = function () {
            var checks  = visibleChecks();
            var checked = checks.filter(function (box) { return box.checked; });
            deleteBtn.disabled = checked.length === 0;
            selectAll.checked = checks.length > 0 && checked.length === checks.length;
            selectAll.disabled = checks.length === 0;
        };
        var deleteMedia = function (refs, question) {
            if (!refs.length || !confirm(question)) return;
            var body = new URLSearchParams();
            body.append('tokenCSRF', (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''));
            body.append('podcast_api_action', 'delete_media');
            refs.forEach(function (ref) { body.append('files[]', ref); });
            fetch(PODCAST_API_URL, { method: 'POST', body: body, credentials: 'same-origin' })
                .then(readJson)
                .then(function (data) {
                    if (data.error) {
                        alert(t('error-message', { message: data.error }));
                        return;
                    }
                    if (data.notice) storeNotice(data.notice);
                    location.reload();
                })
                .catch(function (err) {
                    alert(err && err.isServerResponse ? err.message : t('network-error-delete'));
                });
        };

        // Filter nach Art (Audio/Bilder) und „nur unbenutzte“; ausgeblendete
        // Zeilen verlieren ihre Auswahl, damit nichts Unsichtbares gelöscht wird
        var applyFilter = function () {
            rows.forEach(function (row) {
                row.hidden = (onlyUnused.checked && row.dataset.unused !== '1') ||
                    (typeFilter.value !== '' && row.dataset.type !== typeFilter.value);
                if (row.hidden) {
                    var box = row.querySelector('.podcast-media-check');
                    if (box) box.checked = false;
                }
            });
            updateSelection();
        };

        if (onlyUnused) {
            onlyUnused.addEventListener('change', applyFilter);
            typeFilter.addEventListener('change', applyFilter);
            selectAll.addEventListener('change', function () {
                visibleChecks().forEach(function (box) { box.checked = selectAll.checked; });
                updateSelection();
            });
            mediaPage.addEventListener('change', function (e) {
                if (e.target.classList.contains('podcast-media-check')) updateSelection();
            });
            deleteBtn.addEventListener('click', function () {
                var refs = visibleChecks().filter(function (box) { return box.checked; })
                    .map(function (box) { return box.value; });
                deleteMedia(refs, t('media-confirm-delete', { count: refs.length }));
            });
            updateSelection();
        }
        mediaPage.addEventListener('click', function (e) {
            var link = e.target.closest('.podcast-media-delete-one');
            var row  = link && link.closest('.podcast-media-row');
            if (!row) return;
            e.preventDefault();
            deleteMedia([row.dataset.ref], t('media-confirm-delete-one', { name: row.dataset.name }));
        });
    }

    // ── Statistik (Roadmap 033) ───────────────────────────────────────
    // „Neu berechnen“: Summen aus dem Rohprotokoll neu bilden, dann neu laden
    var statsPage = document.getElementById('podcast-stats');
    if (statsPage) {
        showStoredNotice(statsPage);

        // Wert einer Säule beim Darüberfahren (Text aus data-tip, nur als Text);
        // dieselben Werte stehen in der Tabelle unter dem Diagramm
        var tooltip = document.createElement('div');
        tooltip.className = 'podcast-chart-tooltip';
        tooltip.hidden = true;
        document.body.appendChild(tooltip);
        statsPage.addEventListener('pointermove', function (e) {
            var col = e.target.closest ? e.target.closest('.podcast-chart-col') : null;
            if (!col) {
                tooltip.hidden = true;
                return;
            }
            tooltip.textContent = col.getAttribute('data-tip') || '';
            tooltip.hidden = false;
            var left = Math.min(e.clientX + 12, window.innerWidth - tooltip.offsetWidth - 8);
            tooltip.style.left = Math.max(8, left) + 'px';
            tooltip.style.top = Math.max(8, e.clientY - tooltip.offsetHeight - 12) + 'px';
        });
        statsPage.addEventListener('pointerleave', function () {
            tooltip.hidden = true;
        });

        var recalc = document.getElementById('podcast-stats-recalculate');
        recalc.addEventListener('click', function (e) {
            e.preventDefault();
            if (recalc.getAttribute('aria-disabled') === 'true') return;
            recalc.setAttribute('aria-disabled', 'true');
            var body = new URLSearchParams();
            body.append('tokenCSRF', (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''));
            body.append('podcast_api_action', 'stats_recalculate');
            fetch(PODCAST_API_URL, { method: 'POST', body: body, credentials: 'same-origin' })
                .then(readJson)
                .then(function (data) {
                    if (data.error) {
                        recalc.removeAttribute('aria-disabled');
                        alert(t('error-message', { message: data.error }));
                        return;
                    }
                    if (data.notice) storeNotice(data.notice);
                    location.reload();
                })
                .catch(function (err) {
                    recalc.removeAttribute('aria-disabled');
                    alert(err && err.isServerResponse ? err.message : t('network-error-stats'));
                });
        });
    }

    // Nur auf der Podcast-Seite aktiv
    if (!list) return;

    // Hinweis nach dem Speichern (z. B. Dateigröße nicht ermittelt)
    showStoredNotice(list);

    // ── helpers ───────────────────────────────────────────────────────

    function showForm(title) {
        formTitle.textContent = title;
        list.hidden     = true;
        form.hidden     = false;
        errorBox.hidden = true;
        window.scrollTo(0, 0);
    }

    function showList() {
        form.hidden = true;
        list.hidden = false;
    }

    // Zeigt im Upload-Feld den gewählten Dateinamen (nur als Text) oder den Platzhalter
    function updateFileLabel(input) {
        var label = document.querySelector('label[for="' + input.id + '"]');
        if (!label) return;
        label.textContent = input.files && input.files[0]
            ? input.files[0].name
            : (label.dataset.placeholder || '');
    }

    function pad2(n) {
        return (n < 10 ? '0' : '') + n;
    }

    // „Jetzt“ für das Datumsfeld (datetime-local) in der Zeitzone der Website:
    // so liest der Server das Datum. toISOString() wäre UTC. Ohne Intl oder
    // bei unbekannter Zeitzone gilt die Uhrzeit des Browsers.
    function nowForDateInput() {
        var now = new Date();
        var tz  = peDate.dataset.timezone;
        if (tz && window.Intl && Intl.DateTimeFormat.prototype.formatToParts) {
            try {
                var p = {};
                new Intl.DateTimeFormat('en-GB', {
                    timeZone: tz, hour12: false,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                }).formatToParts(now).forEach(function (part) { p[part.type] = part.value; });
                // Ältere Browser liefern um Mitternacht „24“
                var value = p.year + '-' + p.month + '-' + p.day + 'T' +
                    (p.hour === '24' ? '00' : p.hour) + ':' + p.minute;
                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
            } catch (e) { /* unbekannte Zeitzone */ }
        }
        return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) +
            'T' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    }

    // Gewählter Modus „url“, „file“ oder „media“ (Roadmap 025) für 'audio' bzw. 'image'
    function modeOf(kind) {
        var mode = document.querySelector('input[name="pe-' + kind + '-mode"]:checked');
        return mode ? mode.value : 'url';
    }

    // Adresse aus dem URL-Feld bzw. der Mediathek ('' beim Hochladen)
    function chosenUrl(kind) {
        var mode = modeOf(kind);
        if (mode === 'media') return (kind === 'audio' ? peAudioMedia : peImageMedia).value;
        if (mode === 'url') return (kind === 'audio' ? peAudioUrl : peImageUrl).value.trim();
        return '';
    }

    // Apple Podcasts spielt WAV/OGG nicht ab: Hinweis bei gewählter Datei oder URL
    function updateFormatHint() {
        if (!peFormatHint) return;
        var name;
        if (modeOf('audio') === 'file') {
            name = peAudioFile.files && peAudioFile.files[0] ? peAudioFile.files[0].name : '';
        } else {
            name = chosenUrl('audio').split(/[?#]/)[0];
        }
        peFormatHint.hidden = !/\.(wav|ogg|oga|opus)$/i.test(name.trim());
    }

    // Vorschau des Episodenbilds: gewählte Datei oder http(s)-Adresse
    function updateImagePreview() {
        if (!peImagePreview) return;
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
        var src  = '';
        if (modeOf('image') === 'file') {
            if (peImageFile.files && peImageFile.files[0] && window.URL && URL.createObjectURL) {
                previewObjectUrl = URL.createObjectURL(peImageFile.files[0]);
                src = previewObjectUrl;
            }
        } else if (/^https?:\/\/\S+$/i.test(chosenUrl('image'))) {
            src = chosenUrl('image');
        }
        if (src) {
            peImagePreview.src = src;
            peImagePreview.hidden = false;
        } else {
            peImagePreview.hidden = true;
            peImagePreview.removeAttribute('src');
        }
    }

    // ── Dauer aus der Audiodatei (Roadmap 021) ────────────────────────
    // Der Browser liest nur die Metadaten (Dauer) über ein <audio>-Element,
    // bei einer gewählten Datei lokal, bei einer URL vom fremden Server.
    var durationProbe = null;
    var durationAuto  = false; // Feldinhalt stammt aus der Erkennung
    var durationFound = '';

    function formatDuration(seconds) {
        var s = Math.round(seconds);
        return pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s % 3600 / 60)) + ':' + pad2(s % 60);
    }

    function stopDurationProbe() {
        if (!durationProbe) return;
        var probe = durationProbe;
        durationProbe = null;
        probe.removeAttribute('src');
        probe.load();
        if (probe.dataset.objectUrl) URL.revokeObjectURL(probe.dataset.objectUrl);
    }

    function hideDurationHint() {
        peDurationHint.hidden  = true;
        peDurationApply.hidden = true;
        durationFound = '';
    }

    function offerDuration(value) {
        var current = peDuration.value.trim();
        durationFound = value;
        peDurationHint.hidden = false;
        if (current === '' || durationAuto || current === value) {
            peDuration.value = value;
            durationAuto = true;
            peDurationText.textContent = t('duration-detected');
            peDurationApply.hidden = true;
        } else {
            peDurationText.textContent = t('duration-from-file', { duration: value });
            peDurationApply.hidden = false;
        }
    }

    function detectDuration() {
        stopDurationProbe();
        hideDurationHint();
        var src  = '';
        var objectUrl = '';
        if (modeOf('audio') === 'file') {
            if (peAudioFile.files && peAudioFile.files[0] && window.URL && URL.createObjectURL) {
                objectUrl = src = URL.createObjectURL(peAudioFile.files[0]);
            }
        } else if (/^https?:\/\/\S+$/i.test(chosenUrl('audio'))) {
            src = chosenUrl('audio');
        }
        if (!src) return;
        var audio = document.createElement('audio');
        audio.preload = 'metadata';
        if (objectUrl) audio.dataset.objectUrl = objectUrl;
        audio.addEventListener('loadedmetadata', function () {
            if (audio !== durationProbe) return;
            var seconds = audio.duration;
            stopDurationProbe();
            if (isFinite(seconds) && seconds > 0) offerDuration(formatDuration(seconds));
        });
        audio.addEventListener('error', function () {
            if (audio === durationProbe) stopDurationProbe();
        });
        durationProbe = audio;
        audio.src = src;
        // Safari (iOS) lädt Metadaten erst nach ausdrücklichem load()
        audio.load();
    }

    peDuration.addEventListener('input', function () {
        durationAuto = false;
        if (durationFound && peDuration.value.trim() !== durationFound) {
            peDurationText.textContent = t('duration-from-file', { duration: durationFound });
            peDurationApply.hidden = false;
        }
    });
    peDurationApply.addEventListener('click', function () {
        if (!durationFound) return;
        durationAuto = true;
        offerDuration(durationFound);
    });

    function clearForm() {
        resetAudioUpload();
        stopDurationProbe();
        hideDurationHint();
        durationAuto     = false;
        peKey.value      = '';
        peTitle.value    = '';
        peContent.value  = '';
        // Vorschlag für eine neue Episode (Roadmap 023); beim Bearbeiten
        // überschreibt die Zeile der Episode die Werte
        peEpisode.value  = form.dataset.nextEpisode || '';
        peSeason.value   = form.dataset.nextSeason || '';
        peType.value     = 'full';
        peExplicit.value = 'no';
        peDuration.value = '';
        peDate.value     = nowForDateInput();
        setStatus('published');
        peImageUrl.value = '';
        peAudioUrl.value = '';
        setMediaChoice('audio', '', '');
        setMediaChoice('image', '', '');
        delete form.dataset.audioOwn;
        delete form.dataset.imageOwn;
        delete form.dataset.oldAudio;
        delete form.dataset.oldImage;
        peImageFile.value = '';
        peAudioFile.value = '';
        updateFileLabel(peImageFile);
        updateFileLabel(peAudioFile);
        setMode('pe-audio-mode', 'url');
        setMode('pe-image-mode', 'url');
        updateFormatHint();
        updateImagePreview();
    }

    // Fixiert/statisch gibt es im Formular nur, wenn die Episode diesen Typ schon
    // hat (im Bludit-Editor gesetzt); dann als zusätzliche Option, damit er bleibt.
    var EXTRA_STATUS = { sticky: t('status-sticky'), static: t('status-static') };

    function setStatus(type) {
        var extra = peStatus.querySelector('option[data-extra]');
        if (extra) peStatus.removeChild(extra);
        if (Object.prototype.hasOwnProperty.call(EXTRA_STATUS, type)) {
            var opt = document.createElement('option');
            opt.value = type;
            opt.textContent = EXTRA_STATUS[type];
            opt.setAttribute('data-extra', '');
            peStatus.appendChild(opt);
        }
        // „Geplant“ = veröffentlicht mit Datum in der Zukunft (setzt Bludit)
        peStatus.value = type === 'draft' || Object.prototype.hasOwnProperty.call(EXTRA_STATUS, type) ? type : 'published';
    }

    function setMode(radioName, value) {
        var radios = document.querySelectorAll('input[name="' + radioName + '"]');
        radios.forEach(function (r) { r.checked = (r.value === value); });
        updateModeVisibility(radioName);
    }

    function updateModeVisibility(radioName) {
        var selected = document.querySelector('input[name="' + radioName + '"]:checked');
        if (!selected) return;
        var mode  = selected.value;
        var audio = radioName === 'pe-audio-mode';
        (audio ? peAudioUrl : peImageUrl).hidden           = mode !== 'url';
        (audio ? peAudioFileWrap : peImageFileWrap).hidden = mode !== 'file';
        (audio ? peAudioMediaWrap : peImageMediaWrap).hidden = mode !== 'media';
    }

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.hidden      = false;
    }

    function limitData(name) {
        var limitEl = document.getElementById('pe-upload-limit');
        return limitEl ? (parseInt(limitEl.dataset[name], 10) || 0) : 0;
    }

    // Fehlermeldung, wenn eine Datei zu groß ist. Audio geht in Stücken hoch
    // (nur das Limit des Plugins), das Bild mit dem Speichern (PHP-Limits).
    function checkUploadLimits(audio, image) {
        var maxAudio = limitData('maxAudio');
        var maxFile  = limitData('maxFile');
        var maxPost  = limitData('maxPost');
        if (audio && maxAudio && audio.size > maxAudio) {
            return t('file-too-large', { name: audio.name, size: formatMB(audio.size), limit: formatMB(maxAudio) });
        }
        var maxImage = maxFile && maxPost ? Math.min(maxFile, maxPost) : (maxFile || maxPost);
        if (image && maxImage && image.size > maxImage) {
            return t('file-too-large', { name: image.name, size: formatMB(image.size), limit: formatMB(maxImage) });
        }
        return '';
    }

    // Die API antwortet immer mit JSON. Alles andere kommt nicht vom Plugin:
    // - Umleitung zur Anmeldung: Bludit hat die Anfrage abgelehnt (Sitzung
    //   abgelaufen, Token ungültig)
    // - HTTP 413: Der Webserver selbst lehnt die Größe ab (vor PHP)
    // - sonstiger Fehlerstatus: z. B. PHP-Fehler (500)
    function responseError(status, url) {
        var msg;
        if (url && /\/login\/?$/.test(new URL(url, location.href).pathname)) {
            msg = t('session-expired');
        } else if (status === 413) {
            msg = t('request-too-large');
        } else if (status < 200 || status > 299) {
            msg = t('server-error', { status: status });
        } else {
            msg = t('unexpected-response');
        }
        var err = new Error(msg);
        err.isServerResponse = true;
        return err;
    }

    function readJson(response) {
        var type = response.headers.get('Content-Type') || '';
        if (type.indexOf('application/json') !== -1) {
            return response.json();
        }
        throw responseError(response.status, response.redirected ? response.url : '');
    }

    // ── Audio in Stücken hochladen (Roadmap 020) ──────────────────────
    // Startet gleich nach der Dateiauswahl; „Speichern“ wartet auf den
    // laufenden Upload. Jedes Stück passt unter die PHP-Limits des Servers;
    // der Server setzt die Datei zusammen und prüft sie am Ende wie einen
    // normalen Upload. Hochgeladene, nie gespeicherte Dateien werden wieder
    // gelöscht (andere Datei, URL statt Datei, Abbrechen, Seite verlassen).
    var MIN_CHUNK = 262144;
    var upload   = null; // laufender Upload: { file, id, xhr, cancelled, silent, chunkSize, promise }
    var uploaded = null; // hochgeladen, noch nicht gespeichert: { file, url }

    function uploadId() {
        var bytes = new Uint8Array(16);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        return Array.prototype.map.call(bytes, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    }

    function showProgress(done, total) {
        var percent = total ? Math.min(100, Math.floor(done * 100 / total)) : 0;
        peProgress.hidden = false;
        peProgressBar.parentNode.hidden = false;
        peUploadCancel.hidden = false;
        peProgressBar.style.width = percent + '%';
        peProgressBar.setAttribute('aria-valuenow', String(percent));
        peProgressText.classList.remove('text-danger');
        peProgressText.textContent = t('upload-progress', { done: formatMB(done), total: formatMB(total), percent: percent });
    }

    // Ergebnis des Uploads unter dem Audio-Feld (fertig oder Fehler)
    function showUploadStatus(text, isError) {
        peProgress.hidden = false;
        peUploadCancel.hidden = true;
        peProgressBar.parentNode.hidden = isError;
        if (!isError) {
            peProgressBar.style.width = '100%';
            peProgressBar.setAttribute('aria-valuenow', '100');
        }
        peProgressText.classList.toggle('text-danger', isError);
        peProgressText.textContent = text;
    }

    function hideProgress() {
        peProgress.hidden = true;
    }

    // Anfrage, auf deren Antwort niemand wartet (auch beim Verlassen der Seite)
    function apiBeacon(fields) {
        var fd = new FormData();
        fd.append('tokenCSRF', (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''));
        Object.keys(fields).forEach(function (name) { fd.append(name, fields[name]); });
        if (navigator.sendBeacon && navigator.sendBeacon(PODCAST_API_URL, fd)) return;
        fetch(PODCAST_API_URL, { method: 'POST', body: fd, credentials: 'same-origin', keepalive: true })
            .catch(function () {});
    }

    function cancelledError() {
        var err = new Error(t('upload-cancelled'));
        err.isCancel = true;
        return err;
    }

    function sendChunk(job, offset) {
        var file = job.file;
        var end  = Math.min(offset + job.chunkSize, file.size);
        return new Promise(function (resolve, reject) {
            var fd = new FormData();
            fd.append('tokenCSRF', (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''));
            fd.append('podcast_api_action', 'upload_chunk');
            fd.append('upload_id', job.id);
            fd.append('name', file.name);
            fd.append('offset', String(offset));
            fd.append('total', String(file.size));
            fd.append('chunk', file.slice(offset, end), file.name);

            var xhr = new XMLHttpRequest();
            job.xhr = xhr;
            xhr.open('POST', PODCAST_API_URL);
            xhr.upload.addEventListener('progress', function (e) {
                // e.loaded enthält auch die übrigen Felder der Anfrage
                if (!job.cancelled) showProgress(offset + Math.min(e.loaded, end - offset), file.size);
            });
            xhr.addEventListener('load', function () {
                var type = xhr.getResponseHeader('Content-Type') || '';
                // Webserver-Limit kleiner als das Stück (z. B. Nginx: 1 MB):
                // kleinere Stücke versuchen, der Server hat nichts gespeichert
                if (xhr.status === 413 && job.chunkSize > MIN_CHUNK) {
                    job.chunkSize = Math.max(MIN_CHUNK, Math.floor(job.chunkSize / 2));
                    resolve({ retry: true });
                    return;
                }
                if (type.indexOf('application/json') === -1) {
                    reject(responseError(xhr.status, xhr.responseURL !== PODCAST_API_URL ? xhr.responseURL : ''));
                    return;
                }
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(responseError(200, ''));
                }
            });
            xhr.addEventListener('error', function () { reject(new Error(t('network-error-upload'))); });
            xhr.addEventListener('abort', function () { reject(cancelledError()); });
            xhr.send(fd);
        }).then(function (data) {
            if (data && data.retry && !job.cancelled) return sendChunk(job, offset);
            if (!data || data.error) {
                var err = new Error(data && data.error ? String(data.error) : t('error-upload-failed'));
                err.isServerResponse = true;
                throw err;
            }
            if (data.url) return String(data.url);
            if (job.cancelled) throw cancelledError();
            return sendChunk(job, end);
        });
    }

    // Lädt die Datei hoch bzw. liefert den laufenden oder fertigen Upload derselben Datei
    function uploadAudio(file) {
        if (uploaded && uploaded.file === file) return Promise.resolve(uploaded.url);
        if (upload && upload.file === file) return upload.promise;
        cancelUpload(true);
        discardUploaded();
        var job = { file: file, id: uploadId(), xhr: null, cancelled: false, silent: false,
            chunkSize: limitData('chunkSize') || 1048576 };
        upload = job;
        showProgress(0, file.size);
        job.promise = sendChunk(job, 0).then(function (url) {
            if (job.cancelled) {
                // Erst nach dem Abbrechen fertig geworden
                apiBeacon({ podcast_api_action: 'discard_upload', url: url });
                throw cancelledError();
            }
            upload = null;
            uploaded = { file: file, url: url };
            showUploadStatus(t('upload-done'), false);
            return url;
        }, function (err) {
            if (upload === job) upload = null;
            if (!job.silent && upload === null) {
                showUploadStatus(err && err.message ? err.message : t('network-error-upload'), true);
            }
            throw err;
        });
        return job.promise;
    }

    // Bricht einen laufenden Upload ab; der Server verwirft die Teil-Datei.
    // silent: ohne Meldung (Datei gewechselt, Formular verlassen)
    function cancelUpload(silent) {
        if (!upload) return;
        var job = upload;
        upload = null;
        job.cancelled = true;
        job.silent = !!silent;
        if (job.xhr) job.xhr.abort();
        apiBeacon({ podcast_api_action: 'upload_cancel', upload_id: job.id });
    }

    // Löscht eine hochgeladene, nicht gespeicherte Datei wieder
    function discardUploaded() {
        if (!uploaded) return;
        apiBeacon({ podcast_api_action: 'discard_upload', url: uploaded.url });
        uploaded = null;
    }

    function resetAudioUpload() {
        cancelUpload(true);
        discardUploaded();
        hideProgress();
    }

    // Nach Auswahl einer Datei (oder Wechsel auf „Datei hochladen“) gleich hochladen
    function startAudioUpload() {
        var mode = document.querySelector('input[name="pe-audio-mode"]:checked');
        var file = peAudioFile.files && peAudioFile.files[0];
        if (!mode || mode.value !== 'file' || !file) {
            resetAudioUpload();
            return;
        }
        var limitMsg = checkUploadLimits(file, null);
        if (limitMsg) {
            resetAudioUpload();
            showUploadStatus(limitMsg, true);
            return;
        }
        uploadAudio(file).catch(function () { /* Meldung steht unter dem Feld */ });
    }

    peUploadCancel.addEventListener('click', function () { cancelUpload(false); });
    window.addEventListener('pagehide', function () {
        cancelUpload(true);
        discardUploaded();
    });

    function setSaving(on) {
        saveBtn.disabled = on;
        saving.hidden    = !on;
    }

    // ── radio toggle listeners ────────────────────────────────────────

    document.querySelectorAll('input[name="pe-audio-mode"], input[name="pe-image-mode"]')
        .forEach(function (r) {
            r.addEventListener('change', function () {
                updateModeVisibility(r.name);
                updateFormatHint();
                updateImagePreview();
                if (r.name === 'pe-audio-mode') {
                    detectDuration();
                    startAudioUpload();
                }
            });
        });

    [peImageFile, peAudioFile].forEach(function (input) {
        input.addEventListener('change', function () {
            updateFileLabel(input);
            updateFormatHint();
            updateImagePreview();
            if (input === peAudioFile) {
                detectDuration();
                startAudioUpload();
            }
        });
    });
    peAudioUrl.addEventListener('input', updateFormatHint);
    document.getElementById('pe-audio-media-btn').addEventListener('click', function () {
        if (!openPicker) return;
        openPicker('audio', '', function (file) {
            setMediaChoice('audio', file.url, file.name);
            updateFormatHint();
            detectDuration();
        });
    });
    document.getElementById('pe-image-media-btn').addEventListener('click', function () {
        if (!openPicker) return;
        openPicker('image', '', function (file) {
            setMediaChoice('image', file.url, file.name);
            updateImagePreview();
        });
    });
    peAudioUrl.addEventListener('change', detectDuration);
    peImageUrl.addEventListener('input', updateImagePreview);

    // ── new episode ───────────────────────────────────────────────────

    newBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearForm();
        showForm(t('new-episode'));
    });

    // ── cancel ────────────────────────────────────────────────────────

    cancelBtn.addEventListener('click', function () {
        resetAudioUpload();
        stopDurationProbe();
        setSaving(false);
        showList();
    });

    // ── edit ──────────────────────────────────────────────────────────

    // Gewählte Datei aus der Mediathek (Adresse im versteckten Feld, Name als Text)
    function setMediaChoice(kind, url, name) {
        (kind === 'audio' ? peAudioMedia : peImageMedia).value = url;
        document.getElementById('pe-' + kind + '-media-name').textContent = name;
    }

    // Datei aus dem eigenen Upload-Ordner: als Auswahl aus der Mediathek zeigen
    function selectFromMedia(kind, url) {
        var prefix = (kind === 'audio' ? peAudioMediaWrap : peImageMediaWrap).dataset.prefix || '';
        if (!url || !prefix || url.indexOf(prefix) !== 0 || url.slice(prefix.length).indexOf('/') !== -1) return;
        setMediaChoice(kind, url, url.slice(prefix.length));
        setMode('pe-' + kind + '-mode', 'media');
    }

    // Dateiname aus „audio/<name>“
    function refName(ref) {
        return String(ref).replace(/^[a-z]+\//, '');
    }

    // Daten der Episode stehen an der Tabellenzeile (Titel-Link und Menüeintrag)
    function episodeRow(btn) {
        return btn.closest('.podcast-episode-row');
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.podcast-edit-btn');
        var row = btn && episodeRow(btn);
        if (!row) return;
        e.preventDefault();
        var d = row.dataset;
        clearForm();
        peKey.value      = d.key      || '';
        peTitle.value    = d.title    || '';
        peContent.value  = d.content  || '';
        peEpisode.value  = d.episode  || '';
        peSeason.value   = d.season   || '';
        peType.value     = d.type     || 'full';
        peExplicit.value = d.explicit || 'no';
        peDuration.value = d.duration || '';
        peDate.value     = d.date     || nowForDateInput();
        setStatus(d.status || 'published');
        peImageUrl.value = d.image    || '';
        peAudioUrl.value = d.audioUrl || '';
        // Dateien dieser Website als Auswahl aus der Mediathek zeigen
        selectFromMedia('audio', d.audioUrl || '');
        selectFromMedia('image', d.image || '');
        // Für die Rückfrage beim Ersetzen (nur Dateien, die keine andere Seite nutzt)
        form.dataset.oldAudio = d.audioUrl || '';
        form.dataset.oldImage = d.image || '';
        form.dataset.audioOwn = d.audioOwn || '';
        form.dataset.imageOwn = d.imageOwn || '';
        // Gespeicherte Dateien stehen als URL im Feld; clearForm() hat den
        // Modus bereits auf „URL“ gesetzt
        updateFormatHint();
        updateImagePreview();
        showForm(t('edit-episode'));
    });

    // ── Ja/Nein-Frage ─────────────────────────────────────────────────
    // Für „Datei ebenfalls löschen?“: confirm() bietet nur „OK“/„Abbrechen“,
    // und „Abbrechen“ klingt nach Abbruch des Speicherns. Schließen = Nein.
    var askEl = document.getElementById('podcast-ask');

    function askYesNo(question) {
        var jq = window.jQuery && window.jQuery.fn && window.jQuery.fn.modal ? window.jQuery : null;
        if (!askEl || !jq) return Promise.resolve(confirm(question));
        return new Promise(function (resolve) {
            var yes    = false;
            var yesBtn = document.getElementById('podcast-ask-yes');
            var onYes  = function () {
                yes = true;
                jq(askEl).modal('hide');
            };
            document.getElementById('podcast-ask-text').textContent = question;
            yesBtn.addEventListener('click', onYes);
            jq(askEl).one('shown.bs.modal', function () {
                document.getElementById('podcast-ask-no').focus();
            });
            // Antwort erst nach dem Ausblenden: Bootstrap öffnet vorher keinen weiteren Dialog
            jq(askEl).one('hidden.bs.modal', function () {
                yesBtn.removeEventListener('click', onYes);
                resolve(yes);
            });
            jq(askEl).modal('show');
        });
    }

    // ── delete ────────────────────────────────────────────────────────

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.podcast-delete-btn');
        var row = btn && episodeRow(btn);
        if (!row) return;
        e.preventDefault();
        var title = row.dataset.title;
        var question = title ? t('confirm-delete', { title: title }) : t('confirm-delete-untitled');
        if (!confirm(question)) return;
        // Eigene Dateien, die sonst nirgends verwendet werden (Roadmap 025)
        var askFiles = row.dataset.audioOwn || row.dataset.imageOwn
            ? askYesNo(t('confirm-delete-files')) : Promise.resolve(false);

        askFiles.then(function (withFiles) {
            var body = new URLSearchParams({
                tokenCSRF:          (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''),
                podcast_api_action: 'delete_episode',
                episode_key:        row.dataset.key,
                delete_files:       withFiles ? '1' : '0'
            });
            return fetch(PODCAST_API_URL, { method: 'POST', body: body, credentials: 'same-origin' });
        })
            .then(readJson)
            .then(function (data) {
                if (data.error) {
                    alert(t('error-message', { message: data.error }));
                    return;
                }
                location.reload();
            })
            .catch(function (err) {
                alert(err && err.isServerResponse ? err.message : t('network-error-delete'));
            });
    });

    // ── save ──────────────────────────────────────────────────────────

    saveBtn.addEventListener('click', function () {
        var title     = peTitle.value.trim();
        var audioMode = document.querySelector('input[name="pe-audio-mode"]:checked').value;
        var imageMode = document.querySelector('input[name="pe-image-mode"]:checked').value;
        var audioUrl  = chosenUrl('audio');
        var audioFile = peAudioFile.files[0];

        if (!title) {
            showError(t('error-title'));
            return;
        }
        if (!peContent.value.trim()) {
            showError(t('error-description'));
            return;
        }
        if (audioMode === 'url' && !audioUrl) {
            showError(t('error-audio-url'));
            return;
        }
        if (audioMode === 'file' && !audioFile) {
            showError(t('error-audio-file'));
            return;
        }
        if (audioMode === 'media' && !audioUrl) {
            showError(t('error-audio-media'));
            return;
        }
        // Unvollständige Eingaben liefert das Feld als leeren Wert
        if (!peDate.value) {
            showError(t('error-date'));
            return;
        }

        // Upload-Limits vor dem Hochladen prüfen (Werte vom Server, 0 = unbegrenzt)
        var limitMsg = checkUploadLimits(audioMode === 'file' ? audioFile : null,
            imageMode === 'file' ? peImageFile.files[0] : null);
        if (limitMsg) {
            showError(limitMsg);
            return;
        }

        // Ersetzte eigene Dateien auf Wunsch löschen, wenn sie sonst nirgends
        // verwendet werden (Roadmap 025). Neue Datei/Adresse = ersetzt.
        var deleteReplaced = [];
        var newImage = imageMode === 'file' ? (peImageFile.files[0] ? '\u0000file' : '') : chosenUrl('image');
        var newAudio = audioMode === 'file' ? '\u0000file' : audioUrl;
        var asked = Promise.resolve();
        if (form.dataset.audioOwn && newAudio !== (form.dataset.oldAudio || '')) {
            asked = asked.then(function () {
                return askYesNo(t('confirm-delete-replaced-audio', { name: refName(form.dataset.audioOwn) }));
            }).then(function (yes) {
                if (yes) deleteReplaced.push('audio');
            });
        }
        if (form.dataset.imageOwn && newImage !== (form.dataset.oldImage || '')) {
            asked = asked.then(function () {
                return askYesNo(t('confirm-delete-replaced-image', { name: refName(form.dataset.imageOwn) }));
            }).then(function (yes) {
                if (yes) deleteReplaced.push('image');
            });
        }

        asked.then(function () {
            setSaving(true);
            errorBox.hidden = true;
            // Audiodatei zuerst in Stücken hochladen, dann die Episode mit ihrer URL speichern
            return audioMode === 'file' ? uploadAudio(audioFile) : audioUrl;
        }).then(function (finalAudioUrl) {
            var fd = new FormData();
            fd.append('tokenCSRF',          (typeof tokenCSRF !== 'undefined' ? tokenCSRF : ''));
            fd.append('podcast_api_action', 'save_episode');
            fd.append('key',       peKey.value);
            fd.append('title',     title);
            fd.append('content',   peContent.value.trim());
            fd.append('episode',   peEpisode.value);
            fd.append('season',    peSeason.value);
            fd.append('type',      peType.value);
            fd.append('explicit',  peExplicit.value);
            fd.append('duration',  peDuration.value.trim());
            fd.append('date',      peDate.value);
            fd.append('status',    peStatus.value);
            fd.append('image_url', imageMode === 'file' ? '' : chosenUrl('image'));
            fd.append('audio_url', finalAudioUrl);
            deleteReplaced.forEach(function (kind) { fd.append('delete_replaced[]', kind); });
            if (imageMode === 'file' && peImageFile.files[0]) {
                fd.append('image_file', peImageFile.files[0]);
            }
            return fetch(PODCAST_API_URL, { method: 'POST', body: fd, credentials: 'same-origin' });
        })
            .then(readJson)
            .then(function (data) {
                setSaving(false);
                if (data.error) {
                    showError(data.error);
                    return;
                }
                uploaded = null; // gehört jetzt zur Episode
                if (data.warning) storeNotice(data.warning);
                location.reload();
            })
            .catch(function (err) {
                setSaving(false);
                if (err && err.isCancel) {
                    showError(err.message);
                    return;
                }
                showError(err && (err.isServerResponse || err.message === t('network-error-upload'))
                    ? err.message : t('network-error-save'));
            });
    });

    // ── init visibility ───────────────────────────────────────────────

    updateModeVisibility('pe-audio-mode');
    updateModeVisibility('pe-image-mode');

}());
