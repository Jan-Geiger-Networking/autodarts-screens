# Änderungen

Das Format folgt Keep a Changelog, die Versionierung folgt Semantic Versioning.

## [Unveröffentlicht]

## [0.1.0-beta.15] - 2026-09-11

Fünfzehnte Beta.

### Neu
- **Dartanimation im Standby des Player-Screens.** Läuft stumm in Schleife
  hinter „Warte auf Spielstart", mit sehr wenig Deckkraft und leicht
  unscharf: Stimmung, ohne den Blick zu binden. Ausschließlich im
  Ruhezustand — sobald ein Match beginnt, ist der Bildschirm ohnehin durch
  den Spielstand ersetzt. Wer Bewegung im System abgestellt hat, bekommt den
  Ruhezustand wie bisher ohne Video

## [0.1.0-beta.14] - 2026-09-11

Vierzehnte Beta. Turnierabend, Einblendungen auf dem Player-Screen und ein
Autostart, nach dem alles wieder so steht wie vorher.

### Neu
- **Matchtag.** Ein Turnierabend, an dem mehrere Leute jeder gegen jeden im
  Einzel spielen. Gestartet wird er im Control-Fenster; das nächste Match mit
  allen Teilnehmern zählt als Aufwärmrunde und legt Spielerliste und
  Spielplan fest — der Average daraus setzt die Reihenfolge. Jede gespielte
  Partie trägt sich danach von allein ein, ein Sieg gibt einen Punkt.
  Zugeordnet wird über die Spielernamen, weil Autodarts für jedes Match neue
  Spielerkennungen vergibt
- **Stechen bei Punktgleichheit.** Stehen am Ende mehrere an der Spitze,
  spielen genau diese es untereinander aus. Über den Turniersieg entscheidet
  kein Rechentrick, sondern die Scheibe
- **Matchtag-Pausenbildschirm.** Statt des Vorspanns laufen vier Folien: die
  Partie, die als nächstes einzurichten ist (zuerst und am längsten), die
  Tabelle, der Spielplan mit gespielten und offenen Partien, und die Zahlen
  des Abends — bestes Average, meiste 180er, höchstes Finish, Schnitt je
  Spieler. Kacheln ohne Grundlage fallen weg, statt eine Null zu zeigen
- **Kurze Einblendungen auf dem Player-Screen** für Spielerwechsel, 180,
  hohes Finish, gewonnenes Leg und gewonnenes Match. Sie sitzen über der
  Scheibe, nicht über den Spielertafeln: Restpunktzahl und Checkout-Weg
  bleiben lesbar. Deutlich kürzer als auf dem Zuschauer-Screen
- **Autostart.** Die Anwendung kann beim Anmelden am Rechner mitstarten und
  öffnet dann die Screens wieder, die beim letzten Beenden offen waren — auf
  denselben Monitoren
- **Monitore werden wiedererkannt.** Windows vergibt Monitorkennungen neu,
  sobald ein Bildschirm aus- und wieder eingeschaltet oder der Rechner neu
  gestartet wird. Gespeichert wird deshalb ein Steckbrief aus Anschluss,
  Auflösung und Skalierung. Ist ein Monitor noch aus, wartet die Anwendung
  und legt den Screen darauf, sobald er sich meldet; verrutscht ein Fenster,
  weil ein Fernseher zwischendurch ausging, wird es zurückgelegt

### Geändert
- Das Logo auf dem Player-Screen ist fast doppelt so groß und deutlich
  weniger durchscheinend — auf dem großen Bildschirm an der Scheibe war es
  kaum zu sehen
- `matchtag.json` wird von „Alle lokalen Daten löschen" mit entfernt.
  Datenschutzerklärung und README sind entsprechend ergänzt; beide nannten
  außerdem noch den alten Installernamen und behaupteten, es gebe keine
  Selbstaktualisierung

## [0.1.0-beta.13] - 2026-09-10

Dreizehnte Beta. Sie sucht die Daten für den Spielstart.

Der Anfang wird hier immer über die **Entfernung zum Bull** ermittelt, bei
ausgeschaltetem Bull-off von Autodarts. Dann läuft zu diesem Zeitpunkt gar
kein Match — und ohne Match gibt es keine Match-Ereignisse. Die Würfe können
also nur über den Brett-Kanal kommen, falls überhaupt. Diese Version
abonniert ihn vollständig und schreibt auf, was ankommt.

