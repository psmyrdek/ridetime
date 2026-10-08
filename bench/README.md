# Benchmark stylów komunikacji agentów

Czy styl, w jakim agent AI „mówi”, zmienia koszt i jakość pracy? Benchmark porównuje buildery, które dostają to
samo zadanie i różnią się tylko instrukcją stylu:

| Ramię          | Instrukcja                                                                                    |
| :------------- | :-------------------------------------------------------------------------------------------- |
| `control`      | brak, zwykły agent (punkt odniesienia)                                                        |
| `caveman`      | skill [caveman](https://github.com/JuliusBrussee/caveman): zwięzła proza bez ozdobników       |
| `rtk`          | [RTK](https://github.com/rtk-ai/rtk): binarka kompresująca wyjście komend + hook `PreToolUse` |
| `ste`          | skill [simple-english](https://github.com/aminblg/simpleenglish), czyli ASD-STE100            |
| `rtk-emulated` | reguły RTK stosowane przez agenta ręcznie; tylko gdy binarki nie da się uruchomić             |

Wersje skilli są przypięte po SHA w `styles/sources.json`. Wyniki `rtk-emulated` mierzą agenta, który naśladuje RTK,
a nie samo RTK, więc raportuj je osobno.

## Pilot (n=1, 2026-10-07)

Zadanie `tasks/filmy.md`, jeden przebieg na ramię, buildery jako subagenty, bez ramienia kontrolnego, RTK emulowane.
Kolumna e2e pochodzi z wcześniejszej wersji testu (18 kontroli, wartości wpisane na sztywno).

| Ramię        | Wywołania API | Tokeny wejścia łącznie | Wyjście komend (znaki) |  Czas | e2e   | Ślepa recenzja |
| :----------- | ------------: | ---------------------: | ---------------------: | ----: | :---- | -------------: |
| caveman      |            16 |                  1005k |                    36k | 153 s | 18/18 |            7.0 |
| rtk-emulated |            13 |                   735k |                    22k | 117 s | 18/18 |            8.5 |
| ste          |            14 |                   878k |                    40k | 144 s | 18/18 |            7.5 |

Wniosek wstępny: proza agenta to mniej niż 4% tego, co produkuje (resztę stanowi kod), więc styl wypowiedzi prawie
nie wpływa na koszt. Liczy się liczba tur i wielkość wyjścia komend, które agent czyta przy każdej kolejnej turze.
Przy n=1 to tylko hipoteza. Ten katalog służy do jej sprawdzenia.

## Protokół

1. **Ustal parametry przed startem i nie zmieniaj ich w trakcie serii:**
   - `BASE_SHA`, `MODEL` i metryka główna (domyślnie `cost_usd`).
   - N = 8 przebiegów na ramię (minimum 5). Przy rozrzucie ~15% pozwala to wykryć różnicę ~20%.
   - Co najmniej 2 zadania, żeby wynik nie zależał od jednej funkcji.
   - Gdy zmienisz prompt lub narzędzie, zacznij serię od nowa.
2. **Każdy przebieg to osobny proces `claude -p` we własnym worktree,** a nie subagent. Ramię `rtk` dostaje swój hook
   przez `--settings`, a tokeny i koszt pochodzą z końcowego eventu `result`.
3. **Partie:** jedna partia to po jednym przebiegu każdego ramienia. Wszystkie startują jednocześnie, w kolejności
   losowanej z zapisanym ziarnem. Dzięki temu obciążenie API jest takie samo dla wszystkich ramion.
4. **Porażki zostają w danych.** Powtarzaj tylko przebiegi przerwane przez infrastrukturę (sieć, limit) i oznacz je
   w `manifest.jsonl`.
5. **Ślepa recenzja:**
   - Losowe etykiety w każdej partii, 2 recenzentów w osobnych sesjach, prompt z `tasks/review.md`.
   - Przy rozbieżności powyżej 2 punktów dołóż trzeciego recenzenta.
   - Recenzent nie może widzieć `results/blind-keys/`.
6. **Wniosek** „X oszczędza” tylko wtedy, gdy przedział ufności różnicy względem `control` nie obejmuje zera,
   Holm daje p < 0.05, a efekt powtarza się w każdym zadaniu.

## Uruchomienie

Wymagania: `claude` (zalogowany), `jq`, `git`, `node`, `python3`, Playwright z Chromium (globalnie albo przez
`PLAYWRIGHT_MODULE`), dla ramienia `rtk` binarka `rtk` >= 0.23 w `PATH`. Buildery dostają pełny dostęp do Basha
we własnym worktree, więc uruchamiaj benchmark w kontenerze albo na maszynie do testów.

```bash
bench/styles/fetch.sh                                   # pobiera przypięte skille do styles/.cache/
export BASE_SHA=$(git rev-parse HEAD) MODEL=<model>

for b in 1 2 3 4 5 6 7 8; do
  bench/run-batch.sh filmy $b                           # control caveman rtk ste, równolegle
  bench/score.sh filmy $b                               # check, build, prettier, e2e, payload -> runs.csv
  python3 bench/tools/blind.py filmy $b                 # anonimowe diffy do results/blind/filmy-b$b/
done

# recenzje: prompt z tasks/review.md, wyniki dopisz do results/reviews.csv
# (nagłówek: task,batch,label,reviewer,score)
python3 bench/tools/analyze.py                          # -> results/report.md
```

Worktree powstają w `../ridetime-bench` (zmienisz to przez `BENCH_WORKDIR`). Po zakończonej serii usuń je przez
`git worktree remove`, a gałęzie `bench/*` przez `git branch -D`.

## Pliki

| Plik                   | Rola                                                                                   |
| :--------------------- | :------------------------------------------------------------------------------------- |
| `tasks/<task>.md`      | spec zadania; zadanie `<task>` buduje stronę `/<task>`                                 |
| `tasks/<task>.e2e.mjs` | test e2e (Playwright); oczekiwane wartości liczy z `src/data/*.json` danego worktree   |
| `tasks/review.md`      | prompt dla ślepego recenzenta                                                          |
| `styles/`              | instrukcje stylów, przypięte źródła, `fetch.sh`, hook RTK                              |
| `run-batch.sh`         | jedna partia: worktree + `claude -p` dla każdego ramienia                              |
| `score.sh`             | ocena partii, dopisuje wiersze do `results/runs.csv`                                   |
| `tools/collect.py`     | tokeny, koszt, tury i znaki z wyjścia `stream-json`                                    |
| `tools/blind.py`       | anonimizacja diffów i klucz etykiet                                                    |
| `tools/analyze.py`     | mediany, bootstrap CI, Kruskal-Wallis, Mann-Whitney + Holm, delta Cliffa, test Fishera |

`analyze.py` korzysta tylko z biblioteki standardowej. Testy statystyczne sprawdzono na wartościach referencyjnych
ze scipy.
