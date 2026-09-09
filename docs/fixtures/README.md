# Fixtures

| Datei | Herkunft | Verwendung |
|---|---|---|
| `beispiel-wiedergabe.jsonl` | **erfunden**, von Hand geschrieben | Belegt, dass der Wiedergabemodus ohne Netz und ohne Anmeldung läuft. Taugt **nicht** zum Ableiten des API-Schemas und **nicht** als Testgrundlage für den Adapter. |
| `match.jsonl` | echter Mitschnitt eines gespielten Matches, **noch nicht vorhanden** | Einzige Quelle der Wahrheit über das Ereignis-Schema von Autodarts. Grundlage der Adapter-Tests. |

Der Name `match.jsonl` ist für den echten Mitschnitt reserviert. Er entsteht,
indem die Anwendung mit `AD_AUFZEICHNEN=docs/fixtures/match.jsonl` gestartet
und ein vollständiges Leg gespielt wird — mit mindestens einem Bust und einem
Spielerwechsel, damit die Fälle abgedeckt sind.

Erfundene Ereignisse dürfen niemals unter diesem Namen liegen. Ein Adapter,
der gegen selbst erfundene Daten grün ist, sagt nichts darüber aus, ob er die
echte API versteht.