### Geändert
- Vom eigenen Brett werden jetzt **alle drei Themen** abonniert (`.matches`,
  `.state`, `.events`) statt nur `.matches`. Ereignisse außerhalb von
  `.matches` werden ausschließlich protokolliert — aus ihnen wird noch nichts
  abgeleitet, weil ihre Form unbelegt ist
- Das Rohprotokoll unterscheidet die Bauarten jetzt auch nach Thema. Vorher
  fielen alle Brett-Ereignisse in denselben Topf, und nur das allererste
  wurde vollständig festgehalten
- Das Diagnoseprotokoll meldet auch, **wenn** `bullDistance` auftaucht, nicht
  nur wenn es fehlt

### Behoben
- Einer Kennung aus einem Brett-Ereignis außerhalb von `.matches` wird nicht
  gefolgt: das ist die Kennung des **Bretts**, nicht die eines Matches. Ohne
  diese Sperre hätte das neue Abonnement die Anzeige abwürgen können

## [0.1.0-beta.12] - 2026-09-10

Zwölfte Beta. Die Auftreffpunkte sitzen jetzt dort, wo sie bei Autodarts
sitzen — nachgemessen, nicht geschätzt.

### Behoben
- **Die Punkte auf der Scheibe lagen 32 % zu weit außen.** Der Wert 1,0 der
  Autodarts-Koordinaten ist die Außenkante des Doppelrings; gerechnet wurde
  bisher, als läge sie bei 0,76. Ein Dart im inneren Einzelfeld erschien
  dadurch im Triple. Belegt an einem Bildschirmfoto der Autodarts-Anzeige
  (Ausgleich über Mittelpunkt, Maßstab und Drehung: Restfehler 0,03
  Bildpunkte, Drehung 0,00°) und an sechs echten Würfen, zu denen der Server
  den getroffenen Ring mitgeliefert hat — vorher lagen 3 von 6 im falschen
  Ring, jetzt 6 von 6 im richtigen
- **Ein beendetes Match konnte ein laufendes abschalten.** Autodarts räumt
  alte Matches nachträglich weg und meldet das auf dem Brett-Kanal. Die
  Anwendung folgte jeder gemeldeten Match-Kennung — auch der eines Matches,
  das gerade gelöscht wurde. Sie hing dann am falschen Match und bekam vom
  laufenden nichts mehr mit; im Protokoll stand danach nur noch „match not
  found". Jetzt wird einem Ende-Ereignis nicht mehr gefolgt, und es gilt nur
  noch für das Match, dem es tatsächlich zugeordnet ist
- **Die Checkout-Quote war doppelt falsch.** `checkouts` sind bei Autodarts
  die Finish*versuche*, `checkoutsHit` die getroffenen. Gelesen wurde
  `checkouts` als Treffer, die Versuche wurden daneben selbst gezählt

### Geändert
- Das höchste Finish wird wieder selbst mitgezählt: ein `highestFinish` gibt
  es in den Serverdaten nicht
- Das Diagnoseprotokoll meldet nicht mehr, dass `bullDistance` fehlt — das
  Feld gibt es nur während der Anfangsermittlung. Dafür steht jetzt jedes
  Brett-Ereignis mit Art und Match-Kennung darin, damit sich der Spielstart
  nachvollziehen lässt

## [0.1.0-beta.11] - 2026-09-10

Elfte Beta. Alle drei Pfeile stehen auf der Scheibe, und sie sind so klein wie
bei Autodarts.

### Behoben
- **Es wurde nur ein Pfeil angezeigt statt drei.** Sobald eine Aufnahme fertig
  ist, hängt Autodarts den nächsten, noch leeren Zug an die Liste. Die Scheibe
  war dadurch schlagartig leer, und was blieb, war ein einzelner Rest aus dem
  eigenen Verlauf. Jetzt gilt der Zug davor, solange der neue leer ist — es ist
  derselbe, den auch die Wurfleiste zeigt
- **Die Treffermarkierungen waren viel zu groß.** Autodarts zeichnet einen
  Punkt mit etwa einem Hundertstel des Scheibenradius, hier war er fünfmal so
  groß und deckte halbe Felder zu. Der Treffer saß richtig, sah aber falsch
  aus. Die Nummerierung im Punkt entfällt dafür
