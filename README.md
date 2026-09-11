# Autodarts Dual-Screen

Zwei Vollbildschirme für Autodarts-Matches: Spielerinfo neben der Scheibe,
Broadcast-Ansicht für Zuschauer.

## Installation

Der Installer liegt als `autodarts-screens-Setup-<Version>.exe` bei den
[GitHub Releases](https://github.com/Jan-Geiger-Networking/autodarts-screens/releases)
dieses Repositories. Er installiert pro Benutzerkonto (kein Administratorrecht
nötig) und legt eine Verknüpfung im Startmenü und auf dem Desktop an.

Der Installer ist derzeit unsigniert — das ist eine bewusste Entscheidung,
kein Versehen (kein Zertifikat, siehe Spezifikation). Windows SmartScreen
zeigt beim ersten Start eine Warnung an ("Der Computer wurde durch Windows
geschützt"). Über „Weitere Informationen" und „Trotzdem ausführen" lässt sich
die Installation fortsetzen. Das erscheint nur beim ersten Start.

Die Anwendung aktualisiert sich selbst über die GitHub-Releases. Im
Control-Fenster steht unter „Aktualisierung", ob Beta-Versionen angeboten
werden sollen; installiert wird nie mitten in einem laufenden Match.

## Matchtag

Für einen Turnierabend, an dem mehrere Leute jeder gegen jeden im Einzel
spielen:

1. Im Control-Fenster unter „Matchtag" einen Namen eingeben und **Matchtag
   starten**.
2. In Autodarts ein Match mit **allen Teilnehmern** spielen. Das ist die
   Aufwärmrunde — daraus entstehen die Spielerliste und der Spielplan; das
   Average aus der Runde setzt die Reihenfolge.
3. Danach zeigt der Zuschauer-Screen in jeder Pause, welche Partie als
   nächstes einzurichten ist, dazu Tabelle, Spielplan und die Zahlen des
   Abends. Dieselbe Paarung steht auch im Control-Fenster.
4. Jede gespielte 1-gegen-1-Partie trägt sich von allein ein — ein Sieg gibt
   einen Punkt. Zugeordnet wird über die Spielernamen.
5. Haben am Ende mehrere dieselbe Punktzahl, setzt die Anwendung ein
   **Stechen** an: die Gleichauf-Spieler spielen es untereinander aus.

Im **Hütten-Modus** folgen auf die Gruppenrunde zwei Endspiele: Erster gegen
Zweiten um Platz 1, Dritter gegen Vierten um Platz 3. Die gesammelten Punkte
setzen dort nur die Reihenfolge — entschieden wird auf der Scheibe.

Über jeder Pausenfolie steht der Weg durch den Abend als Linie, die sich
Partie für Partie füllt (Aufwärmen · Hauptrunde · Entscheidung bzw. Finale),
darunter die nächste Paarung. Ein grüner Balken am unteren Rand zeigt, wann
umgeblättert wird. Zu den Folien gehören Tabelle, Spielplan, Zahlen des
Abends, eine Spieleranalyse und die Heatmaps aller Spieler. Ist der Abend
entschieden, bleibt der Endstand mit hervorgehobenem Sieger stehen, bis ein
neues Match beginnt.

Der Stand liegt lokal in `matchtag.json` im Benutzerprofil und übersteht
einen Neustart mitten im Turnier. Läuft eine Partie versehentlich falsch,
öffnet **Letztes Ergebnis zurücknehmen** sie wieder.

## Autostart

Unter „Screens" lässt sich einstellen, dass die Anwendung beim Anmelden am
Rechner automatisch startet. Sie öffnet dann die Screens wieder, die beim
letzten Beenden offen waren, auf denselben Monitoren. Ist ein Monitor noch
aus, wartet sie und legt den Screen darauf, sobald er sich meldet.

## Unterstützung

Sicherheitsaktualisierungen werden für 36 Monate ab dem jeweiligen Release
bereitgestellt.

## Lizenz

MIT, siehe [LICENSE](LICENSE).

## Sicherheit und Datenschutz

Hinweise zum Melden von Schwachstellen stehen in [SECURITY.md](SECURITY.md),
Angaben zur Datenverarbeitung in [PRIVACY.md](PRIVACY.md).

## Anbieterkennzeichnung

Angaben gemäß § 5 DDG

Jan Geiger Networking, Inhaber Jan Geiger
Dorfstr. 10A, 32107 Bad Salzuflen, Nordrhein-Westfalen, Deutschland

E-Mail: hey@bsbnet.eu
Telefon: +49 5222 9179070
Web: https://jgnet.eu

Rechtsform: Einzelunternehmen / Kleingewerbe
Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer-Identifikationsnummer
Aufsichtsbehörde: Gewerbeamt der Stadt Bad Salzuflen,
Rudolph-Brandes-Allee 19, 32105 Bad Salzuflen

## Streitbeilegung

Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
bereit: https://ec.europa.eu/consumers/odr

Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor
einer Verbraucherschlichtungsstelle teilzunehmen.
