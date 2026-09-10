# Datenschutzerklärung

## 1. Verantwortliche Stelle

Jan Geiger Networking, Inhaber Jan Geiger
Dorfstr. 10A, 32107 Bad Salzuflen, Nordrhein-Westfalen, Deutschland

E-Mail: hey@bsbnet.eu
Telefon: +49 5222 9179070

## 2. Welche Daten verarbeitet werden

Zugangsdaten nimmt die Anwendung nicht entgegen, die Anmeldung erfolgt auf der
Autodarts-Seite im eingebetteten Fenster. Der Aktualisierungs-Token liegt
lokal und verschlüsselt.

Spielernamen, Anzeigenamen, Fotos und Ländercodes werden nur verarbeitet,
soweit sie selbst eingetragen wurden.

Match-Ereignisse werden während des Spiels verarbeitet und nur bei
eingeschalteter Aufzeichnung gespeichert.

Wird ein **Matchtag** gestartet, speichert die Anwendung die Namen der
Teilnehmer sowie deren Ergebnisse und Spielwerte (Legs, Average, 180er,
höchstes Finish) lokal in `matchtag.json`. Die Namen stammen aus den
gespielten Autodarts-Matches. Der Stand bleibt liegen, bis der Matchtag
beendet oder „Alle lokalen Daten löschen" ausgeführt wird.

## 3. Wo die Daten liegen

Die Daten liegen standardmäßig ausschließlich lokal unter
`%APPDATA%\autodarts-screens`. Es gibt keinen Server dieser Anwendung.

Startet der Nutzer selbst eine Aufzeichnung mit einem eigenen Dateipfad
(Entwicklungs- und Testfunktion), landet sie dort statt im Standardordner —
weiterhin ausschließlich lokal, nirgends im Netz.

## 4. Übermittlung an Dritte

An Autodarts gehen die zur Anmeldung und zum Abruf nötigen Anfragen. Darüber
hinaus findet keine Übermittlung statt, es gibt keine Telemetrie.

Für die Selbstaktualisierung fragt die Anwendung die Releases dieses
Repositories bei GitHub ab und lädt von dort die Installationsdatei. Dabei
werden gegenüber GitHub die technisch unvermeidbaren Verbindungsdaten
sichtbar (IP-Adresse, Zeitpunkt, angefragte Datei). Es werden keine Daten
über den Nutzer oder über gespielte Matches übertragen.

## 5. Rechte

Einsicht und Löschung sind jederzeit selbst möglich, über die Funktion
„Alle lokalen Daten löschen" im Control-Fenster.

Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
Widerspruch können über die oben genannte Adresse geltend gemacht werden.

Es besteht ein Beschwerderecht bei der Landesbeauftragten für Datenschutz
und Informationsfreiheit Nordrhein-Westfalen.