- **Der Leg-Average stand auf 0.0**, obwohl der Wert vorlag: die Anzeige
  rechnete weiter selbst, statt die Zahl des Servers zu nehmen. Betrifft
  Player- und Zuschauer-Screen

### Geprüft
- Die Umrechnung der Auftreffpunkte ist an drei echten Würfen nachgerechnet
  und als Test festgehalten: S16 landet im inneren Feld von Sektor 16, D19 im
  Doppelring von Sektor 19, T15 im Triple-Ring von Sektor 15 — jeweils aus den
  Koordinaten, die Autodarts für genau diese Würfe geliefert hat

## [0.1.0-beta.10] - 2026-09-10

Zehnte Beta. Die Statistik stimmt mit Autodarts überein, und die
Anfangsermittlung wird angezeigt.

### Behoben
- **Die Statistik hinkte eine Aufnahme hinterher.** Autodarts liefert sie
  selbst, nur eine Ebene tiefer als gesucht: `stats[i].matchStats.average`
  und `stats[i].legStats.average`, nicht `stats[i].average`. Jetzt gelten
  diese Zahlen; die eigene Rechnung bleibt Rückfall, falls einmal nichts
  kommt. Damit steht auf beiden Anzeigen dasselbe
- **Die Punkte lagen auf der Scheibe leicht falsch.** Die Ringmaße stammten
  aus den Millimetermaßen einer Turnierscheibe, die Auftreffpunkte aber von
  Autodarts — deren Scheibe hat etwas andere Verhältnisse. Ein Dart, der dort
  im Doppelring steckt, lag bei uns knapp darunter im einfachen Feld. Das
  Raster ist jetzt deren

### Hinzugefügt
- **Die Anfangsermittlung (Bull-off)** wird auf beiden Bildschirmen
  dargestellt: „Wer beginnt?", die Scheibe mit den geworfenen Bull-Darts und
  je Spieler der Abstand zum Bull. Wer näher liegt, ist hervorgehoben.
  Autodarts führt sie als eigene Variante `Bull-off`, den Abstand in
  `stats[i].legStats.bullDistance`
- Leg-Average und Leg-Darts kommen jetzt vom Server statt aus dem eigenen
  Mitzählen — sie stimmen damit auch, wenn die Anwendung erst mitten im Leg
  dazukommt
- Der Vorführmodus des Zuschauer-Screens hat einen Schritt für die
  Anfangsermittlung (`?vorfuehrung&schritt=12`)

## [0.1.0-beta.9] - 2026-09-10

Neunte Beta. Die Pfeile stehen auf der Scheibe — an der Stelle, an der sie
wirklich gelandet sind.

### Behoben
- **Die Wurfliste wurde falsch gelesen.** `turns` ist eine flache Liste der
  Züge eines Legs, der laufende Zug ist der **letzte** Eintrag — nicht der mit
  dem Index des Spielers. Belegt im Quelltext des Autodarts-Web-Clients, dort
  steht wörtlich `t.turns[t.turns.length-1]`. Solange danach mit dem
  Spielerindex gegriffen wurde, blieb die Liste in jedem echten Match leer:
  keine Pfeile auf der Scheibe, keine Feldnamen in der Wurfleiste, keine
  gezählten Darts

### Hinzugefügt
- **Der gemessene Auftreffpunkt jedes Darts.** Autodarts liefert ihn normiert
  mit; die Scheibe zeigt jetzt den echten Punkt statt der Feldmitte. Fehlt er
  (etwa bei einer von Hand eingetragenen Korrektur), bleibt es bei der
  Feldmitte
- Ein Wurf neben die Scheibe wird als „Miss" mit null Punkten geführt und an
  seiner gemessenen Stelle gezeigt
- **Standby-Bildschirm auf dem Player-Screen**: Logo, „Warte auf Spielstart"
  und langsam nach außen laufende Ringe — das Motiv der Scheibe selbst

### Geändert
- Das Segment eines Wurfs wird aus `number` und `bed` gelesen (`Single`,
  `SingleInner`, `SingleOuter`, `Double`, `Triple`, `Outside`) statt aus einem
  Namen. Der Name bleibt Rückfall, falls die Felder einmal fehlen

### Bekannte Einschränkungen
- Die Anzeige der Anfangsermittlung (Bull-off) fehlt weiterhin. Die Sonden aus
  0.1.0-beta.8 schreiben die dafür nötigen Feldnamen beim nächsten solchen
  Match ins Diagnoseprotokoll
