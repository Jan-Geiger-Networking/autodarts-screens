# Fremdlizenzen

Der Installer verteilt Electron (mit Chromium und Node.js) sowie die in den
Bauergebnissen enthaltenen Produktionsabhängigkeiten. Damit entsteht die
Pflicht zur Namensnennung. Diese Liste wurde programmatisch erzeugt: aus
`package-lock.json` (nur Pakete mit `dev: false`, also tatsächlich
mitgelieferte Produktionsabhängigkeiten, nicht die Entwicklungswerkzeuge)
sowie aus den `package.json`- und Lizenzdateien der jeweiligen Pakete unter
`node_modules/`. Kein Lizenztext wurde hier neu abgeschrieben — für den
Volltext verweist jede Zeile auf die mitgelieferte Lizenzdatei des Pakets.

Schriftlizenzen stehen gesondert in
[assets/schriften/LICENSES.md](assets/schriften/LICENSES.md).

## Laufzeit

| Name | Version | Lizenz | Copyright | Lizenztext |
|---|---|---|---|---|
| Electron | 44.3.0 | MIT | Copyright (c) Electron contributors; Copyright (c) 2013-2020 GitHub Inc. | `node_modules/electron/LICENSE`; im installierten Programmordner als `LICENSE.electron.txt` |

Electron bringt Chromium und Node.js mit. Deren eigene Lizenzhinweise stellt
Electron selbst bereit und werden von electron-builder unverändert
mitverteilt: `node_modules/electron/dist/LICENSES.chromium.html`, im
installierten Programmordner als `LICENSES.chromium.html` neben der
ausführbaren Datei. Der Text ist umfangreich (mehrere zehntausend Zeilen) und
wird deshalb hier nicht reproduziert, sondern nur referenziert.

## Im Bauergebnis gebündelter Anwendungscode

Diese Pakete werden von Vite in die Renderer-Dateien unter `out/renderer/`
eingebettet (kein separates `node_modules` zur Laufzeit nötig, electron-builder
liefert die Pakete zusätzlich auch als Ordner mit, siehe unten):

| Name | Version | Lizenz | Copyright | Lizenztext |
|---|---|---|---|---|
| react | 19.3.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | `node_modules/react/LICENSE` |
| react-dom | 19.3.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | `node_modules/react-dom/LICENSE` |
| scheduler | 0.28.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | `node_modules/scheduler/LICENSE` |

`scheduler` ist keine direkte Abhängigkeit dieses Projekts, sondern eine
Laufzeitabhängigkeit von `react-dom` — sie landet über React im Bauergebnis
und wird deshalb mitgeführt.

## Methode und Grenzen

- Erfasst wurden alle Pakete aus `package-lock.json`, deren Eintrag nicht als
  `dev: true` markiert ist — das sind genau die Pakete, die auch ohne die
  Entwicklungswerkzeuge (TypeScript, Vite, Vitest, electron-builder,
  electron-vite, `@vitejs/plugin-react`, `@types/*`) gebraucht werden und mit
  ausgeliefert werden.
- Electron selbst steht in `package.json` aus technischen Gründen unter
  `devDependencies` (so macht es jedes Electron-Projekt), wird aber als
  Programmlaufzeit tatsächlich installiert und mitverteilt und ist deshalb
  hier trotzdem aufgeführt.
- Copyright-Zeilen wurden wörtlich aus der jeweiligen Lizenzdatei des Pakets
  übernommen. Wo ein Paket keine Copyright-Zeile in seiner Lizenzdatei oder
  seiner `package.json` führt, steht das hier ausdrücklich statt einer
  erfundenen Angabe — bei den oben gelisteten Paketen war das nicht der Fall.
- Diese Datei wird nicht automatisch bei jedem Release aktualisiert; sie ist
  von Hand aus den zum Zeitpunkt der Erstellung installierten Paketversionen
  erzeugt. Bei einer Änderung der Produktionsabhängigkeiten muss sie neu
  erzeugt werden.
