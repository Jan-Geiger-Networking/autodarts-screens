import { useEffect, useState } from 'react'
import type { MatchState } from '../../shared/typen'

// Vorlaeufige, schlichte Anzeige: gibt den empfangenen MatchState als
// lesbaren Text aus, damit sich ankommende und sich aendernde Zustaende
// erkennen lassen. Das eigentliche Layout entsteht in einer spaeteren Aufgabe.
export function App() {
  const [zustand, setZustand] = useState<MatchState | null>(null)

  useEffect(() => window.app.beiZustand(setZustand), [])

  return (
    <pre style={{ color: '#f8fafc', fontSize: '2vh', whiteSpace: 'pre-wrap', padding: '2vh', margin: 0 }}>
      {zustand ? JSON.stringify(zustand, null, 2) : 'Warte auf Zustand …'}
    </pre>
  )
}