- Autodarts liefert unter `state.checkoutGuides` einen eigenen
  Checkout-Vorschlag. Diese Anwendung rechnet ihn weiterhin selbst

## [0.1.0-beta.8] - 2026-09-10

Achte Beta. Die Statistik zählt endlich mit.

### Behoben
- **Alle Statistiken blieben auf 0** — gemeldet: „ich hatte 2 180er und er hat
  0 gezeigt". Die Ursache lag nicht bei der Statistik selbst: eine Aufnahme
  galt erst als abgeschlossen, wenn drei Darts in der Wurfliste standen. Diese
  Liste (`turns`) lässt sich in echten Matches nicht lesen — ihre Form ist bis
  heute unbelegt —, blieb also leer, und damit galt **keine einzige** Aufnahme
  je als fertig. Average, 180er, Checkout-Quote und der Leg-Verlauf blieben
  deshalb leer, und aus demselben Grund blieb die Dartscheibe ohne Pfeile.

  Der Abschluss einer Aufnahme wird jetzt daran erkannt, dass der nächste
  Spieler an der Reihe ist (oder das Leg endet). Dafür genügen zwei Felder,
  die aus einem echten Protokoll belegt sind: `player` und `turnScore`. Die
  Wurfliste wird dafür nicht mehr gebraucht
- Ein Finishversuch wurde gezählt, sobald der Rest **nach** der Aufnahme unter
  170 lag — eine Aufnahme von 501 auf 40 galt damit fälschlich als Versuch.
  Gezählt wird jetzt der Rest, mit dem die Aufnahme begonnen hat

### Geändert
- Der Übergang im Vorspann läuft langsamer: 2000 statt 1200 Millisekunden,
  jede Folie steht 6,5 statt 5 Sekunden, die Zwischenfolie 2,4 statt 1,8

### Hinzugefügt
- Drei gezielte Sonden im Diagnoseprotokoll: sobald `turns`, `stats` oder
  `state` in einem echten Match tatsächlich etwas enthalten, wird ihr Inhalt
  einmalig protokolliert. Das sind genau die drei Felder, deren innere Form
  bisher niemand kennt — an ihnen hängen die Pfeile auf der Scheibe, die
  Spielerstatistiken des Servers und die Anzeige der Anfangsermittlung

### Bekannte Einschränkungen
- **Die Pfeile auf der Dartscheibe fehlen weiterhin**, solange die Form von
  `turns` unbekannt ist. Die Statistik hängt nicht mehr daran, die Anzeige der
  einzelnen Treffer schon
- **Die Anfangsermittlung (Bull-off) wird nicht dargestellt.** Auch dafür
  fehlen die Feldnamen. Beides klärt ein einziges Diagnoseprotokoll aus einem
  Match mit dieser Version

## [0.1.0-beta.7] - 2026-09-10

Siebte Beta. Der Player-Screen ist nach dem Vorbild der Autodarts-Spielansicht
neu gebaut.

### Geändert
- **Player-Screen komplett neu**: links und rechts je eine Spielertafel,
  dazwischen die Dartscheibe mit den Treffern des laufenden Wurfs, darüber die
  drei Darts der Aufnahme mit ihrer Summe. Unter jeder Tafel steht der Verlauf
  des laufenden Legs (geworfene Punkte und Rest danach), daneben Leg- und
  Match-Average sowie die geworfenen Darts
- Der Checkout-Weg steht groß unter der Punktzahl des Spielers am Wurf. Er ist
  der Grund, warum dieser Bildschirm neben der Scheibe hängt, und bekommt
  deshalb mehr Platz als im Vorbild. Ein Setup-Wurf wird ruhiger gesetzt als
  ein echter Finish-Weg, damit beides nicht verwechselt wird
- Die aktive Tafel trägt die Signalfarbe dieses Projekts statt des
  Autodarts-Magenta — beide Screens sprechen dieselbe Farbsprache
- Ab drei Spielern verteilen sich die Tafeln wie auf dem Zuschauer-Screen auf
  beide Seiten, die Scheibe bleibt in der Mitte

### Hinzugefügt
- Der Player-Screen hat jetzt denselben Vorführmodus wie der
  Zuschauer-Screen: mit `?vorfuehrung` in der Adresse läuft er ohne Match
  durch, mit `?schritt=N` hält er auf einer Szene an

