# Entscheidungen während des ersten Bauabschnitts

Stand: 2026-09-10, Branch `feature/fundament-und-live-daten`

Hier steht jede Entscheidung, die während der Umsetzung ohne Rückfrage
getroffen wurde — mit Begründung und mit den Kosten, falls sie falsch war.
Das ist der Gegenpol zu `UEBERGABE.md`: dort steht, was du tun musst, hier
steht, was ohne dich entschieden wurde. Lies es, wenn dich interessiert warum
etwas so ist, oder wenn du etwas rückgängig machen willst.

Die Reihenfolge ist die, in der die Entscheidungen fielen. Eine Entscheidung
weiter unten kann eine weiter oben aufheben — der auffälligste Fall ist der
Anmeldeweg, der zweimal gewechselt hat, bis ein eigener Test gegen die echten
Autodarts-Server ihn festgelegt hat.

Ursprung dieser Liste ist das Arbeitsprotokoll der Umsetzung. Es lag in einem
Arbeitsordner, der nach Abschluss gelöscht wird — deshalb steht der Inhalt
jetzt hier.




## Rulings

## 2

Feature-Branch statt Worktree — frisches Repo, keine konkurrierende Arbeit, Worktree waere reiner Overhead. Kosten wenn falsch: ein `git worktree add` nachtraeglich, minutenweise.

## 3

Fixture heisst durchgaengig `docs/fixtures/match.jsonl` statt `match-<datum>.jsonl` — T5 nennt sie datiert, T7 und T8 verdrahten ein Datum. Ein stabiler Name statt drei Stellen, die synchron bleiben muessen. Kosten wenn falsch: weitere Mitschnitte brauchen Suffixe, trivial.

## 4

OAuth-Endpunkte werden zur Laufzeit aus dem well-known-Dokument gelesen statt einkodiert, die Client-Kennung kommt aus der Umgebungsvariable AD_CLIENT_ID mit klarer Fehlermeldung, wenn sie fehlt. Grund: login.autodarts.com existiert nicht, login.autodarts.io antwortet mit HTTP 522, die Kennung ist ohne Jans Browser nicht feststellbar. Kosten wenn falsch: eine Konstante wandert spaeter von der Umgebungsvariable in eine Datei.

## 5

T7 wird geteilt — `src/shared/typen.ts` entsteht sofort aus Abschnitt 6 der Spec, `src/autodarts/adapter.ts` erst nach Jans Mitschnitt. Grund: ohne echtes Schema waere der Adapter geraten, und geratener Code mit gruenen Tests gegen eine erfundene Fixture ist schlimmer als kein Code. Kosten wenn falsch: keine, der Adapter kommt so oder so nach dem Mitschnitt.

## 6

Manuelle Schritte (T3.3 Client-Kennung ablesen, T4.6 Anmeldung pruefen, T5.4 Match mitschneiden) blockieren den Durchgang nicht. Alles Uebrige wird gebaut, die drei Schritte gehen am Ende an Jan zurueck. Kosten wenn falsch: nichts, sie sind ohnehin nur von ihm ausfuehrbar.

## 7

Waehrend ein Implementer laeuft, committe ich selbst nicht mehr ins Repo. Ich habe 9d1f9c6 (Plan-Fixture-Name) nach dem Dispatch von Task 1 committet; beide beruehren getrennte Pfade, also unschaedlich, aber die Review-Basis fuer Task 1 ist der Commit unmittelbar vor dem ersten Implementer-Commit, nicht c0f1faa. Kosten wenn falsch: das Review-Paket enthielte eine fremde Doku-Aenderung.

## 8

Reviewer und der Implementer der jeweils naechsten Aufgabe laufen parallel, solange ihre Dateimengen disjunkt sind — der Reviewer liest nur, und Task 2 fasst ausschliesslich Markdown im Wurzelverzeichnis an. Grund: Jan hat einen Durchgang ohne Zwischenfreigaben gewuenscht, strikte Serialisierung verdoppelt die Wanduhr ohne Gegenwert. Nie zwei Implementer gleichzeitig. Kosten wenn falsch: ein Review-Paket koennte fremde Commits enthalten; die Bereiche sind aber explizit auf Hashes festgelegt.

## 9

Der Befund widerspricht dem Plantext, der in Task 1 Schritt 6 woertlich `index.js` vorgibt — der Plan hat unrecht, das Review recht. Zusaetzlich gilt: bei sandbox: true kann Electron kein ESM-Preload laden, sandboxed Preloads muessen CommonJS sein. Ein blosses Umbiegen auf .mjs waere also weiterhin kaputt. Entschieden: sandbox: true bleibt (bindende Sicherheitsvorgabe der Spec), der Preload wird als CommonJS mit Endung .cjs gebaut, main verweist auf ../preload/index.cjs. Kosten wenn falsch: falls electron-vite eine sauberere eigene Option bietet, waere die Rollup-Konfiguration unnoetig umstaendlich — der Implementer ist angewiesen, das zu pruefen.

