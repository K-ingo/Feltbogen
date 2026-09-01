# syntax=docker/dockerfile:1

# Feltbogen bygges til statiske filer og serveres af Caddy, som samtidig er
# appens vej ind til PocketBase over Railways private netværk. Se Caddyfile.

FROM node:22-alpine AS byg
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Versionslinjen på indstillingsskærmen kommer herfra. `git rev-parse` kan
# ikke bruges i en Docker-build — .git følger ikke med ind i konteksten — så
# sha'en gives med udefra. Kommer den ikke, står der "ukendt"; appen virker,
# man kan bare ikke se hvilken udgave der kører.
ARG RAILWAY_GIT_COMMIT_SHA=""
ENV RAILWAY_GIT_COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA

# VITE_PB_URL sættes med vilje ikke her. Appen taler med sit eget domæne, og
# Caddy sender /api/ videre. Bages en adresse ind her, er den bundet til
# bundlen for altid — og bages det private domæne ind, kan ingen browser i
# verden slå det op.
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=byg /app/dist /srv

# Skrives eksplicit frem for at læne sig op ad imagets standard: den her linje
# er også dokumentationen for, hvor konfigurationen bliver læst fra.
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