### Behoben
- Der Release-Lauf zu 0.1.0-beta.6 scheiterte zweimal, obwohl alle Tests
  bestanden: einmal an einer Protokollmeldung, die erst nach dem Testende
  eintraf und den Lauf mitriss, einmal an einer verschobenen Datei, deren
  Importzeile nicht nachgezogen war. Beides behoben

## [0.1.0-beta.6] - 2026-09-10

Sechste Beta. Erste Version, die sich selbst aktualisieren kann — ab hier
entfällt das Herunterladen von Hand.

### Behoben
- **Nach „Exit" auf der Scheibe kam die Spielpause nicht zurück.** Der
  Zustandskanal verstummt dabei einfach, ein letztes „beendet" gibt es nicht.
  Jetzt werten wir das Ende-Ereignis des Board-Kanals aus; unabhängig davon
  fällt die Anzeige nach fünf Minuten ohne jede Meldung von selbst in die
  Spielpause zurück
- **Alle Statistiken standen auf 0.** Autodarts liefert das Statistikobjekt
  leer aus (belegt im Protokoll eines echten Matches). Average, Checkout-Quote,
  180er, höchstes Finish und die geworfenen Darts rechnet die Anwendung jetzt
  selbst mit. Eine Zahl vom Server hat weiterhin Vorrang, falls doch eine kommt
- **Die Pfeile waren auf der Scheibe nicht zu erkennen.** Die Markierungen sind
  jetzt größer, nummeriert (1, 2, 3 in Wurfreihenfolge) und mit hellem Rand auf
  dunklem Hof — auf jedem Feld sichtbar. Zwischen zwei Aufnahmen bleibt die
  letzte Aufnahme gedämpft stehen, statt die Scheibe leer zu lassen

### Hinzugefügt
- **Spielerwechsel** ist jetzt eine eigene Einblendung: ein Band fährt von der
  Seite des Spielers herein, der an die Reihe kommt, mit Name und Restpunkten.
  Es sitzt unterhalb der Punktzahlen und verdeckt sie nicht
- Die Statistikleiste **blättert** zwischen zwei Seiten: „Match" mit Average,
  Checkout-Quote, 180ern, höchstem Finish und geworfenen Darts, und
  „Dieses Leg" mit Average, Darts, bester Aufnahme, 100+ und 140+
- Bei jedem Modus außer X01 steht der Modusname oben auf dem Bildschirm
- Das Diagnoseprotokoll enthält jetzt ein vollständiges Rohereignis **je
  Bauart** (Modus und Ereignistyp), nicht nur das allererste. Damit landet auch
  die Ermittlung des Anfangsspielers darin, sobald ein Match damit beginnt

### Geändert
- Die Dartscheibe ist deutlich größer (34 % der Bildhöhe im Zweikampf, 42 % in
  der Spaltenaufteilung)
- Das Logo ist auf beiden Bildschirmen größer

### Bekannte Einschränkungen
- **Die Ermittlung des Anfangsspielers (Bull-off) wird noch nicht dargestellt.**
  Dafür fehlen die Feldnamen — sie stehen in keinem bisherigen Protokoll. Diese
  Version schreibt sie beim nächsten Match mit Bull-off ins Diagnoseprotokoll,
  danach lässt sich die Anzeige genau bauen statt zu raten
- Andere Modi als X01 werden mit Namen angezeigt, aber ohne modusgerechte
  Auswertung: was die Zahlen dort bedeuten, steht erst nach einem Mitschnitt
  fest
- Der Satzstand bleibt die schwächste Ableitung: es gibt kein erkanntes Signal
  für das Ende eines Satzes

## [0.1.0-beta.5] - 2026-09-10

Fünfte Beta. Selbstaktualisierung, richtiger Legstand, Dartscheibe auf dem
Zuschauer-Screen.

### Hinzugefügt
- **Selbstaktualisierung.** Die Anwendung sucht beim Start, danach alle sechs
  Stunden und zusätzlich, sobald der Rechner aus dem Ruhezustand zurückkommt.
  Sie lädt im Hintergrund und installiert beim Beenden — nie während eines
  laufenden Matches. Jeder Schritt steht im Control-Fenster: Suche, Fortschritt
  in Prozent, bereitliegende Version, Fehler samt Grund
- Im Control-Fenster einstellbar, ob auch Beta-Versionen angeboten werden.
  „Automatisch" richtet sich nach der laufenden Version: eine Beta bekommt
  Betas, eine stabile Version nur stabile