## 10

Der Important-Befund zur undokumentierten .gitignore-Zeile `.superpowers/` faellt weg — die Zeile stammt aus meinem eigenen Setup, nicht vom Implementer. Kosten wenn falsch: keine, die Zeile ist inhaltlich richtig.

## 11

Das vom Review als nicht pruefbar markierte Item (Production-Pfad nie gebaut) ist eine echte Luecke und geht als Anforderung in die Fix-Runde: npm run build muss laufen, out/renderer/control/index.html muss existieren, und window.app.version muss im Control-Fenster konsumiert werden, damit ein toter Preload kuenftig auffaellt. Kosten wenn falsch: eine zusaetzliche Zeile Anzeige im Control-Fenster, die Task 11 ohnehin ersetzt.

## 12

Befund 1 (PRIVACY.md beschreibt "Alle lokalen Daten loeschen" als existierend, Funktion gibt es noch nicht) wird nicht im Text entschaerft, sondern durch Umsetzung eingeloest: die Loeschfunktion wird verbindliche Anforderung von Task 11. Grund: Abschnitt 18.3 der Spec fordert sie ohnehin, und eine Datenschutzerklaerung im Konjunktiv ist schlechter lesbar als eine, die stimmt. Das Repo ist bis dahin nicht oeffentlich. Kosten wenn falsch: die Funktion entsteht ein paar Tasks frueher als geplant, wenige Zeilen.

## 13

Befund 2 (SECURITY.md sagt Empfangsbestaetigung binnen 5 und Ersteinschaetzung binnen 10 Werktagen zu) bleibt vorerst stehen, wird aber Jan ausdruecklich vorgelegt — das ist eine Zusage, die er als Einzelunternehmer persoenlich einhalten muss, und damit seine Entscheidung, nicht meine. Kosten wenn falsch: eine Formulierung in einer Markdown-Datei, jederzeit aenderbar.

## 14

Befund 3 (README verspricht "Aktualisierungen", SECURITY.md nur "Sicherheitsaktualisierungen" — unterschiedlicher Geltungsbereich bei gleicher Frist) wird angeglichen auf "Sicherheitsaktualisierungen". Geht in eine Fix-Runde, sobald ein Implementer-Slot frei ist. Kosten wenn falsch: keine, engere Zusage ist die sichere.

## 15

Ich habe zeitweise zwei Implementer parallel laufen (Task-1-Fix und Task 6). Ihre Dateimengen sind disjunkt, aber beide committen auf denselben Branch — bei gleichzeitigem Commit kann git an der index.lock scheitern. Akzeptiert, weil der Inhalt nicht kollidieren kann und ein gescheiterter Commit sichtbar fehlschlaegt statt still falsch zu werden. Kein dritter Implementer parallel. Kosten wenn falsch: ein Agent muss seinen Commit wiederholen.

## 16

Der rote Test ist mein Fehler, nicht der des Implementers. Der Test verlangte, dass setupWurf auch bei Rest 301 und 501 einen Wurf liefert, der eine ausmachbare Zahl uebrig laesst — unmoeglich, weil das hoechste Feld T20 mit 60 Punkten aus 301 nur 241 macht und ab Rest 231 kein Wurf mehr unter 171 landet. Die Anforderung war unerfuellbar. Entschieden: setupWurf bekommt eine dritte Regel — ist kein ausmachbarer Rest herstellbar, wird 'T20' als hoechster Scoring-Wurf empfohlen. Der Test wird entsprechend geteilt, mit 230 als Grenzfall (230 minus 60 ergibt genau 170). Kosten wenn falsch: die Empfehlung bei hohem Rest waere pauschal statt situativ — bei Rest ueber 230 gibt es aber ohnehin nichts Klügeres als maximal zu punkten.

## 17

Die vom Implementer eigenmaechtig verfeinerte stufe-Formel in kandidaten() bleibt. Ohne Strafe fuer ein Doppel als Aufbau-Dart lieferte checkoutWeg(60) einen unrealistischen Weg — nachgerechnet: D20 plus D10 hat Aufbau 40 und schlaegt bei meiner urspruenglichen Sortierung die Standardloesung 20 plus D20 mit Aufbau 20, obwohl niemand ein Doppel als Aufbau anvisiert. Der Implementer ist angewiesen, die Faelle im Report zu belegen und die Begruendung als Kommentar in den Code zu setzen. Kosten wenn falsch: einzelne Checkout-Wege waeren ungewohnt, ohne je ungueltig zu sein — die Gueltigkeitspruefung im Test faengt echte Fehler ab.

## 18

Task 8 wird auf die Schritte 1 bis 4 begrenzt — Schritt 5 haengt websocket.ts ein, das erst in Task 5 entsteht. Die Aufzeichnungs- und Wiedergabelogik selbst ist vom API-Schema unabhaengig und laesst sich jetzt bauen und testen. Kosten wenn falsch: das Einhaengen wird ein kleiner Nachtrag in Task 5.

