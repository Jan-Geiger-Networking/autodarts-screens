// Liest die OpenID-Konfiguration von Autodarts und gibt sie lesbar aus.
// Aufruf: node werkzeuge/erkundung-oauth.mjs
//
// Hinweis: In manchen Umgebungen (z. B. Shells ohne Netzzugriff) liefert
// dieses Skript fuer jede Adresse einen Fehler. Das ist kein Bug im Skript,
// sondern eine Eigenschaft der Umgebung. Es laeuft in dem Fall trotzdem
// sauber durch und meldet jeden Fehlschlag mit der echten Fehlermeldung.

const kandidaten = [
  // Aus dem Task-Brief vorgegeben:
  'https://login.autodarts.com/realms/autodarts/.well-known/openid-configuration',
  'https://login.autodarts.io/realms/autodarts/.well-known/openid-configuration',
  // Weitere plausible Adressen (Recherche):
  // autodarts.io ist die tatsaechlich existierende Domain (autodarts.com loest nicht auf).
  // Keycloak-Realms sind unter verschiedenen Pfaden ueblich, daher testen wir Varianten.
  'https://login.autodarts.io/.well-known/openid-configuration',
  'https://login.autodarts.io/realms/autodarts',
  'https://auth.autodarts.io/realms/autodarts/.well-known/openid-configuration',
  'https://api.autodarts.io/.well-known/openid-configuration',
  // Direkter Treffer: die Domain aus dem gefundenen "issuer"-Feld.
  'https://api.autodarts.com/.well-known/openid-configuration',
]

for (const url of kandidaten) {
  try {
    const antwort = await fetch(url)
    if (!antwort.ok) {
      console.log(`${url} -> HTTP ${antwort.status}`)
      continue
    }
    const k = await antwort.json()
    console.log(`\nGefunden: ${url}`)
    console.log('issuer:                ', k.issuer)
    console.log('authorization_endpoint:', k.authorization_endpoint)
    console.log('token_endpoint:        ', k.token_endpoint)
    console.log('end_session_endpoint:  ', k.end_session_endpoint)
    console.log('revocation_endpoint:   ', k.revocation_endpoint)
    console.log('userinfo_endpoint:     ', k.userinfo_endpoint)
    console.log('jwks_uri:              ', k.jwks_uri)
    console.log('device_auth_endpoint:  ', k.device_authorization_endpoint)
    console.log('providers_supported:   ', k.providers_supported)
    console.log('code_challenge_methods:', k.code_challenge_methods_supported)
    console.log('grant_types_supported: ', k.grant_types_supported)
    console.log('scopes_supported:      ', k.scopes_supported)
    console.log('token_endpoint_auth:   ', k.token_endpoint_auth_methods_supported)
  } catch (fehler) {
    console.log(`${url} -> ${fehler.message}`)
  }
}