- Knöpfe „Jetzt suchen" und „Jetzt neu starten und installieren". Der zweite
  lehnt während eines laufenden Matches ab und sagt warum
- Nach einer Aktualisierung zeigt das Control-Fenster einmalig, was neu ist
- **Dartscheibe** in der Mitte des Zuschauer-Screens: sie zeigt, in welchem
  Feld die Darts des laufenden Wurfs gelandet sind
- **Leg-Gewinn** ist jetzt eine eigene Einblendung — „<Name> hat das Leg
  gewonnen", mit Finish-Weg und neuem Legstand. Der Match-Gewinn sagt
  ausdrücklich „hat das Match gewonnen" statt nur „Sieger"
- Mehr Statistik auf dem Zuschauer-Screen, und für **beide** Spieler statt nur
  für den am Wurf: Match-Average, Checkout-Quote, 180er und höchstes Finish,
  darunter für das laufende Leg Average, Darts, beste Aufnahme, 100+ und 140+
- Ab drei Spielern stehen die Tafeln links und rechts der Scheibe — bis vier in
  den Ecken, ab fünf drei je Seite. Die Scheibe bleibt immer in der Mitte
- Das erste Rohereignis eines Matches landet vollständig im Diagnoseprotokoll.
  Ohne es sind die Feldnamen innerhalb des Zustands nicht nachprüfbar
- Der Pfad der laufenden Aufzeichnung steht im Diagnoseprotokoll, und ein
  Abbruch der Aufzeichnung ebenfalls. Beides war vorher unsichtbar

### Behoben
- **Der Legstand war falsch** — nach einem gewonnenen Leg stand 0:2 statt 0:1.
  Die Anwendung zählte selbst mit, statt die Zahl zu nehmen, die der Server
  ohnehin mitschickt. Eine selbst geführte Zählung verdoppelt sich, sobald
  dieselbe Momentaufnahme zweimal ankommt — etwa nach einer Wiederverbindung.
  Jetzt gilt die Zahl des Servers, die eigene Zählung ist nur noch Rückfall
- **Nach dem Matchende blieb der Endstand stehen.** Der Zuschauer-Screen kam
  nie zurück in die Spielpause. Jetzt bleibt der Endstand 30 Sekunden stehen,
  danach übernimmt wieder die Spielpause
- Ein Wurf mit dem Namen „S20" (statt „20") wurde als Wert 0 gelesen und lag
  damit auf keinem Feld der Scheibe
- Die zweite Zeile der Statistikleiste wurde am unteren Bildrand abgeschnitten

### Geändert
- Der Ruhezustand des Zuschauer-Screens heißt jetzt „Spielpause", die
  Zwischenfolie „Gleich geht's weiter"
- Der Installer heißt `autodarts-screens-Setup-<Version>.exe`, ohne
  Leerzeichen. GitHub ersetzt Leerzeichen in Anhangsnamen durch Punkte,
  electron-updater erwartet Bindestriche — mit dem alten Namen wäre jeder
  automatische Download in einen 404 gelaufen

### Bekannte Einschränkungen
- Die Selbstaktualisierung wirkt erst ab der **nächsten** Version: die
  Releases bis einschließlich beta.4 enthalten die dafür nötige `latest.yml`
  nicht, und beta.4 selbst kennt noch keinen Updater. Der Sprung auf beta.5
  muss ein letztes Mal von Hand installiert werden
- Die Feldnamen für die Spielerstatistiken (Average, Checkout-Quote, 180er,
  höchstes Finish) sind weiterhin nicht bestätigt — im Protokoll eines echten
  Matches waren diese Objekte leer. Der Adapter meldet jede solche Annahme
  einmalig im Diagnoseprotokoll
- Der Satzstand bleibt die schwächste Ableitung: es gibt kein erkanntes Signal
  für das Ende eines Satzes
- Die Dartscheibe zeigt die Mitte des getroffenen Feldes, nicht den gemessenen
  Auftreffpunkt. Das Rohereignis enthält nach heutigem Kenntnisstand keine
  Koordinaten

## [0.1.0-beta.4] - 2026-09-10

Vierte Beta. Der Kreis schließt sich: ein Wurf auf der Scheibe erreicht jetzt
beide Bildschirme.