## 19

Task 7 wird geteilt ausgefuehrt. Teil a ist src/shared/typen.ts, rein aus Abschnitt 6 der Spec ableitbar und ohne API-Zugang baubar; es entsperrt Task 10, das MatchState braucht. Teil b, der Adapter, wartet auf Jans Mitschnitt. Kosten wenn falsch: keine, die Typen sind in der Spec festgeschrieben und aendern sich durch den Mitschnitt nicht.

## 20

Beide Important gehen in die Fix-Runde. Der leere String als boardId, der nicht geleerte setTimeout und das nicht-atomare Schreiben bleiben als Minor liegen — die Datei ist klein und der Lesepfad faellt in jedem Fehlerfall auf die Standardkonfiguration zurueck, Temp-Datei plus Rename waere mehr Maschinerie als Nutzen. Kosten wenn falsch: eine halb geschriebene config.json fuehrt zu Standardwerten statt zu gespeicherten, einmalig und sichtbar.

## 21

Ich lasse voruebergehend drei Implementer gleichzeitig laufen (Task 3, Task-9-Fix, Task 10) statt der zuvor festgelegten zwei. Ihre Dateimengen sind disjunkt — werkzeuge und docs, src/main/konfiguration und monitore, src/main/fenster und ipc plus preload und renderer/player. Grund: Task 10 entsperrt Task 11 und ist der laengste verbleibende Bauabschnitt. Kosten wenn falsch: ein Agent muss einen Commit wegen index.lock wiederholen, wozu alle angewiesen sind.

## 22

Task 10 baut die IPC-Kanaele fuer Anmelden und Abmelden nicht mit, obwohl der Brief sie auffuehrt. src/autodarts/oauth.ts existiert noch nicht, und ein Kanal, der ins Leere laeuft, ist schlimmer als keiner. Sie kommen mit Task 4. Kosten wenn falsch: Task 4 ergaenzt zwei Kanaele statt sie nur zu verdrahten.

## 23

Task 10 baut einen dauerhaften Verifikationshaken ein — Umgebungsvariable AD_TESTZUSTAND=1 verschickt einen synthetischen MatchState ohne Netz. Grund: ohne ihn liesse sich die IPC-Kette heute gar nicht pruefen, und Task 11 braucht genau das, um den Player-Screen zu entwickeln, bevor der Adapter existiert. Das ist bewusst kein Wegwerf-Code. Kosten wenn falsch: ein paar Zeilen, die spaeter entfallen koennen.

## 24

Befund 1 wird durch einen aussagekraeftigen Fehler bei laufender Aufzeichnung geloest, nicht durch stilles Schliessen des alten Streams. Ein zweiter Start ist ein Programmierfehler des Aufrufers; eine stille Selbstheilung wuerde ihn verstecken. Mehrfaches Beenden bleibt folgenlos. Kosten wenn falsch: ein Aufrufer muss vor dem Neustart explizit beenden.

## 25

Befund 2 wird geloest, indem beschaedigte Zeilen uebersprungen statt verschluckt werden — Warnung mit Zeilennummer, und wiedergeben liefert kuenftig { abgespielt, uebersprungen } statt void. Grund: nach einem Absturz mitten im Match ist die letzte Zeile halb geschrieben, genau dann muss der Rest noch abspielbar sein, und der Aufrufer muss die Luecke sehen koennen. Kosten wenn falsch: eine Signaturaenderung, die noch niemand konsumiert.

## 26

Befund 3 wird trotz Minor-Einstufung behoben. Das Review haelt ihn fuer unwahrscheinlich, weil Rohereignisse aus JSON.parse eines WebSocket-Frames stammen. Ich lasse ihn dennoch abfangen, weil eine mitten im Match sterbende Aufzeichnung alles Folgende verliert und die Absicherung drei Zeilen kostet. Kosten wenn falsch: drei Zeilen toter Schutzcode.

## 27

Befund 1 ist echt und mein Fehler. Meine Behauptung, Regel 2 von setupWurf greife bis Rest 230, stimmt nicht: fuer 219, 222, 223, 225, 226, 228 und 229 hinterlaesst jeder moegliche Wurf entweder eine Bogey-Zahl oder einen Rest ausserhalb 2..170. Nachgerechnet fuer 219 — die einzigen Felder unter 171 sind T17, BULL, T18, T19, T20 und hinterlassen 168, 169, 165, 162, 159, allesamt Bogey. Das Ergebnis T20 bleibt richtig, aber Kommentar und Testabdeckung waren falsch. Geht in eine Fix-Runde mit eigenem Test. Kosten wenn falsch: keine, der Test macht die Zusicherung nur strenger.

## 28

Befund 2 (Code-Kommentar verweist auf task-6-report.md unter .superpowers/sdd) wird behoben, indem die Begruendung vollstaendig in den Code wandert. Das Verzeichnis ist Planungswerkzeug und wird nach Abschluss geloescht. Kosten wenn falsch: ein paar Zeilen Kommentar mehr.

