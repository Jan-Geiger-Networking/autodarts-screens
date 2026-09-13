# Pausenscreen im Kino-Stil — Design

Stand: 13.09.2026. Mit dem Herausgeber im Brainstorming abgestimmt, Abschnitt
für Abschnitt freigegeben.

## 1. Ziel

Der Zuschauer-Screen soll in der Spielpause „richtig modern“ wirken, gebaut
mit Komponenten aus React Bits (reactbits.dev). Umgesetzt wird die Richtung
„Kino“: vollflächige Fotos mit langsamer Kamerafahrt, dunkle Verläufe,
Filmkorn und riesige Schrift, die aus der Unschärfe auftaucht. Wenige
Elemente, viel Wirkung.

## 2. Umfang

**Enthalten**

- **Vorspann:** läuft in `idle` ohne Matchtag. Er besteht aus 8 Service-Folien,
  dazwischen jeweils „Gleich geht's weiter“.
- **Matchtag-Folien:** laufen in `idle`, während ein Matchtag läuft. Dazu
  gehören der Kopf mit Ablauf und Statuszeile und alle Folien: Als Nächstes,
  Tabelle/Endstand, Spielplan, Zahlen des Abends, Spieleranalyse, Heatmap,
  Aufwärmrunde und Sieger.

**Nicht enthalten.** Live-Match, Start, Anfangsermittlung und Intro bleiben
unverändert, ebenso alle Einblendungen (180, Finish, Spielerwechsel, Miss,
Leg, Match) und die Statistikleiste. Sie bekommen den neuen Stil in einem
eigenen, späteren Schritt.

## 3. Getroffene Entscheidungen

| Frage | Entscheidung |
|---|---|
| Umfang | Nur der Pausenscreen: Vorspann **und** Matchtag-Folien |
| Stilrichtung | C · Kino (Entwürfe A Aurora & Glas und B Broadcast & Raster verworfen) |
| Bebilderung | Mischung: 3 Foto-Folien, 5 Folien auf bewegtem Verlauf |
| Matchtag-Anordnung | B · Titelsequenz: linksbündig, riesige Namen (A zentriert verworfen) |
| Technik | React Bits gezielt: Grainient, BlurText, CountUp, Noise sowie `motion` und `ogl` |
| Sieger-Folie | Strahlen und Konfetti entfallen, das Licht übernimmt ihre Rolle |

Die frühere Projektentscheidung „nur CSS, keine Animations-Bibliothek“
(CHANGELOG 0.1.0-beta.2) wird **für den Pausenscreen** aufgehoben. Die neuen
Bibliotheken bringen zusammen weniger als 200 KB, der Installer hat 119 MB.

## 4. Gemeinsame Kino-Bühne

Vorspann und Matchtag teilen sich dieselbe Bühne (`KinoBuehne`).

