// REST-Grundlage fuer die Autodarts-API. Alle Pfade unten sind Praefixe ab
// https://api.autodarts.com; die konkreten Pfade selbst (z.B. /gs/v0/matches)
// liegen bei den Aufrufern. Bestaetigt sind bislang nur die Existenz einiger
// Pfade per eigenem 401-Test (siehe docs/autodarts-api.md, Abschnitt
// "Endpunkt-Existenz, eigener Test") - Rumpf und Antwortform der einzelnen
// Endpunkte sind nicht bestaetigt.

import { zugriffsToken } from './oauth'

const BASIS = 'https://api.autodarts.com'

/**
 * Wird geworfen, wenn der Server mit dem bekannten Autodarts-401-Fehlerrumpf
 * antwortet (siehe istNichtAngemeldet). Eine eigene, erkennbare Fehlerart -
 * das Control-Fenster kann sie per instanceof erkennen und "Bitte erneut
 * anmelden" zeigen, statt eine rohe HTTP-Meldung durchzureichen.
 */
export class NichtAngemeldetFehler extends Error {
  constructor() {
    super('Bitte erneut anmelden')
    this.name = 'NichtAngemeldetFehler'
  }
}

/**
 * Reine Erkennung des Autodarts-401-Fehlerrumpfs, eigener Test 2026-09-09:
 * {"statusCode":401,"error":{"status":401,"code":"unauthorized","message":"unauthorized"}}
 * Nur ein 401 mit genau dieser Struktur gilt als "nicht angemeldet" - ein
 * 401 mit abweichendem Rumpf (z.B. eine andere API) faellt bewusst nicht
 * darunter, ein 500er nie, ein Rumpf ohne diese Form (auch null) ebenfalls
 * nicht.
 */
export function istNichtAngemeldet(status: number, rumpf: unknown): boolean {
  if (status !== 401) return false
  if (typeof rumpf !== 'object' || rumpf === null) return false

  const wurzel = rumpf as Record<string, unknown>
  if (wurzel.statusCode !== 401) return false

  if (typeof wurzel.error !== 'object' || wurzel.error === null) return false
  const fehler = wurzel.error as Record<string, unknown>
  return fehler.status === 401 && fehler.code === 'unauthorized'
}

async function anfrage<T>(pfad: string, init: RequestInit = {}): Promise<T> {
  const token = await zugriffsToken()
  const antwort = await fetch(`${BASIS}${pfad}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!antwort.ok) {
    // Rumpf lesen, um zwischen "nicht angemeldet" und anderen Fehlern zu
    // unterscheiden - misslingt das Lesen/Parsen (z.B. leerer Rumpf), gilt
    // der Fehler als "nicht die bekannte 401-Form" statt die eigentliche
    // Fehlerbehandlung selbst zum Absturz zu bringen.
    const rumpf = await antwort.json().catch(() => null)
    if (istNichtAngemeldet(antwort.status, rumpf)) {
      throw new NichtAngemeldetFehler()
    }
    throw new Error(`${init.method ?? 'GET'} ${pfad} -> HTTP ${antwort.status}`)
  }
  return (await antwort.json()) as T
}

export const holen = <T>(pfad: string): Promise<T> => anfrage<T>(pfad)

export const senden = <T>(pfad: string, koerper: unknown): Promise<T> =>
  anfrage<T>(pfad, { method: 'POST', body: JSON.stringify(koerper) })