## 29

Die Beobachtung zu Rest 48 und 56 behandle ich nicht als Fehler. Die Umsetzung liefert 8 plus D20 beziehungsweise 16 plus D20, waehrend viele Tabellen 16 plus D16 und T8 plus D16 lehren — D16 gilt als sicherer, weil beide Nachbarfelder 8 sind und ein Fehlwurf gerade bleibt, waehrend D20 die Nachbarn 1 und 5 hat. Beide Wege sind gueltig; das ist eine Frage der Darts-Praxis und gehoert Jan, nicht mir. Entschieden: Zielkonflikt als Kommentar ueber BEVORZUGTE_DOPPEL sichtbar machen, damit ein Umstellen eine Einzeiler-Aenderung bleibt, und Jan vorlegen. Kosten wenn falsch: einzelne Empfehlungen sind ungewohnt, nie ungueltig.

## 30

Der Implementer meldet eine Testkopplung, die aus meinem vorgegebenen Testblock stammt — "wirft, wenn eine Aufzeichnung bereits laeuft" beendet die Aufzeichnung nicht, der Folgetest schliesst sie implizit mit und prueft damit nicht, was sein Name behauptet. Beide brechen bei geaenderter Reihenfolge oder Einzelausfuehrung. Entschieden: afterEach raeumt den Modulzustand auf, und jeder Test muss zusaetzlich einzeln gruen sein. Kosten wenn falsch: vier Zeilen Aufraeumcode.

## 31

Ich committe Task 3 selbst, statt den Agenten neu zu starten. Die Dateien waren fertig, es fehlte nur der Commit — das ist Buchhaltung, keine Implementierung, und ein Neustart haette dieselbe teure Recherche wiederholt. Kosten wenn falsch: der Commit ist noch nicht reviewt, das Review folgt.

## 32

Das Task-8-Re-Review gilt als bestanden. Der Agent hat wortwoertlich gemeldet, dass alle vier Sonden das erwartete Verhalten bestaetigen — reine Fehlerdatei zaehlt 0 von 3, leere Datei 0 von 0 ohne Fehler, Warnungen mit korrekten Zeilennummern, und die Fehlerzeile aus Befund 3 wird bei der Wiedergabe als uebersprungen gezaehlt statt als Ereignis durchgereicht. Die inhaltliche Pruefung war damit vollstaendig, es fehlte nur die Formatierung. Kosten wenn falsch: ein nicht formatiertes Verdikt, waehrend die Substanz belegt vorliegt.

## 33

Task 3 bekommt kein eigenes Review. Der erste Schritt von Task 4 ist ein empirischer POST-Test der dort dokumentierten Werte gegen den echten Server — das prueft die Angaben haerter als ein Reviewer, der nur dieselben Quellen nachliest. Kosten wenn falsch: ein falsch abgeschriebener Endpunkt fliegt beim ersten Aufruf auf, mit Fehlermeldung.

## 34

Die Spec wird geaendert, nicht der Fund weggeredet. Abschnitt 3 und der neue Abschnitt 5.2 stellen die Anmeldung vom Authorization Code Flow im eingebetteten Fenster auf den Device Authorization Grant im Systembrowser um. Zwei Gruende: fuer autodarts-play ist nur play.autodarts.com als Umleitungsziel registriert, und Google verweigert OAuth-Anmeldungen aus eingebetteten Webviews — der eingebettete Weg waere bei Jans Google-Konto genau am entscheidenden Schritt gescheitert. Offen bleibt, ob der Client die Ablaufart benutzen darf; das prueft Task 4 als ersten Schritt, mit dem Abfangen der Umleitung als Rueckfallweg. Kosten wenn falsch: faellt der Test negativ aus, kostet der Rueckfallweg einen Umbau und beschraenkt die Anmeldung auf Konten mit Passwort. Commit 4e1694b.

## 35

AUFGEHOBEN — Meine vorige Entscheidung fuer den Device Authorization Grant war falsch und ist zurueckgenommen. Node hat in dieser Umgebung Netzzugang (nur curl ist blockiert), deshalb konnte ich den offenen POST-Test selbst ausfuehren statt ihn an Task 4 zu delegieren. Ergebnis: POST /auth/v1/device/code mit {"client_id":"autodarts-play"} antwortet 400 unauthorized_client, "client may not use the device authorization grant". Die serverweite Liste grant_types_supported sagt ueber die Rechte des einzelnen Clients nichts aus — genau das hatte ich als offenen Punkt vermerkt und jetzt geklaert.

## 36