- **Hintergrund:** Grainient (WebGL 2 über `ogl`). Ein sehr dunkler,
  langsam fließender Verlauf aus `--jg-bg` (#020617), einem gedämpften
  JGN-Grün und einem tiefen Petrol, mit feinem, bewegtem Korn. Darüber liegt
  eine Vignette zu den Rändern (CSS).
  - Die Zeichenfläche rechnet mit höchstens halber Auflösung. Grainient
    bekommt dafür einen Deckel für die Pixeldichte (Vorgabe `0.5`), das
    Original erlaubt bis `2`. Bei einem weichen, körnigen Verlauf fällt das
    nicht auf, spart auf 4K aber etwa drei Viertel der Last.
  - Die Bühne wird ausgehängt, sobald die Szene `idle` verlassen wird. Die
    WebGL-Fläche läuft dann nicht weiter.
  - Liefert der Rechner kein WebGL 2, steht ein ruhiger CSS-Verlauf in
    denselben Farben da. Es gibt keine Fehlermeldung und keinen leeren Schirm.
- **Feste Elemente:** Logo oben links (`assets/logo-white.png`). Oben rechts
  „● Spielpause“ ohne Kasten, als Punkt mit Puls und Schrift. Unten eine dünne
  grüne Fortschrittslinie über die Standzeit der aktuellen Folie.
- **Schrift:** Barlow Condensed (700/800) für alles Große, DM Sans für
  Unterzeilen und Fließtext. Beide Schriften liegen schon lokal.
- **Farbrollen:** Grün (`--jg-accent`) nur als Signal, also Striche, Kicker,
  Führende und erreichte Stationen. Weiß (`--jg-text`) trägt die Inhalte.
  Grau (`--jg-muted*`) steht für Nebensachen. Amber und Rot kommen im
  Pausenscreen nicht vor.
- **Bewegung:**
  - Texte tauchen aus der Unschärfe auf (BlurText). Zeilen erscheinen
    versetzt, beim Siegernamen Buchstabe für Buchstabe.
  - Zahlen zählen hoch (CountUp).
  - Folienwechsel sind weiche Überblendungen von etwa 1,5 s. Der Text der
    neuen Folie beginnt erst, wenn ihr Bild steht.
- **Reduzierte Bewegung** (`prefers-reduced-motion`):
  - Grainient steht still, ein einzelnes Standbild.
  - BlurText blendet ohne Unschärfe ein, CountUp zeigt sofort den Endwert.
  - Fotos fahren nicht. Die Überblendung zwischen den Folien bleibt, sie
    ändert nur die Deckkraft und bewegt nichts.

## 5. Vorspann

- **Inhalt unverändert:** Wortlaut, Reihenfolge, Unterzeilen, Partnerzeile
  und Kontaktzeile bleiben wörtlich wie in `Vorspann.tsx`. Der Wortlaut
  stammt aus der Anbieterkennzeichnung und darf nicht verändert werden. Die
  Standzeiten bleiben 6,5 s je Service-Folie und 2,4 s je Zwischenfolie.
- **Foto-Folien:** Netzwerkinfrastruktur mit `vorspann-patchpanel.jpg`,
  Glasfaser mit `vorspann-switch.jpg`, Hosting mit `vorspann-server.jpg`.
  - Das Foto füllt den ganzen Bildschirm und fährt während der Standzeit
    langsam heran (Skalierung etwa 1,02 → 1,12, CSS). Die Richtung wechselt
    von Folie zu Folie.
  - Links liegt ein dunkler Verlauf, unten ebenfalls. Das Filmkorn darüber
    kommt von Noise (Canvas), weil Grainient hier verdeckt ist.
  - Text unten links: grüner Strich, das Wort riesig, darunter die
    Unterzeile.
- **Verlauf-Folien:** Videoüberwachung, Monitoring, Backup, Support und
  Störungsannahme, Windows-Lizenzen.
  - Gleicher Textaufbau direkt auf Grainient.
  - Je Folie sitzt der Verlauf anders (Grainient-Props `centerX`, `centerY`
    und `blendAngle`), damit keine Folie wie die vorige aussieht.
  - Ein Foto lässt sich später je Folie über ein optionales Feld `bild`
    nachtragen.
- **Zwischenfolie „Gleich geht's weiter“:** nur Grainient, mittig riesig
  „Gleich geht's weiter“ aus der Unschärfe.
- **Fußzeile:** Partner links, Kontakt rechts (JetBrains Mono), beide klein
  und gedämpft. Sie steht dauerhaft und läuft nicht mit den Folien.
- **Vorführmodus:** `?vorfuehrung&folie=N` hält weiterhin Folie N fest
  (gerade = Service, ungerade = Zwischenfolie).

## 6. Matchtag als Titelsequenz

- **Kopf** (steht fest, läuft nicht mit):
  - Logo links.
  - Oben mittig der Ablauf als dünne Linie mit Stationen (Aufwärmen ·
    Hauptrunde · Entscheidung/Stechen). Erreichte Stationen und die Füllung
    sind grün, die Beschriftung winzig in Großbuchstaben.
  - Darunter die Statuszeile aus `statusText()`.
  - Rechts „● Spielpause“.
- **Titelblock** jeder Folie: oben links ein grüner Kicker (Matchtag-Name
  oder Thema), darunter der Folientitel groß in Weiß.
- **Folien** (Inhalt und Logik wie heute, nur neue Darstellung):
  - **Als Nächstes:** Kicker „Als Nächstes“, beim Stechen „Stechen um den
    Sieg“. Name A riesig, darunter klein „gegen“, darunter Name B riesig. Die
    beiden Namen erscheinen nacheinander. Rechts unten klein „Danach“ mit bis
    zu 3 Paarungen.
  - **Tabelle / Endstand:** linksbündige Tabelle mit den Spalten von heute
    (# · Spieler · Pkt · Sp · S · N · Legs · +/–). Die erste Zeile (in der
    Tabelle die Führung, im Endstand der Sieger) ist größer und hat einen
    grünen Strich links. Die Zeilen erscheinen versetzt nacheinander, ohne
    Kästen und Zebrastreifen.
  - **Spielplan:** Paarungen in zwei Spalten. Gespielte Partien sind gedimmt
    und zeigen das Ergebnis „3 : 1“, die nächste Partie hat einen grünen
    Strich.
  - **Zahlen des Abends:** 4 Werte (Bestes Average, Meiste 180er, Höchstes
    Finish, 180er gesamt) ohne Kacheln nebeneinander. Jeweils Titel klein,
    Zahl riesig und hochzählend, Name darunter. Darunter „Schnitt über alle
    Partien“ als Liste.
  - **Spieleranalyse:** die bestehende 11-Spalten-Tabelle im gleichen
    Tabellenstil, eine Stufe kleiner.
  - **Wo die Pfeile landen:** die Heatmap-Scheiben (`shared/Heatmap.tsx`,
    unverändert) in einer Reihe, darunter Name und Pfeilzahl.
  - **Aufwärmrunde:** „Aufwärmrunde“ riesig linksbündig, der Hinweis darunter.
  - **Sieger:**
    - Grainient wird für diese Folie heller und grüner (andere Farben und
      mehr Kontrast).
    - Kicker „‹Matchtag› entschieden“, der Name riesig, Buchstabe für
      Buchstabe aus der Unschärfe.
    - Die Werte zählen hoch, das Podest steht klein darunter.
    - Strahlen (`mt-strahlen`) und Konfetti (`mt-konfetti`) entfallen.
- **Standzeiten:** unverändert, 15 s je Folie, 20 s bei Als Nächstes,
  Analyse, Heatmap und Sieger. Die Überblendung ist dieselbe wie im Vorspann.
- **Vorführmodus:** `&matchtag`, `&mtfolie=N` und `&mtsieger` funktionieren
  weiter wie bisher.

## 7. Technik

### Dateien

| Datei | Änderung |
|---|---|
| `src/renderer/spectator/reactbits/Grainient.tsx` + `.css` | aus React Bits übernommen (TS-CSS), angepasst |
| `src/renderer/spectator/reactbits/BlurText.tsx` | übernommen, angepasst |
| `src/renderer/spectator/reactbits/CountUp.tsx` | übernommen, angepasst |
| `src/renderer/spectator/reactbits/Noise.tsx` + `.css` | übernommen |
| `src/renderer/spectator/reactbits/LICENSE.md` | Lizenztext MIT + Commons Clause mit Copyright David Haz |
| `src/renderer/spectator/KinoBuehne.tsx` | neu: Hintergrund, Vignette, Logo, Spielpause, Fortschrittslinie, WebGL-Ersatz |
| `src/renderer/spectator/kino.css` | neu: gesamtes Pausenscreen-CSS |
| `src/renderer/spectator/vorspannFolien.ts` | neu: Folienliste (Wortlaut, Standzeit, Foto-Schlüssel, Verlauf-Lage) ohne Bild-Importe, testbar |
| `src/renderer/spectator/vorspannFolien.test.ts` | neu: Wortlaut, Reihenfolge, Zwischenfolien, Foto-Zuordnung |
| `src/renderer/spectator/Vorspann.tsx` | Darstellung neu, ordnet Foto-Schlüssel den Bilddateien zu |
| `src/renderer/spectator/Matchtag.tsx` | Darstellung der Folien und des Kopfes neu, Logik unverändert |
| `src/renderer/spectator/Fortschritt.tsx` | wird zur dünnen Linie (Nutzung bleibt gleich) |
| `src/renderer/spectator/App.css` | Abschnitte Vorspann, Matchtag, Roadmap, Fortschrittsbalken, Analyse und Heatmap entfernen (≈ 900 Zeilen), sofern nur vom Pausenscreen genutzt |
| `package.json` | `motion`, `ogl` als Laufzeit-Abhängigkeiten |
| `THIRD-PARTY-LICENSES.md` | `motion`, `ogl` sowie Hinweis auf den React-Bits-Ordner |
| `docs/ENTSCHEIDUNGEN.md` | neuer Eintrag: Pausenscreen nutzt React Bits, „nur CSS“ gilt dort nicht mehr |
| `CHANGELOG.md` | Eintrag unter „Unveröffentlicht“ |

### Anpassungen am übernommenen Code (so wenig wie möglich)

- **Grainient:** neuer Prop `maxDpr` mit Vorgabe `0.5`, statt fest bis `2`.
  Bei reduzierter Bewegung `timeSpeed` und `grainAnimated` auf 0. Die Farben
  kommen als Props von der Bühne. Beim Aushängen den WebGL-Kontext
  freigeben, falls das Original das nicht schon tut (beim Übernehmen prüfen).
- **BlurText / CountUp:** Das Original startet erst, wenn das Element im
  sichtbaren Bereich ist (`useInView`). Auf dem festen Vollbild ist das sofort
  der Fall, es bleibt deshalb. Bei reduzierter Bewegung gibt es keine
  Unschärfe bzw. sofort den Endwert.
- **Kopf jeder Datei:** eine Herkunftszeile mit Quelle, Commit bzw. Datum
  und Lizenz.
- **Stil:** Tailwind wird nicht verwendet, nur die TS-CSS-Varianten.

### Lizenz

React Bits steht unter **MIT + Commons Clause**. Der Einbau in eine Anwendung
ist erlaubt, der Weiterverkauf oder die Weitergabe der Komponenten selbst
nicht. Das Repo ist MIT-lizenziert. Deshalb liegen die Komponenten in einem
eigenen Ordner mit eigener `LICENSE.md`, und `THIRD-PARTY-LICENSES.md` nennt
diese Ausnahme ausdrücklich. `motion` und `ogl` stehen unter MIT.

### Leistung

- Pixeldichte der WebGL-Fläche ≤ 0,5, `antialias: false`.
- Bei Matchbeginn und in jeder anderen Szene ist die Bühne ausgehängt.
- Das Original pausiert bereits bei verborgenem Fenster bzw. außerhalb des
  sichtbaren Bereichs, laut Kommentar „pause when offscreen / tab hidden“.

## 8. Tests und Prüfung

- **Bestehende Tests** müssen grün bleiben: 378 Tests, darunter
  `szene.test.ts`, `matchtagFolien.test.ts`, `statistik.test.ts` und
  `shared/matchtag.test.ts`.
- **Neuer Test** `vorspannFolien.test.ts`:
  - Die Folienliste enthält die 8 Leistungen in unveränderter Reihenfolge und
    im unveränderten Wortlaut, nach jeder die Zwischenfolie.
  - Genau Netzwerkinfrastruktur, Glasfaser und Hosting haben ein Foto.
  - Dafür wandert die Folienliste aus `Vorspann.tsx` in eine eigene
    `vorspannFolien.ts` ohne Bild-Importe. Die Bilder werden erst in
    `Vorspann.tsx` den Folien zugeordnet.
- **Sichtprüfung** per Screenshot im Vorführmodus (Vite ohne Electron):
  - alle 16 Vorspann-Folien (`?vorfuehrung&schritt=0&folie=0..15`)
  - alle Matchtag-Folien (`&mtfolie=0..5`) und Sieger/Endstand (`&mtsieger`)
  - die Aufwärmrunde. Der Vorführ-Matchtag ist schon in der Hauptrunde. Falls
    kein Parameter die Aufwärmphase erreicht, bekommt `vorfuehrung.ts` einen
    Parameter `&mtaufwaermen` mit einem Stand ohne gespielte Partie.
  - jeweils bei 1920×1080 und 3840×2160
- **Leistung:** auf 4K ein Performance-Trace über etwa 10 s Vorspann. Die
  Bildrate muss stabil bleiben, der Hauptthread darf nicht dauernd belegt
  sein.
- **Ersatz ohne WebGL:** WebGL im Test-Browser abschalten und prüfen, dass
  der CSS-Verlauf erscheint.

## 9. Offen für später

- Live-Match im Kino-Stil (eigener Schritt).
- Weitere Fotos je Service-Folie, sobald vorhanden. Dafür genügt das Feld
  `bild`.
