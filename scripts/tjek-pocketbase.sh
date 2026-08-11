#!/usr/bin/env bash
#
# Tjekker at PocketBase ikke lukker fremmede ind.
#
#   ./scripts/tjek-pocketbase.sh https://din-server.dk
#
# Prøven kalder som en helt uindlogget fremmed. Den skriver ikke noget og
# ændrer ikke noget — den henter kun og kigger på svaret.
#
# Sådan læses svaret:
#
#   200 + tom liste   Reglen gør sit arbejde. En regel i PocketBase er et
#                     filter og ikke en dør: en uindlogget kalder matcher
#                     ingen rækker, så listen er tom. Det er det rigtige.
#
#   200 + rækker      Regelfeltet står tomt. Alle på internettet kan læse
#                     samlingen. Det er den farlige.
#
#   403               Samlingen er låst til superusers. Sikkert nok, men
#                     appen kan heller ikke bruge den.

set -uo pipefail

SERVER="${1:-${VITE_PB_URL:-}}"

if [ -z "$SERVER" ]; then
  echo "Brug: $0 https://din-server.dk"
  echo "  (eller sæt VITE_PB_URL)"
  exit 64
fi

SERVER="${SERVER%/}"

# turdeltagelse er med, fordi den er den eneste samling der med vilje kan
# læses af andre end ejeren — og derfor den nemmeste at få gjort for åben.
SAMLINGER="items grupper ture steder personer turdeltagelse"

fejl=0
advarsler=0

echo "Kalder $SERVER som uindlogget fremmed"
echo

for samling in $SAMLINGER; do
  svar=$(curl -sS -m 15 -w '\n%{http_code}' \
    "$SERVER/api/collections/$samling/records?perPage=1" 2>/dev/null)

  if [ $? -ne 0 ]; then
    printf '  %-16s kunne ikke nås\n' "$samling"
    advarsler=$((advarsler + 1))
    continue
  fi

  kode=$(printf '%s' "$svar" | tail -n1)
  krop=$(printf '%s' "$svar" | sed '$d')
  antal=$(printf '%s' "$krop" | grep -o '"totalItems":[0-9]*' | head -n1 | cut -d: -f2)

  case "$kode" in
    200)
      if [ "${antal:-0}" -gt 0 ]; then
        printf '  %-16s ÅBEN — %s rækker kan læses af hvem som helst\n' "$samling" "$antal"
        fejl=$((fejl + 1))
      else
        printf '  %-16s ok\n' "$samling"
      fi
      ;;
    403)
      printf '  %-16s låst til superusers — appen kan ikke bruge den\n' "$samling"
      advarsler=$((advarsler + 1))
      ;;
    404)
      printf '  %-16s findes ikke\n' "$samling"
      advarsler=$((advarsler + 1))
      ;;
    *)
      printf '  %-16s uventet svar: HTTP %s\n' "$samling" "$kode"
      advarsler=$((advarsler + 1))
      ;;
  esac
done

echo
if [ "$fejl" -gt 0 ]; then
  echo "$fejl samling(er) er åbne for alle. Sæt reglerne til user = @request.auth.id."
  exit 1
fi

if [ "$advarsler" -gt 0 ]; then
  echo "$advarsler samling(er) svarede uventet. Se listen ovenfor."
  exit 2
fi

echo "Ingen af samlingerne udleverer data til en fremmed."
echo
echo "Prøven dækker kun læsning. Skrivereglerne (Create, Update, Delete) skal"
echo "ses efter i hånden — de skal alle stå som user = @request.auth.id."