Task 4 wird NICHT dispatcht, bis Jan entschieden hat. Es bleiben zwei Wege: eingebettetes Fenster mit Abfangen der Umleitung auf play.autodarts.com (haelt die Zusage, kein Passwort zu sehen, aber Google verweigert OAuth in eingebetteten Webviews), oder /auth/v1/login mit Passwort (funktioniert ohne Browser, bricht aber eine Zusage, die schon in der Spec und in PRIVACY.md steht, und geht bei einem reinen Google-Konto nicht). Das ist der eine Punkt in diesem Plan, an dem beide Annahmen zu materiell anderer Arbeit fuehren und zusaetzlich ein veroeffentlichtes Datenschutzversprechen beruehren — hier zu raten waere falsch. Alles Uebrige laeuft weiter. Kosten wenn falsch: keine, die Frage ist gestellt und der Rest des Durchgangs blockiert nicht.

## 37

Anmeldeweg entschieden. Jan hat bestaetigt, dass sein Konto ein eigenes Passwort besitzt und nicht auf Google angewiesen ist, und Weg 1 gewaehlt — eingebettetes Fenster mit Authorization Code plus PKCE, Umleitung abgefangen. Damit bleibt die Zusage aus Abschnitt 18.3 und aus PRIVACY.md, dass die Anwendung keine Zugangsdaten entgegennimmt, unveraendert wahr, und die Google-Webview-Sperre ist kein Blocker mehr, weil auf derselben Autodarts-Seite die Passwort-Anmeldung offensteht. Commits eb969ba und 873bded, Spec-Abschnitte 3 und 5.2.

## 38

Task 4 testet nur die reinen Funktionen automatisiert — pkcePaar, tokenNochGueltig und codeAusUmleitung, jeweils mit Grenzfaellen. Der Anmeldeablauf selbst braucht Jans Zugangsdaten und ist nicht automatisierbar; der Implementer verifiziert stattdessen die zusammengesetzte Autorisierungs-Adresse gegen den echten Server (302 auf auth.autodarts.com erwartet) und schreibt eine Anleitung fuer Jans einmalige Handpruefung. Kosten wenn falsch: der Anmeldeablauf faellt erst bei Jans erstem Versuch auf, dafuer mit klarer Fehlermeldung.

## 39

Der Important-Befund (Preload exponiert fensterOeffnen, fensterSchliessen und konfigurationLesen an alle drei Fenstertypen, weil alle dieselbe Preload-Datei laden) wird durch einen Waechter im Hauptprozess geloest, nicht durch eine zweite Preload-Datei. Die Funktionen muessen bleiben, weil Task 11 sie im Control-Fenster braucht. Ein Waechter an der Stelle, durch die alle Aufrufer laufen, ist ein kleinerer Eingriff als zwei Preload-Dateien, die synchron zu halten sind. Die Waechterlogik wird als reine Funktion extrahiert und getestet. Kosten wenn falsch: bei spaeter divergierenden Rechten je Fenster waere eine echte Trennung sauberer.

## 40

Task 5 baut rest.ts, websocket.ts und das in Task 8 zurueckgestellte Einhaengen von Aufzeichnung und Wiedergabe. Der eigentliche Mitschnitt eines Matches bleibt bei Jan. Wichtigste Pruefung der Aufgabe ist der Wiedergabemodus ohne Netz und ohne Anmeldung — daran haengt die gesamte weitere Entwicklung ohne Dartscheibe. Testbar und deshalb Pflicht sind die reinen Funktionen wartezeit() und istNichtAngemeldet(). Kosten wenn falsch: die unbestaetigten Annahmen zu Ticket-Rumpf und Kanalnamen fallen bei Jans erstem Mitschnitt auf, deshalb muss jede davon im Code als Annahme markiert sein.

## 41

Task 11 baut ueber den Brief hinaus die Funktion "Alle lokalen Daten loeschen" mit eigenem, waechtergeschuetztem IPC-Kanal. Grund: PRIVACY.md behauptet bereits, dass es sie gibt — solange sie fehlt, ist die Datenschutzerklaerung sachlich falsch. Das war die Einloesung des in Task 2 geparkten Befunds. Kosten wenn falsch: eine Funktion mehr, die ohnehin in Abschnitt 18.3 der Spec gefordert ist.

## 42

Die Knoepfe fuer Anmelden und Abmelden entstehen deaktiviert und mit sichtbarem Hinweis, weil oauth.ts gebaut aber nicht ueber IPC angebunden ist. Lieber ein ehrlich deaktivierter Knopf als ein erfundener Kanal oder eine Oberflaeche, die eine funktionierende Anmeldung vortaeuscht. Kosten wenn falsch: die Anbindung ist ein kleiner Nachtrag, sobald Jan die Anmeldung einmal von Hand geprueft hat.

## 43

Task 11 legt zusaetzlich einen Screenshot des Player-Screens unter docs/screenshots/player.png ab. Bei einem Bildschirm, dessen ganzer Zweck Lesbarkeit aus mehreren Metern ist, ist ein Textbeleg per CDP nicht genug — ich will sehen koennen, wie er aussieht. Kosten wenn falsch: eine Bilddatei im Repo.

## 44

