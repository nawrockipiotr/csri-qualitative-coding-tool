# Qualitative Coding Tool

Narzędzie do kodowania jakościowego danych tekstowych z metodologią Gioia. Cztery tryby kodowania, wsparcie AI, eksport do JSON/CSV/Markdown. Dane pozostają w przeglądarce — żaden serwer nie jest potrzebny.

**Demo:** [nawrockipiotr.github.io/csri-qualitative-coding-tool](https://nawrockipiotr.github.io/csri-qualitative-coding-tool/)

## Funkcje

**Tryby kodowania:** indukcyjny (badacz sam), kontrpropozycja (badacz + alternatywa AI), asystowany (AI proponuje, badacz decyduje), automatyczny (pełny 5-fazowy pipeline AI z przeglądem wyników).

**Pipeline automatyczny (5 faz):**
1. Kodowanie z oknem kontekstowym — AI widzi sąsiednie segmenty.
2. Constant comparison — drift check co N segmentów (batch size konfigurowalny).
3. Wieloprzebiegowe tematy — generowanie, krytyka, rewizja (temperature=0).
4. Pętla abdukcyjna — re-kodowanie w świetle tematów.
5. Wymiary zagregowane z uzasadnieniem teoretycznym (teoria, autor, grounding).

**Dostawcy AI:** Anthropic (Claude Haiku/Sonnet), OpenAI (GPT-4o mini/4o), Google (Gemini Flash/Pro), lokalny model (Ollama, LM Studio — API kompatybilne z OpenAI).

**Import danych:** drag & drop wielu plików (TXT, JSON, CSV, DOCX), wklejanie tekstu, auto-detekcja tur mówców, merge/replace przy doimporcie. Typy źródła: wywiad, fokus, obserwacja, dokument, ankieta (otwarte), social media, audio/wideo.

**Eksport:** JSON (pełny z metadanymi), CSV (MAXQDA/NVivo), tabela Gioia (Markdown), raport kodowania, eksport codebooka (CSV). Szybki eksport CSV/JSON dostępny z widoku kodowania.

**Analiza wstępna:** briefing przed kodowaniem — statystyki segmentów, sugestie trybu i batch size, ostrzeżenia o zbyt krótkich/długich segmentach.

**Jakość kodowania:** brama saturacji, batch drift check (constant comparison) z akcjami recode/dismiss, konsolidacja kodów (sugestie AI z przyciskami Apply/Dismiss), filtrowanie false-positive drift, filtrowanie i eksport codebooka.

**UX:** undo (Ctrl+Z, stos 20 akcji), skróty klawiszowe (← → nawigacja), potwierdzenie przed nadpisaniem tematów/wymiarów (z hintem o porównywaniu wariantów), szacunek kosztów API, dark mode, i18n PL/EN, sesja zapisywana w localStorage z ostrzeżeniem przy przekroczeniu 4 MB, kontekstowe wskazówki przy polach konfiguracji, infoboxy (Gioia, tryby, import, eksport, zapis sesji).

## Architektura

Czyste HTML/JS/CSS, bez frameworków, bez kroku budowania. Pliki:

```
index.html          — struktura strony
css/style.css       — stylowanie + dark mode
js/app.js           — logika aplikacji, stan, renderowanie
js/api.js           — warstwa API (Anthropic, OpenAI, Google, Local)
js/prompts.js       — szablony promptów AI z wymuszeniem języka (langRule)
js/i18n.js          — tłumaczenia PL/EN
js/export.js        — eksport JSON/CSV/Gioia/raport
```

## Uruchomienie

Otwórz `index.html` w przeglądarce. Żadna instalacja nie jest potrzebna.

Dla modeli lokalnych (Ollama/LM Studio) — uruchom serwer z API kompatybilnym z OpenAI i podaj endpoint w konfiguracji.

## Wymuszenie języka w AI

Prompty zawierają instrukcję `langRule()` — jawne, twarde wymaganie języka wyjścia (np. "CRITICAL: All output MUST be in Polish. Do NOT use English, Russian, Ukrainian, or any other language."). Temperature=0 dla operacji strukturalnych (tematy, wymiary) zapewnia powtarzalność wyników.

## Licencja

Centre for Socially Responsible Innovations (CSRI), Wydział Zarządzania, Uniwersytet Warszawski.
