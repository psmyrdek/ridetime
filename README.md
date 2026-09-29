# ridetime

Strona kanału [RideTime](https://www.youtube.com/@RideTimePL): najnowsze filmy, Shorts i statystyki ze Stravy.

Astro 7 + Svelte 5 + Tailwind 4, deploy na Vercel.

## Komendy

| Komenda                 | Opis                                                   |
| :---------------------- | :----------------------------------------------------- |
| `npm install`           | Instalacja zależności                                  |
| `npm run dev`           | Serwer deweloperski na `localhost:3000`                |
| `npm run build`         | `astro check` + build produkcyjny                      |
| `npm run fetch:youtube` | Odświeża `src/data/youtube.json` z feedów RSS YouTube  |
| `npm run fetch:strava`  | Odświeża `src/data/strava.json` ze Strava API          |
| `npm run strava:auth`   | Jednorazowa autoryzacja Stravy, wypisuje refresh token |

## Dane z YouTube i Stravy

Filmy i statystyki nie są pobierane w trakcie builda. Workflow `.github/workflows/feeds.yml` raz dziennie (05:00 UTC,
lub ręcznie przez _Run workflow_) uruchamia `scripts/fetch-youtube.ts`, który czyta publiczne feedy RSS playlist
kanału (`UULF…` - filmy, `UUSH…` - Shorts), dokleja nowe pozycje do `src/data/youtube.json` i commituje zmiany.
Push na `master` uruchamia deploy na Vercelu. Nie jest potrzebny klucz API.

Statystyki Stravy (`scripts/fetch-strava.ts`) pobierane są w tym samym workflow. Sekrety repo:

- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` - z aplikacji na https://www.strava.com/settings/api
  (Authorization Callback Domain: `localhost`)
- `STRAVA_REFRESH_TOKEN` - z `STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=… npm run strava:auth`
- `SECRETS_PAT` - fine-grained PAT dla tego repo z uprawnieniem _Secrets: Read and write_. Strava może wydać nowy
  refresh token i unieważnić stary - workflow zapisuje wtedy nowy token do `STRAVA_REFRESH_TOKEN`.

Bez sekretów Stravy krok jest pomijany, a strona pokazuje ostatnie zapisane dane.