Befund 1 wird per Single-Flight geloest — die laufende Erneuerung wird als Promise gehalten und an gleichzeitige Aufrufer zurueckgegeben. Dazu korrigiere ich meine eigene Briefvorgabe: "Schlaegt die Erneuerung fehl, wird die Ablage verworfen" war zu grob und verschaerft den Befund. Kuenftig wird die Ablage nur bei invalid_grant oder Status 400/401 verworfen; Netzwerkfehler, Zeitueberschreitungen und 5xx werfen nur einen Fehler und lassen die Ablage unberuehrt. Kein Grund, jemanden abzumelden, weil das WLAN kurz weg war. Kosten wenn falsch: ein tatsaechlich ungueltiger Token wird einen Versuch spaeter erkannt.

## 45

Der als Minor gemeldete fehlende isMainFrame-Test wird mitgenommen, weil derselbe Handler fuer die state-Pruefung ohnehin angefasst wird. Eine Bedingung mehr. Kosten wenn falsch: keine.

## 46

Dass zwei gleichzeitige anmelden-Aufrufe zwei Fenster oeffnen, bleibt ungeloest. Unschoen, nicht unsicher, und die Oberflaeche sperrt den Knopf waehrend einer laufenden Anmeldung. Kosten wenn falsch: zwei Fenster, die der Nutzer schliesst.

## 47

Die vom Implementer angelegte Beispiel-Fixture wird von docs/fixtures/match.jsonl nach docs/fixtures/beispiel-wiedergabe.jsonl umbenannt. Sie enthaelt erfundene Ereignisse — im Dateikopf korrekt so markiert —, lag aber unter genau dem Namen, den die Adapter-Tests aus Task 7 als echten Mitschnitt lesen. Ein Adapter, der gegen selbst erfundene Daten gruen ist, sagt nichts darueber aus, ob er die echte API versteht; das waere die gefaehrlichste Art von falscher Sicherheit in diesem Projekt. Ein README im Fixture-Ordner haelt die Trennung fest und reserviert match.jsonl fuer Jans Mitschnitt. Commit a699c89. Kosten wenn falsch: keine, der Name ist nur ein Name — die Verwechslungsgefahr war das Problem.

## 48

Befund 1 (doppeltes abonnieren sendet zwei identische subscribe-Rahmen, weil nur die Merkliste dedupliziert ist, nicht der Live-Versand) geht in die Fix-Runde. Wie der Server auf ein Doppel-Abonnement reagiert, ist unbekannt; im schlechtesten Fall kommt jedes Ereignis zweimal und der Adapter zaehlt spaeter Wuerfe doppelt. Kosten wenn falsch: eine Bedingung mehr.

## 49

Befund 2 (ein Verlust der Anmeldung mitten in der Sitzung landet nur in console.error, die Wiederverbindung laeuft ewig weiter, der Aufrufer erfaehrt nichts) wird durch einen zweiten, optionalen Rueckruf an verbinden geloest: beiVerbindungszustand mit den Werten verbunden, getrennt und nichtAngemeldet. Kein Ereignis-System, keine neue Abstraktion, ein Parameter. Die Wiederverbindung laeuft weiter, damit die Anwendung nach einer erneuten Anmeldung von selbst greift. Grund: sonst zeigt das Control-Fenster "verbunden", waehrend nichts mehr kommt. Kosten wenn falsch: ein Parameter, den zunaechst nur das Control-Fenster nutzt.

## 50

Der dritte Minor des Task-5-Reviews betrifft eine fremde Datei und wird trotzdem sofort behoben. aufzeichnungStarten() haengt keinen error-Zuhoerer an den WriteStream, nur aufzeichnungBeenden() tut das. Ein Stream-Fehler waehrend des Schreibens — Platte voll, Pfad weg, Rechte entzogen — ist damit ein unbehandeltes error-Ereignis und beendet den Prozess. Das trifft genau den Fall, gegen den in Task 8 Runde 1 schon zwei andere Loecher geschlossen wurden: die Aufzeichnung entsteht in einem nicht wiederholbaren Match, und diesmal nimmt sie die ganze Anwendung mit, waehrend jemand am Board steht. Dieselbe Abwaegung wie damals: die Anzeige des Matches ist wichtiger als die Aufzeichnung. Kosten wenn falsch: drei Zeilen Schutzcode.

## 51

Das wird behoben. Ein Test, der auf einer anderen Plattform gruen ist ohne zu pruefen, ist schlimmer als kein Test — er erzeugt falsche Sicherheit genau an der Stelle, die eine nicht wiederholbare Match-Aufzeichnung schuetzen soll. Umsetzung nach dem Vorschlag des Re-Reviewers: das error-Ereignis direkt auf einem Attrappen-Stream ausloesen statt es ueber einen kaputten Pfad zu provozieren, Produktivcode bleibt unveraendert. Kosten wenn falsch: eine Testattrappe mehr.

## 52