### Hinzugefügt
- Der Adapter, der bisher in jeder Version gefehlt hat. Er übersetzt die
  Rohereignisse des Match-Kanals in den Anzeigezustand, den Player- und
  Zuschauer-Screen darstellen: Rest-Punktzahlen, aktueller Spieler, die drei
  Darts des laufenden Wurfs, Leg- und Satzstand, Average und Checkout-Quote
- Checkout-Weg und Setup-Wurf werden aus der Rest-Punktzahl selbst berechnet,
  nicht vom Server übernommen
- Spielerwechsel, 180er, High Finish, Leg- und Match-Gewinn werden aus dem
  Vergleich mit dem vorherigen Zustand abgeleitet und lösen die Szenen des
  Zuschauer-Screens aus
- Die Anwendung abonniert den Zustandskanal eines Matches, sobald das Board
  eines meldet. Bis hierher wurde nur das Board selbst abonniert, es kamen
  also nie Wurf-Ereignisse an
- Jedes Match wird ab dieser Version automatisch nach
  `%APPDATA%\autodarts-screens\mitschnitte\` aufgezeichnet. Ohne einen
  echten Mitschnitt lässt sich der Adapter nicht gegen die Wirklichkeit
  prüfen (siehe „Bekannte Einschränkungen")

### Geändert
- Vorspann: die Fahrt zwischen zwei Folien ist langsamer (1200 statt 700
  Millisekunden), das Logo größer, und zwischen zwei Leistungsfolien schiebt
  sich eine eigene Folie „Es geht gleich los" durch das Bild
- Ein Fehler im Adapter reißt die Verbindung nicht ab. Der zuletzt bekannte
  Zustand bleibt auf beiden Bildschirmen stehen, der Fehler landet im
  Diagnoseprotokoll

### Bekannte Einschränkungen
- Die Feldnamen **innerhalb** der Ereignisse sind teilweise geraten. Die
  äußere Form des Zustands ist aus einem echten Protokoll belegt; was genau
  in `players`, `turns`, `gameScores` und `stats` steht, konnte mangels
  Mitschnitt eines echten Matches nicht überprüft werden. Der Adapter meldet
  jede solche Annahme einmalig im Diagnoseprotokoll (Zeilen mit `Adapter:`).
  Bleiben Felder leer oder stehen falsche Zahlen auf dem Bildschirm, liegt
  die Ursache mit hoher Wahrscheinlichkeit hier — der Mitschnitt des
  betroffenen Matches genügt, um es zu berichtigen
- Der Satzstand ist die schwächste Ableitung: es gibt kein erkanntes Signal
  für das Ende eines Satzes
- Keine Selbstaktualisierung

## [0.1.0-beta.3] - 2026-09-10

Dritte Beta. Anmeldung und Verbindung funktionieren jetzt wirklich, und die
Anwendung hört auf dem Board mit.

### Behoben
- Der Verbindungsaufbau scheiterte unmittelbar nach jeder erfolgreichen
  Anmeldung. Zwei Annahmen aus Community-Projekten waren falsch, beide gegen
  den echten Server belegt: das WebSocket-Ticket kommt im Feld `code` statt
  als reine Zeichenkette, und der Subscribe-Endpunkt erwartet den Parameter
  `code` statt `ticket`. Mit `ticket` antwortete der Server `unauthorized` —
  er ignorierte den unbekannten Parameter und behandelte die Anwendung wie
  nicht angemeldet
- Ein Fehler bei der Anmeldung blieb unsichtbar: das Control-Fenster zeigte
  nichts an, und es gab nichts zum Nachlesen
- Statt des Kontonamens stand „Angemeldet als: angemeldet" im
  Control-Fenster

### Hinzugefügt
- Die Anwendung abonniert das eingestellte Board und erkennt ein startendes
  Match. Ohne eingetragene Board-Kennung wird das ausdrücklich gemeldet,
  statt stumm zu bleiben
- Diagnoseprotokoll unter `%APPDATA%\autodarts-screens\diagnose.log`, im
  Control-Fenster verlinkt. Es enthält Hosts, Pfade, Statuscodes und die
  Namen von Antwortfeldern — niemals Token, Codes oder Passwörter
- Verständliche Fehlermeldungen im Control-Fenster statt Schweigen
- Der Kontoname wird angezeigt. Er stammt aus dem Zugriffstoken selbst, ohne
  zusätzlichen Abruf
- Vorspann auf dem Zuschauer-Screen: solange kein Match läuft, zeigt er im
  festen Takt die Leistungen des Herausgebers statt nur des Logos

### Fehlt in dieser Version
- Der Adapter, der Rohereignisse in die Anzeige übersetzt. Beide Screens
  zeigen deshalb weiterhin kein laufendes Match — die Ereignisse kommen an
  und lassen sich aufzeichnen, aber noch nicht darstellen
- Keine Selbstaktualisierung

## [0.1.0-beta.2] - 2026-09-10

Zweite Beta. Bringt den Zuschauer-Screen.

### Hinzugefügt
- Zuschauer-Screen im Broadcast-Look: zwei Spielertafeln mit großen
  Rest-Punktzahlen, Leg- und Satzstand in der Mitte, Statistikleiste und
  Leg-Verlauf am unteren Rand
- Sieben Szenen, die sich aus dem Match-Zustand ableiten: Ruhezustand,
  Spieler-Vorstellung, Scoreboard, Spielerwechsel, 180er und High Finish,
  Leg-Gewinn und Match-Gewinn
- Beim Spielerwechsel wandert eine grüne Signalkante über die Trennfuge zur
  Tafel des Spielers, der an der Reihe ist
- Vorführmodus: der Zuschauer-Screen spielt mit dem Abfrageparameter
  `?vorfuehrung` alle Szenen ohne laufendes Match durch, zum Einrichten des
  Monitors

### Geändert
- Der Zuschauer-Screen kommt ohne Animationsbibliothek aus. Die Übergänge
  laufen über CSS, das spart eine Abhängigkeit im Installer

### Fehlt in dieser Version
- Keine Selbstaktualisierung: die Anwendung prüft nicht auf neue Versionen und
  aktualisiert sich nicht selbst; eine neue Version muss von Hand
  heruntergeladen und installiert werden
- Der Autodarts-Adapter (Rohereignis zu Anzeigezustand) fehlt noch, deshalb
  zeigen Player- und Zuschauer-Screen noch keine echten Live-Match-Daten an.
  Anmeldung und Verbindung funktionieren bereits; zum Ansehen der Layouts
  dienen ein synthetischer Testzustand (`AD_TESTZUSTAND=1`), die Wiedergabe
  einer Aufzeichnung (`AD_WIEDERGABE`) und der Vorführmodus

## [0.1.0-beta.1] - 2026-09-10

Erste Beta. Zum Ausprobieren auf dem Zielrechner, nicht für den produktiven
Turniereinsatz — siehe „Fehlt in dieser Version" unten.

### Hinzugefügt
- Projektgerüst mit Electron, Vite, React und TypeScript
- Rechtliche Pflichtangaben
- Anmeldung bei Autodarts per OAuth Authorization Code + PKCE im eingebetteten Fenster
- Live-Anbindung an die Autodarts-API
- Aufzeichnung und Wiedergabe von Match-Ereignissen
- Monitor-Auswahl für Player- und Spectator-Screen im Control-Fenster
- Player-Screen mit Rest-Score, Checkout-Weg und aktuellem Wurf
- Über-Panel mit Herausgeberangaben, Datenschutz- und Sicherheitshinweisen
- Funktion „Alle lokalen Daten löschen" im Control-Fenster
- Unsignierter Windows-Installer (NSIS, pro Nutzer, ohne Administratorrecht)
- Fremdlizenzen-Dokument (`THIRD-PARTY-LICENSES.md`) für die mitgelieferten
  Produktionsabhängigkeiten und die Electron-Laufzeit
- Stückliste (CycloneDX) als Anhang dieses Releases

### Fehlt in dieser Version
- Kein Zuschauer-Screen (Spectator): die Monitor-Auswahl dafür existiert im
  Control-Fenster, die Broadcast-Ansicht selbst ist noch nicht gebaut
- Keine Selbstaktualisierung: die Anwendung prüft nicht auf neue Versionen und
  aktualisiert sich nicht selbst; eine neue Version muss von Hand
  heruntergeladen und installiert werden
- Der Autodarts-Adapter (Rohereignis zu Anzeigezustand) fehlt noch, deshalb
  zeigt der Player-Screen noch keine echten Live-Match-Daten an. Anmeldung
  und Verbindung funktionieren bereits; zum Ansehen des Layouts dient ein
  synthetischer Testzustand (`AD_TESTZUSTAND=1`) oder die Wiedergabe einer
  Aufzeichnung (`AD_WIEDERGABE`)
