// Gemeinsamer Fehlertyp fuer "der Nutzer muss sich erneut bei Autodarts
// anmelden". Lebt in einer eigenen Datei statt in oauth.ts oder rest.ts:
// beide werfen ihn (oauth.ts bei einer lokal endgueltig gescheiterten
// Token-Erneuerung, rest.ts beim bestaetigten 401-Fehlerrumpf des Servers),
// und rest.ts importiert bereits zugriffsToken() aus oauth.ts - wuerde die
// Klasse in einer der beiden Dateien liegen, muesste die andere von ihr
// importieren und eine Ringabhaengigkeit entstehen.

/**
 * Eine eigene, per instanceof erkennbare Fehlerart - Aufrufer (z.B.
 * websocket.ts) sollen auf den Typ pruefen, nicht auf den Nachrichtentext.
 * Der Text ist fuer Menschen gedacht (das Control-Fenster kann ihn direkt
 * anzeigen) und darf sich jederzeit aendern, ohne dass irgendeine Logik
 * davon abhaengt.
 */
export class NichtAngemeldetFehler extends Error {
  constructor() {
    super('Bitte erneut anmelden')
    this.name = 'NichtAngemeldetFehler'
  }
}