Keine fuenfte Review-Runde fuer eine Testattrappe. Der Re-Reviewer hatte den Produktivcode schon als korrekt bestaetigt und den konkreten Umsetzungsweg selbst vorgeschlagen; die Umsetzung entspricht ihm nachweislich. Eine weitere Runde waere Zeremonie. Kosten wenn falsch: ein Test, dessen Attrappe niemand gegengelesen hat — er ist vier Zeilen lang und ich habe ihn selbst angesehen.

## 53

Der Important-Befund wird behoben. "Angemeldet als: nicht angemeldet" steht fett und definitiv da, obwohl es keine Datenquelle gibt — direkt darunter ist der Verbindungszustand ehrlich als unbekannt markiert. Genau dieser Unterschied macht die erste Zeile zu einer Behauptung, die wir nicht belegen koennen. Wird an die ehrliche Zeile angeglichen, und die uebrigen Platzhalter gleich mit. Kosten wenn falsch: keine.

## 54

Der Minor zur Zahlengewichtung wird trotz Minor-Einstufung behoben. Der ganze Zweck dieses Bildschirms ist das eindeutige Ablesen im Augenwinkel; wenn zwei Zahlen sich nur in der Groesse unterscheiden, ist das genau dort die falsche Sparsamkeit. Kosten wenn falsch: eine CSS-Zeile.

## 55

Der Screenshot wird nach dem Fix erneuert. Ein Screenshot, der nicht mehr stimmt, ist schlechter als keiner.

## 56

Der Implementer meldet, dass istAuthFehler den oauth.ts-Fall ueber den exakten Wortlaut 'Bitte erneut anmelden' erkennt statt ueber einen Typ. Ursache war meine Sperre, oauth.ts nicht anzufassen — nicht sein Code. Die Sperre hebe ich auf, Task 4 ist abgeschlossen und niemand arbeitet mehr an der Datei. Umsetzung: eine echte, exportierte Fehlerklasse in oauth.ts oder die Wiederverwendung der passenden aus rest.ts, geprueft per instanceof wie rest.ts es schon vormacht; bei drohender Ringabhaengigkeit in eine dritte gemeinsame Datei. Grund: Fehlermeldungen werden laufend umformuliert, weil Nutzer sie lesen — haengt Logik daran, bricht sie lautlos weg, und wir haetten genau den Befund zurueck, den diese Runde beheben sollte. Kosten wenn falsch: eine Fehlerklasse mehr im Projekt.

## 57

Ich habe docs/UEBERGABE.md geschrieben und committet. Die Anleitungen fuer Jans drei manuelle Schritte standen bisher nur in den Agentenberichten unter .superpowers/, das am Ende geloescht wird — sie waeren mit dem Arbeitsordner verschwunden. Das Dokument enthaelt zusaetzlich die vollstaendige Liste der unbestaetigten Annahmen mit Fundort und die offene Entscheidung zur Doppel-Vorliebe. Kosten wenn falsch: ein Dokument, das mit dem naechsten Bauabschnitt aktualisiert werden muss.

## 58

Ich verzichte nicht auf dieses Re-Review, obwohl der Fix klein und gut begruendet ist. Grund: eine Aenderung an der sicherheitskritischsten Datei nach deren bestandenem Review ist genau die Situation, in der eine Regression unbemerkt durchgeht. Kosten wenn falsch: ein Review-Durchlauf.

## 59

Das Re-Review von Fix-Runde 2 blieb nach 600 Sekunden ohne Fortschritt haengen (Drosselung im Sparmodus). Statt es neu zu dispatchen habe ich die vier sicherheitsrelevanten Eigenschaften von oauth.ts selbst nachgeprueft, weil es ein enger, mechanisch pruefbarer Auftrag war: Single-Flight (laufendeErneuerung wird in .finally() immer geleert, Zeile 350), Verwerfungsregel (ablageVerwerfen nur bei Status 400 oder 401, Zeile 319 — Netzwerkfehler und 5xx fallen daran vorbei), Zeitlimit von fuenf Minuten mit clearTimeout, state als zwingender Parameter mit Vergleich, isMainFrame-Pruefung, und null console-Aufrufe in oauth.ts, rest.ts und fehler.ts. Zusaetzlich das Importdiagramm geprueft: fehler.ts importiert nichts, oauth.ts zeigt auf fehler, rest.ts auf fehler und oauth, websocket.ts auf aufzeichnung und rest — azyklisch. Und den neuen Test gelesen: er ueberschreibt die Nachricht einer echten Instanz mit fremdem Text und prueft, dass die Erkennung greift, mit Kommentar gegen ein spaeteres Zurueckreparieren. Kosten wenn falsch: eine Regression in oauth.ts, die kein zweites Augenpaar gesehen hat — die vier Eigenschaften sind aber mechanisch belegt, nicht eingeschaetzt.

## 60

