# OPAWG-Listen (Download-Statistik)

Die Dateien `opawg-*.json` sind unveränderte Kopien der Listen der Open Podcast
Analytics Working Group (OPAWG). Die Download-Statistik des Plugins erkennt
damit, wer eine Episode abgerufen hat: Bots (zählen nicht), Apps,
Programmbibliotheken, Browser und Geräte.

| | |
|---|---|
| Projekt | [`opawg/user-agents-v2`](https://github.com/opawg/user-agents-v2) (Nachfolger von `opawg/user-agents`, das nicht mehr gepflegt wird) |
| Dateien | `build/<art>.runtime.json` (aus `src/<art>.json` erzeugt, nur Name, Muster und Kategorie) |
| Commit | `d6a4ffd48d9dc523ba4655736130cc38d32327d3` (2026-11-17) |
| Adresse | `https://raw.githubusercontent.com/opawg/user-agents-v2/d6a4ffd48d9dc523ba4655736130cc38d32327d3/build/<art>.runtime.json` |
| Lizenz | MIT, siehe [`LICENSE`](./LICENSE) (Open Podcast Analytics Working Group) |

| Datei | Inhalt | SHA-256 |
|---|---|---|
| `opawg-bots.json` | Bots, Crawler, Prüfdienste | `654a233a5b8e5748c139a5b84838ff8e2e06f99907fd86c2b23084b512bb7955` |
| `opawg-apps.json` | Podcast-Apps und Dienste | `1abdb85f69e3af07fb8ed830a441e958ff69788a7b250f93cb4ed1a6022adf75` |
| `opawg-libraries.json` | Programmbibliotheken; Kategorie `bot` = zählt als Bot | `6c83885ff6722bde165e9fe63381a00c5d3ac297d9c831127294d50ba3fcb2e6` |
| `opawg-browsers.json` | Browser | `5d108e79ce735ca94ebb7f589452316e394234090a1c88336c764f6befee1447` |
| `opawg-devices.json` | Geräte mit Kategorie (`mobile`, `computer`, `smart_speaker` …) | `df6e075f755e28811f1f151babe51c22a1ceab5958091c14b1bf7e9899cb33e5` |

Prüfen: `sha256sum opawg-*.json`.

## Verwendung

Wie in der OPAWG-Beschreibung (`statsClient()` im Plugin):

1. Die Listen Bots (mit der eigenen Ergänzung unten), Apps,
   Programmbibliotheken und Browser in dieser Reihenfolge durchgehen, in jeder
   Liste die Einträge der Reihe nach; der erste passende Eintrag gilt.
2. Bot ist, was in der Bot-Liste passt, eine Programmbibliothek der Kategorie
   `bot` ist oder keinen User-Agent hat. Bots zählen nicht.
3. Sonst bestimmt der erste passende Eintrag der Geräteliste die Plattform.

Muster sind reguläre Ausdrücke ohne Optionen (Groß-/Kleinschreibung zählt);
ein `~` im Muster wird maskiert, weil das Plugin `~` als Trennzeichen
verwendet. Gespeichert werden die Summen je User-Agent; ausgewertet wird beim
Anzeigen mit den aktuellen Listen. Neue Listen wirken daher auch auf ältere Tage.

## Eigene Ergänzung: `extra-bots.json`

Bots, die in der OPAWG-Liste fehlen, im selben Aufbau (`entries` mit `name`,
`pattern`, Beispielen und Quelle). Sie werden vor der OPAWG-Bot-Liste geprüft;
das Update-Skript ändert diese Datei nicht. Nur Muster aufnehmen, die eindeutig
einen Bot bezeichnen, mit einem Beispiel aus einem echten Protokoll, und
nach Möglichkeit auch bei OPAWG melden; ist er dort aufgenommen, den Eintrag
hier wieder entfernen.

| Eintrag | Seit | Anlass |
|---|---|---|
| `Amazonbot` | 2026-11-19 | `Amazonbot-Video/0.1` rief die Zähl-Adresse des Players ab und wurde gezählt; fehlt auch in der neuesten OPAWG-Liste (Stand 2026-11-17) |

## Aktualisieren

```sh
scripts/update-opawg-bots.sh <commit>
```

Das Skript lädt alle fünf Listen und die Lizenz aus dem angegebenen Commit,
prüft den Aufbau und übersetzt jedes Muster so wie das Plugin. Danach Commit,
Datum und Prüfsummen hier eintragen und den Diff prüfen (Sicherheitsregeln in
`CLAUDE.md`).