Das ist der wichtigste Fund des ganzen Durchgangs und rechtfertigt das Abschluss-Review allein. Mein eigenes Uebergabedokument haette Jan in den Verlust gefuehrt. Behoben wird die Verdrahtung, nicht das Dokument abgeschwaecht — der Reviewer hat recht, dass zehn Zeilen billiger sind als die Erklaerung, warum sie fehlen.

## 61

Zu I8: Der Pfad bleibt frei waehlbar — genau das brauchen wir, damit der Mitschnitt als Testfixture ins Repository kommt. Praezisiert wird die Zusage, nicht der Code eingeschraenkt. Kosten wenn falsch: eine Formulierung mehr in den Datenschutzhinweisen.

## 62

Die als "nicht auf dem kritischen Pfad" eingestuften I3, I4 und I5 gehen trotzdem in die Fixwelle. I3 und I4 sind zusammen eine echte Sicherheitsluecke (fremde Seite mit Preload-Bruecke plus ein ungeschuetzter Kanal, der handelt), und beide Fixes sind wenige Zeilen. I5 ist eine ausdrueckliche Forderung aus Abschnitt 14 der Spec. Kosten wenn falsch: eine etwas groessere Fixwelle als noetig.

## 63

minify und die Logo-Groesse bleiben unangetastet. Beide sind bewertet, beide sind lokal geladene Dateien ohne Download, und beide gehoeren zum naechsten Bauabschnitt, wenn der Spectator-Screen das Logo als Bug dazunimmt. Kosten wenn falsch: ein groesserer Installer und etwas Grafikspeicher.

## 64

Das zweite Bedenken des Agenten ist ein Blocker und wird behoben. Schritt 1 der Uebergabe war weiterhin unmoeglich — es gab keinen Weg, anmelden() auszuloesen. Ohne Anmeldung kein Board, ohne Board kein Mitschnitt, ohne Mitschnitt kein Adapter; die gesamte Uebergabe haengt an diesem einen fehlenden Knopf. Der urspruengliche Grund, ihn wegzulassen, ist entfallen: damals importierte src/main/ die Autodarts-Schicht ueberhaupt nicht und ein Kanal ins Leere waere schlimmer gewesen als keiner, seit d889cfb ist die Verdrahtung da. Der Agent hat richtig gehandelt, ihn nicht eigenmaechtig zu bauen. Zusaetzlich verlangt: Re-Entrancy-Schutz in Oberflaeche und in anmelden() selbst, weil der bisher als Kleinigkeit eingestufte fehlende Schutz mit einem echten Aufrufer relevant wird. Kosten wenn falsch: ein Knopf mehr, der ohnehin gebraucht wird.

## 65

Die falsch einsortierten Commit-Inhalte bleiben, wie sie sind. Der Endzustand des Baums ist identisch mit dem einer sauberen Gruppierung, der Inhalt ist in beiden Faellen korrekt und vollstaendig, und der Agent hat es sowohl in der Commit-Nachricht als auch im Bericht offengelegt. Ein Amend haette nur die Erzaehlung im git log geglaettet und dabei Hashes verschoben, auf die dieses Ledger verweist. Kosten wenn falsch: wer spaeter bisected, findet zwei Aenderungen einen Commit frueher als die Nachricht ankuendigt — offengelegt und nachlesbar.

## 66

Die engere Rennen-Variante bei B7 (Schliessen genau waehrend der WebSocket-Handshake-Phase) bleibt offen. Der Re-Reviewer hat sie im Code nachverfolgt: onopen prueft geschlossen nicht, aber der Schreibpfad ist durch das fehlgeschlagen-Kennzeichen abgesichert und ein Schreiben auf einen beendeten Stream loest ein error-Ereignis aus, das behandelt wird, statt synchron zu werfen. Kein Absturz, kein haengendes Beenden, schlimmstenfalls ein verwaister Socket fuer die Restlaufzeit eines ohnehin endenden Prozesses. Kosten wenn falsch: ein Socket, den das Betriebssystem beim Prozessende schliesst.

## 67

Die vom Agenten gemeldeten Bedenken 1 und 2 gehen in eine letzte Runde. Grund ist Konsequenz: Bei laufendeErneuerung habe ich in dieser Session ausdruecklich einen Test verlangt, der beweist dass zwei gleichzeitige Aufrufe nur eine Anfrage ausloesen, und ein Reviewer hat gegengeprueft dass der Test das wirklich leistet statt nur so auszusehen. Fuer die beiden neuen Sperren jetzt einen niedrigeren Massstab anzulegen waere inkonsequent — eine Nebenlaeufigkeitssperre ohne Beweis ist genau die Art Code, die still zurueckfaellt. Zusaetzlich verlangt: ein dritter Aufruf nach Abschluss muss wieder greifen, sonst waere eine haengengebliebene Sperre schlimmer als gar keine und der bestehende Test wuerde es nicht bemerken. Und beim onclose-Test beide Richtungen, sonst bliebe er auch dann gruen, wenn jemand die Zustandsmeldung ganz entfernt. Kosten wenn falsch: zwei Tests mehr.
