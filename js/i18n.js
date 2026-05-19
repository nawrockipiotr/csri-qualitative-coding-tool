// ─── Qualitative Coding Tool v0.1 — i18n ───

let currentLang = localStorage.getItem('coding_tool_lang') || 'pl';

const I18N = {
  // Hero
  hero_lead: {
    pl: 'Narzędzie do kodowania jakościowego danych tekstowych z metodologią Gioia. Cztery tryby kodowania, wsparcie AI (kontrpropozycje, tryb asystowany, pełna automatyzacja), eksport do JSON/CSV/Markdown. Dane pozostają w przeglądarce — żaden serwer nie jest potrzebny.',
    en: 'A qualitative coding tool for textual data using the Gioia methodology. Four coding modes, AI support (counter-proposals, assisted mode, full automation), export to JSON/CSV/Markdown. Data stays in your browser — no server required.'
  },
  hero_howto_title: {
    pl: 'Jak korzystać z narzędzia',
    en: 'How to use this tool'
  },
  hero_howto_hide: {
    pl: '(kliknij, aby ukryć)',
    en: '(click to hide)'
  },
  howto_step1: {
    pl: 'Wklej klucz API wybranego dostawcy AI (Anthropic, OpenAI, Google) lub połącz z lokalnym modelem.',
    en: 'Paste your API key from the selected AI provider (Anthropic, OpenAI, Google) or connect a local model server.'
  },
  howto_step2: {
    pl: 'Przeciągnij pliki (TXT, JSON, CSV, DOCX) lub wklej tekst. Możesz załadować wiele plików naraz — zostaną połączone w jedną pulę segmentów.',
    en: 'Drag & drop files (TXT, JSON, CSV, DOCX) or paste text. You can load multiple files at once — they will be merged into a single segment pool.'
  },
  howto_step3: {
    pl: 'Koduj segment po segmencie. W trybie indukcyjnym kodujesz sam, w pozostałych AI wspiera Twoje decyzje.',
    en: 'Code segment by segment. In inductive mode you code independently; in other modes AI supports your decisions.'
  },
  howto_step4: {
    pl: 'Zarządzaj codebookiem, buduj tematy 2nd-order i wymiary. Eksportuj do JSON, CSV lub tabeli Gioia.',
    en: 'Manage your codebook, build 2nd-order themes and dimensions. Export to JSON, CSV, or Gioia table.'
  },

  // Info toggles
  info_inductive: { pl: 'Tryb indukcyjny', en: 'Inductive mode' },
  info_counter: { pl: 'Kontrpropozycja', en: 'Counter-proposal' },
  info_assisted: { pl: 'Tryb asystowany', en: 'Assisted mode' },
  info_gioia: { pl: 'Metodologia Gioia', en: 'Gioia methodology' },
  info_auto: { pl: 'Tryb automatyczny', en: 'Automatic mode' },
  info_auto_text: {
    pl: 'Pełny pipeline automatyczny w 5 fazach: (1) kodowanie z oknem kontekstowym (AI widzi sąsiednie segmenty), (2) constant comparison co 10 segmentów (drift check), (3) wieloprzebiegowe tematy (generowanie → krytyka → rewizja), (4) pętla abdukcyjna (re-kodowanie w świetle tematów), (5) wymiary z uzasadnieniem teoretycznym. Brama saturacji ostrzega, gdy nowe kody pojawiają się zbyt szybko. Badacz koryguje wyniki w tabeli przeglądu.',
    en: 'Full automatic pipeline in 5 phases: (1) coding with context window (AI sees adjacent segments), (2) constant comparison every 10 segments (drift check), (3) multi-pass themes (generate → critique → revise), (4) abduction loop (re-coding in light of themes), (5) theoretically grounded dimensions. Saturation gate warns when new codes appear too rapidly. Researcher reviews and corrects results.'
  },
  info_import: { pl: 'Import danych', en: 'Data import' },
  info_import_text: {
    pl: 'Przeciągnij pliki (TXT, JSON, CSV, DOCX) lub wklej tekst. Wiele plików tworzy wspólną pulę segmentów — każdy segment zachowuje oznaczenie pliku źródłowego. TXT: auto-detekcja tur mówców (Imię: tekst) lub podział na akapity. JSON: natywny format QCT lub dowolna tablica obiektów. CSV: automatyczne rozpoznanie kolumn (text/author/id). DOCX: ekstrakcja tekstu, segmentacja jak TXT. Przy imporcie do istniejącej sesji wybierasz: dodaj do puli (merge) lub zastąp.',
    en: 'Drag & drop files (TXT, JSON, CSV, DOCX) or paste text. Multiple files create a shared segment pool — each segment retains its source file label. TXT: auto-detects speaker turns (Name: text) or splits by paragraphs. JSON: native QCT format or any object array. CSV: auto-detects columns (text/author/id). DOCX: text extraction, segmented like TXT. When importing into an existing session, choose: add to pool (merge) or replace.'
  },
  info_export: { pl: 'Eksport', en: 'Export' },

  info_inductive_text: {
    pl: 'Badacz koduje samodzielnie. Pełna kontrola nad procesem — AI nie ingeruje. Sugerowany jako punkt wyjścia, zwłaszcza dla doświadczonych koderów.',
    en: 'The researcher codes independently. Full control over the process — AI does not intervene. Recommended as a starting point, especially for experienced coders.'
  },
  info_counter_text: {
    pl: 'Badacz najpierw nadaje własny kod, potem AI proponuje alternatywę. Decyzja zawsze po stronie badacza: mój kod, propozycja AI, lub zmodyfikowany. Wymusza refleksję nad własnymi wyborami.',
    en: 'The researcher first assigns their own code, then AI proposes an alternative. Decision always rests with the researcher: my code, AI proposal, or modified. Forces reflection on your own choices.'
  },
  info_assisted_text: {
    pl: 'AI proponuje kod dla każdego segmentu. Badacz akceptuje, modyfikuje lub odrzuca. Przydatne przy dużych zbiorach danych lub kodowaniu dedukcyjnym z ramą pojęciową.',
    en: 'AI proposes a code for each segment. The researcher accepts, modifies, or rejects. Useful for large datasets or deductive coding with a conceptual framework.'
  },
  info_gioia_text: {
    pl: 'Trzypoziomowa struktura: first-order concepts (kody empiryczne, 15–25) → second-order themes (kategorie teoretyczne, 4–8) → aggregate dimensions (wymiary zagregowane, 2–4). Każdy temat powinien grupować 2–6 kodów na wyższym poziomie abstrakcji. Wymiary wymagają uzasadnienia teoretycznego. Kody in-vivo oznaczone kursywą. Eksport do tabeli Markdown.',
    en: 'Three-level structure: first-order concepts (empirical codes, 15–25) → second-order themes (theoretical categories, 4–8) → aggregate dimensions (2–4). Each theme should group 2–6 codes at a higher abstraction level. Dimensions require theoretical grounding. In-vivo codes shown in italics. Export to Markdown table.'
  },
  info_export_text: {
    pl: 'JSON (pełny eksport z metadanymi), CSV (kompatybilny z MAXQDA/NVivo), tabela Gioia (Markdown), raport kodowania (statystyki i ostrzeżenia). JSON jest kanonicznym formatem wymiany z pluginem Claude.',
    en: 'JSON (full export with metadata), CSV (compatible with MAXQDA/NVivo), Gioia table (Markdown), coding report (stats and warnings). JSON is the canonical exchange format with the Claude plugin.'
  },

  // API Section
  api_provider: { pl: 'Dostawca AI', en: 'AI Provider' },
  api_save: { pl: 'Zapisz ustawienia w przeglądarce', en: 'Save settings on this computer' },
  api_security: {
    pl: 'Klucz przechowywany tylko w tej przeglądarce · wysyłany wyłącznie do wybranego dostawcy · nigdy nie udostępniany',
    en: 'Key stored in this browser only · sent only to the selected provider · never shared with third parties'
  },
  api_data_warning: {
    pl: 'Przy dostawcach chmurowych treść danych jest przesyłana na ich serwery — upewnij się, że jest to zgodne z Twoimi obowiązkami ochrony danych.',
    en: 'When using cloud providers, data content is transmitted to their servers — ensure this is compatible with your data protection obligations.'
  },
  api_hq: { pl: 'Użyj modelu wyższej jakości', en: 'Use higher quality model' },
  api_local_endpoint: { pl: 'Endpoint serwera', en: 'Server Endpoint' },
  api_local_endpoint_hint: {
    pl: 'Endpoint kompatybilny z OpenAI. Ollama: localhost:11434/v1 · LM Studio: localhost:1234/v1',
    en: 'OpenAI-compatible endpoint. Ollama: localhost:11434/v1 · LM Studio: localhost:1234/v1'
  },
  api_local_model: { pl: 'Nazwa modelu', en: 'Model Name' },
  api_local_model_hint: {
    pl: 'Nazwa modelu zarejestrowana na serwerze (uruchom <code class="code-inline">ollama list</code>).',
    en: 'The model name as registered on your local server (run <code class="code-inline">ollama list</code>).'
  },

  // Navigation
  nav_setup: { pl: 'Konfiguracja', en: 'Setup' },
  nav_coding: { pl: 'Kodowanie', en: 'Coding' },
  nav_codebook: { pl: 'Codebook', en: 'Codebook' },
  nav_visualization: { pl: 'Wizualizacja', en: 'Visualization' },
  nav_export: { pl: 'Eksport', en: 'Export' },

  // Setup
  setup_source_data: { pl: 'Dane źródłowe', en: 'Source data' },
  setup_source_placeholder: {
    pl: 'Wklej transkrypcję, notatki terenowe, dane z Transcript Tool (JSON)...',
    en: 'Paste transcript, field notes, Transcript Tool data (JSON)...'
  },
  setup_parse: { pl: 'Parsuj dane', en: 'Parse data' },
  setup_source_type: { pl: 'Typ źródła', en: 'Source type' },
  source_interview: { pl: 'Wywiad', en: 'Interview' },
  source_focus: { pl: 'Focus group', en: 'Focus group' },
  source_field: { pl: 'Notatki terenowe', en: 'Field notes' },
  source_document: { pl: 'Dokument', en: 'Document' },
  source_other: { pl: 'Inny', en: 'Other' },
  setup_coding_mode: { pl: 'Tryb kodowania', en: 'Coding mode' },
  mode_inductive: { pl: 'Indukcyjny', en: 'Inductive' },
  mode_inductive_desc: {
    pl: 'Badacz koduje samodzielnie, bez AI. Pełna kontrola nad procesem.',
    en: 'Researcher codes independently, without AI. Full control over the process.'
  },
  mode_counter: { pl: 'Kontrpropozycja', en: 'Counter-proposal' },
  mode_counter_desc: {
    pl: 'Badacz koduje, AI proponuje alternatywę. Decyzja zawsze po stronie badacza.',
    en: 'Researcher codes, AI proposes alternative. Decision always rests with the researcher.'
  },
  mode_assisted: { pl: 'Asystowany', en: 'Assisted' },
  mode_assisted_desc: {
    pl: 'AI proponuje kod, badacz akceptuje/modyfikuje/odrzuca.',
    en: 'AI proposes code, researcher accepts/modifies/rejects.'
  },
  mode_auto: { pl: 'Automatyczny', en: 'Automatic' },
  mode_auto_desc: {
    pl: 'AI koduje cały korpus. Badacz przegląda i koryguje wyniki.',
    en: 'AI codes the entire corpus. Researcher reviews and corrects results.'
  },
  auto_start: {
    pl: 'Zakoduj cały korpus automatycznie',
    en: 'Code entire corpus automatically'
  },
  auto_progress: {
    pl: 'Kodowanie automatyczne...',
    en: 'Automatic coding...'
  },
  auto_segment: {
    pl: 'Koduję segment',
    en: 'Coding segment'
  },
  auto_done: {
    pl: 'Kodowanie zakończone. Przejrzyj wyniki poniżej.',
    en: 'Coding complete. Review results below.'
  },
  auto_cancel: {
    pl: 'Przerwij',
    en: 'Cancel'
  },
  auto_review_title: {
    pl: 'Przegląd wyników',
    en: 'Review results'
  },
  auto_edit: {
    pl: 'Edytuj',
    en: 'Edit'
  },
  auto_save_edit: {
    pl: 'Zapisz zmianę',
    en: 'Save change'
  },
  auto_cancel_edit: {
    pl: 'Anuluj',
    en: 'Cancel'
  },
  auto_col_text: {
    pl: 'Tekst',
    en: 'Text'
  },
  auto_col_code: {
    pl: 'Kod',
    en: 'Code'
  },
  auto_col_type: {
    pl: 'Typ',
    en: 'Type'
  },
  auto_col_justification: {
    pl: 'Uzasadnienie',
    en: 'Justification'
  },
  auto_themes_progress: {
    pl: 'Generowanie tematów 2nd-order...',
    en: 'Generating second-order themes...'
  },
  auto_dims_progress: {
    pl: 'Generowanie wymiarów zagregowanych...',
    en: 'Generating aggregate dimensions...'
  },
  gen_themes_btn: {
    pl: 'Wygeneruj tematy (AI)',
    en: 'Generate themes (AI)'
  },
  gen_dims_btn: {
    pl: 'Wygeneruj wymiary (AI)',
    en: 'Generate dimensions (AI)'
  },
  gen_themes_min: {
    pl: 'Potrzeba co najmniej 3 kodów do wygenerowania tematów.',
    en: 'At least 3 codes are needed to generate themes.'
  },
  gen_dims_min: {
    pl: 'Potrzeba co najmniej 2 tematów do wygenerowania wymiarów.',
    en: 'At least 2 themes are needed to generate dimensions.'
  },
  gen_themes_done: {
    pl: 'Wygenerowano tematów:',
    en: 'Generated themes:'
  },
  gen_dims_done: {
    pl: 'Wygenerowano wymiarów:',
    en: 'Generated dimensions:'
  },
  gen_themes_fail: {
    pl: 'Nie udało się wygenerować tematów. Spróbuj ponownie.',
    en: 'Failed to generate themes. Try again.'
  },
  gen_dims_fail: {
    pl: 'Nie udało się wygenerować wymiarów. Spróbuj ponownie.',
    en: 'Failed to generate dimensions. Try again.'
  },
  hint_themes_ready: {
    pl: 'Czas na tematy',
    en: 'Time for themes'
  },
  hint_themes_desc: {
    pl: 'Zakodowałeś wystarczającą liczbę segmentów. Przejdź do Codebook, żeby wygenerować tematy 2nd-order z AI lub stworzyć je ręcznie.',
    en: 'You have coded enough segments. Go to Codebook to generate second-order themes with AI or create them manually.'
  },
  sat_warning_title: {
    pl: 'Nasycenie nie osiągnięte',
    en: 'Saturation not reached'
  },
  sat_warning_text: {
    pl: 'W ostatnich 10 segmentach pojawiło się {n} nowych kodów. Kodowanie może nie być nasycone — tematy mogą być niestabilne.',
    en: '{n} new codes appeared in the last 10 segments. Coding may not be saturated — themes may be unstable.'
  },
  auto_themes_pass1: {
    pl: 'Generowanie tematów (pass 1/3 — grupowanie)...',
    en: 'Generating themes (pass 1/3 — grouping)...'
  },
  auto_themes_pass2: {
    pl: 'Krytyka tematów (pass 2/3 — weryfikacja)...',
    en: 'Critiquing themes (pass 2/3 — review)...'
  },
  auto_themes_pass3: {
    pl: 'Korekta tematów (pass 3/3 — rewizja)...',
    en: 'Revising themes (pass 3/3 — revision)...'
  },
  auto_abduction_progress: {
    pl: 'Pętla abdukcyjna — re-kodowanie',
    en: 'Abduction loop — re-coding'
  },
  viz_grounding: {
    pl: 'Uzasadnienie teoretyczne',
    en: 'Theoretical grounding'
  },
  viz_abduction_stats: {
    pl: 'Pętla abdukcyjna',
    en: 'Abduction loop'
  },
  viz_recoded: {
    pl: 'Przekodowano segmentów',
    en: 'Recoded segments'
  },
  viz_orphans: {
    pl: 'Segmentów-sierot (nie pasują do żadnego tematu)',
    en: 'Orphan segments (no theme fit)'
  },
  viz_drift_warnings: {
    pl: 'Ostrzeżenia drift',
    en: 'Drift warnings'
  },
  viz_drift_batch: {
    pl: 'Batch',
    en: 'Batch'
  },
  hint_go_codebook: {
    pl: 'Przejdź do Codebook',
    en: 'Go to Codebook'
  },
  setup_params: { pl: 'Parametry', en: 'Parameters' },
  setup_coder_id: { pl: 'ID kodera', en: 'Coder ID' },
  setup_code_lang: { pl: 'Język kodów', en: 'Code language' },
  setup_threshold: { pl: 'Próg konsolidacji (N)', en: 'Consolidation threshold (N)' },
  setup_guided: { pl: 'Guided mode', en: 'Guided mode' },
  setup_rq: { pl: 'Pytanie badawcze (opcjonalnie)', en: 'Research question (optional)' },
  setup_rq_placeholder: {
    pl: 'np. Jak pracownicy doświadczają zmiany organizacyjnej?',
    en: 'e.g. How do employees experience organizational change?'
  },
  setup_framework: { pl: 'Framework / kody a priori (opcjonalnie, tryb asystowany)', en: 'Framework / a priori codes (optional, assisted mode)' },
  setup_framework_placeholder: {
    pl: 'Lista kodów lub opis ramy pojęciowej...',
    en: 'List of codes or conceptual framework description...'
  },
  setup_start: { pl: 'Rozpocznij kodowanie', en: 'Start coding' },

  // Session
  session_found: {
    pl: 'Znaleziono niezakończoną sesję kodowania.',
    en: 'Previous coding session found.'
  },
  session_restore: { pl: 'Przywróć', en: 'Restore' },

  // Coding view
  coding_coded: { pl: 'Zakodowano', en: 'Coded' },
  coding_prev: { pl: '← Poprzedni', en: '← Previous' },
  coding_next: { pl: 'Następny →', en: 'Next →' },
  coding_already: { pl: '✓ zakodowany', en: '✓ coded' },
  coding_assign: { pl: 'Nadaj kod temu fragmentowi', en: 'Assign a code to this segment' },
  coding_assign_counter: { pl: 'Nadaj kod, potem zobaczysz kontrpropozycję AI', en: 'Assign a code, then see AI counter-proposal' },
  coding_code_placeholder: { pl: 'np. uczenie nieformalne, opór wobec zmian...', en: 'e.g. informal learning, resistance to change...' },
  coding_type_desc: { pl: 'Opisowy', en: 'Descriptive' },
  coding_type_vivo: { pl: 'In-vivo', en: 'In-vivo' },
  coding_type_proc: { pl: 'Procesowy', en: 'Process' },
  coding_note: { pl: 'Notatka (opcjonalnie)', en: 'Note (optional)' },
  coding_save: { pl: 'Zapisz kod', en: 'Save code' },
  coding_submit_counter: { pl: 'Zatwierdź i pokaż kontrpropozycję', en: 'Submit and show counter-proposal' },
  coding_gen_assisted: { pl: 'Generuj propozycję AI', en: 'Generate AI proposal' },
  coding_gen_counter: { pl: 'Generuję kontrpropozycję...', en: 'Generating counter-proposal...' },
  coding_gen_proposal: { pl: 'Generuję propozycję...', en: 'Generating proposal...' },
  coding_your_code: { pl: 'Twój kod', en: 'Your code' },
  coding_ai_proposal: { pl: 'Propozycja AI', en: 'AI proposal' },
  coding_decision_mine: { pl: 'Mój kod', en: 'My code' },
  coding_decision_ai: { pl: 'Propozycja AI', en: 'AI proposal' },
  coding_decision_new: { pl: 'Nowy', en: 'New' },
  coding_decision_accept: { pl: 'Akceptuję', en: 'Accept' },
  coding_decision_modify: { pl: 'Modyfikuję', en: 'Modify' },
  coding_decision_reject: { pl: 'Odrzucam', en: 'Reject' },
  coding_modified_placeholder: { pl: 'Zmodyfikowany kod...', en: 'Modified code...' },
  coding_alt_placeholder: { pl: 'Twój kod lub modyfikacja...', en: 'Your code or modification...' },
  coding_save_decision: { pl: 'Zapisz decyzję', en: 'Save decision' },
  coding_save_short: { pl: 'Zapisz', en: 'Save' },
  coding_recent: { pl: 'Ostatnio zakodowane:', en: 'Recently coded:' },
  coding_no_api: { pl: 'Brak klucza API.', en: 'No API key.' },

  // Guided
  guided_first_title: { pl: 'Guided: Pierwszy fragment', en: 'Guided: First segment' },
  guided_first_p1: {
    pl: '<strong>Kod jakościowy</strong> to krótka etykieta, która nazywa to, co widzisz w fragmencie — ideę, proces, zjawisko. Nie streszczenie, nie cytat — <strong>interpretacja</strong>.',
    en: '<strong>A qualitative code</strong> is a short label that names what you see in the segment — an idea, process, phenomenon. Not a summary, not a quote — <strong>an interpretation</strong>.'
  },
  guided_first_p2: {
    pl: 'Dobry kod odpowiada na pytanie: <em>„o czym jest ten fragment?"</em>',
    en: 'A good code answers the question: <em>"what is this segment about?"</em>'
  },
  guided_summary: { pl: 'Podsumowanie po', en: 'Summary after' },
  guided_fragments: { pl: 'fragmentach', en: 'segments' },
  guided_ratio_ok: { pl: 'Proporcja kodów do fragmentów wygląda zdrowo.', en: 'Code-to-segment ratio looks healthy.' },
  guided_ratio_high: { pl: 'Dużo kodów — prawie każdy fragment ma osobny. Rozważ konsolidację.', en: 'Too many codes — almost every segment has its own. Consider consolidation.' },
  guided_ratio_low: { pl: 'Mało kodów — czy nie łączysz za wcześnie?', en: 'Few codes — are you merging too early?' },
  guided_top: { pl: 'Top kody:', en: 'Top codes:' },

  // Codebook
  codebook_codes: { pl: 'Kody', en: 'Codes' },
  codebook_singletons: { pl: 'Jednorazowe', en: 'Singletons' },
  codebook_themes: { pl: 'Tematy', en: 'Themes' },
  codebook_dims: { pl: 'Wymiary', en: 'Dimensions' },
  codebook_list: { pl: 'Lista kodów', en: 'Code list' },
  codebook_code: { pl: 'Kod', en: 'Code' },
  codebook_type: { pl: 'Typ', en: 'Type' },
  codebook_freq: { pl: 'Częstość', en: 'Frequency' },
  codebook_def: { pl: 'Definicja', en: 'Definition' },
  codebook_consolidate: { pl: 'Sugestie AI do konsolidacji', en: 'AI consolidation suggestions' },
  codebook_analyzing: { pl: 'Analizuję kody...', en: 'Analyzing codes...' },
  codebook_consolidation_title: { pl: 'Sugestie konsolidacji', en: 'Consolidation suggestions' },
  codebook_themes_title: { pl: 'Tematy 2nd-order', en: '2nd-order themes' },
  codebook_dims_title: { pl: 'Wymiary zagregowane', en: 'Aggregate dimensions' },
  theme_empty: { pl: 'Brak tematów — utwórz temat i przypisz kody.', en: 'No themes — create a theme and assign codes.' },
  theme_name_placeholder: { pl: 'Nazwa tematu...', en: 'Theme name...' },
  theme_create: { pl: 'Utwórz temat', en: 'Create theme' },
  theme_add_code: { pl: '+ Dodaj kod...', en: '+ Add code...' },
  dim_empty: { pl: 'Brak wymiarów — utwórz wymiar i przypisz tematy.', en: 'No dimensions — create a dimension and assign themes.' },
  dim_name_placeholder: { pl: 'Nazwa wymiaru...', en: 'Dimension name...' },
  dim_create: { pl: 'Utwórz wymiar', en: 'Create dimension' },
  dim_add_theme: { pl: '+ Dodaj temat...', en: '+ Add theme...' },

  // Visualization
  viz_diagnostics: { pl: 'Diagnostyki', en: 'Diagnostics' },
  viz_singletons: { pl: 'Jednorazowe:', en: 'Singletons:' },
  viz_overloaded: { pl: 'Przeładowane (>15%):', en: 'Overloaded (>15%):' },
  viz_saturation: { pl: 'Nasycenie:', en: 'Saturation:' },
  viz_new_last10: { pl: 'nowych kodów w ostatnich 10 fragmentach', en: 'new codes in last 10 segments' },
  viz_gioia: { pl: 'Tabela Gioia', en: 'Gioia Table' },
  viz_no_themes: { pl: 'Brak tematów — utwórz je w Codebook.', en: 'No themes — create them in Codebook.' },
  viz_freq: { pl: 'Częstość kodów', en: 'Code frequency' },

  // Export
  export_title: { pl: 'Eksport danych kodowych', en: 'Export coding data' },
  export_json: { pl: 'JSON (pełny)', en: 'JSON (full)' },
  export_csv: { pl: 'CSV (MAXQDA/NVivo)', en: 'CSV (MAXQDA/NVivo)' },
  export_gioia: { pl: 'Tabela Gioia (Markdown)', en: 'Gioia Table (Markdown)' },
  export_report: { pl: 'Raport kodowania', en: 'Coding report' },
  export_csv_rows: { pl: 'wierszy wyeksportowanych.', en: 'rows exported.' },
  export_no_themes: { pl: 'Brak tematów — utwórz je w Codebook.', en: 'No themes — create them in Codebook.' },

  // Empty states
  empty_setup: { pl: 'Najpierw skonfiguruj projekt w zakładce Konfiguracja.', en: 'Configure the project in the Setup tab first.' },
  empty_codes: { pl: 'Brak kodów — zacznij kodowanie.', en: 'No codes — start coding.' },
  empty_data: { pl: 'Brak danych do wizualizacji.', en: 'No data to visualize.' },
  empty_export: { pl: 'Brak danych do eksportu.', en: 'No data to export.' },

  // Errors
  err_no_data: { pl: 'Najpierw wklej dane.', en: 'Paste data first.' },
  err_no_coder: { pl: 'Podaj ID kodera.', en: 'Enter coder ID.' },

  // Parse status
  parse_transcript: { pl: 'Rozpoznano eksport Transcript Tool:', en: 'Recognized Transcript Tool export:' },
  parse_json: { pl: 'Rozpoznano JSON:', en: 'Recognized JSON:' },
  parse_turns: { pl: 'Segmentacja po turach:', en: 'Segmentation by turns:' },
  parse_paragraphs: { pl: 'Segmentacja po akapitach:', en: 'Segmentation by paragraphs:' },
  parse_segments: { pl: 'segmentów', en: 'segments' },
  parse_preview: { pl: 'Podgląd', en: 'Preview' },
  parse_of: { pl: 'z', en: 'of' },

  // Report
  report_title: { pl: 'RAPORT KODOWANIA', en: 'CODING REPORT' },
  report_date: { pl: 'Data:', en: 'Date:' },
  report_coder: { pl: 'Koder:', en: 'Coder:' },
  report_mode: { pl: 'Tryb:', en: 'Mode:' },
  report_guided: { pl: 'Guided mode:', en: 'Guided mode:' },
  report_yes: { pl: 'tak', en: 'yes' },
  report_no: { pl: 'nie', en: 'no' },
  report_stats: { pl: 'STATYSTYKI', en: 'STATISTICS' },
  report_segments: { pl: 'Segmentów:', en: 'Segments:' },
  report_coded: { pl: 'Zakodowanych:', en: 'Coded:' },
  report_codes: { pl: 'Kodów:', en: 'Codes:' },
  report_themes: { pl: 'Tematów:', en: 'Themes:' },
  report_dims: { pl: 'Wymiarów:', en: 'Dimensions:' },
  report_decisions: { pl: 'ROZKŁAD DECYZJI', en: 'DECISION DISTRIBUTION' },
  report_code_list: { pl: 'LISTA KODÓW', en: 'CODE LIST' },
  report_warnings: { pl: 'OSTRZEŻENIA', en: 'WARNINGS' },
  report_singleton_warn: { pl: 'Kody jednorazowe:', en: 'Singleton codes:' },
  report_no_themes_warn: { pl: 'fragmentów bez tematów 2nd-order', en: 'segments without 2nd-order themes' },
  report_no_warnings: { pl: 'Brak ostrzeżeń.', en: 'No warnings.' },

  // Model hints
  hint_anthropic: {
    pl: 'Domyślnie: Claude Haiku (szybki, tani). Wyższa jakość: Claude Sonnet (lepsza dokładność kodowania, ~10× droższy).',
    en: 'Default: Claude Haiku (fast, cheap). Higher quality: Claude Sonnet (better coding accuracy, ~10× more expensive).'
  },
  hint_openai: {
    pl: 'Domyślnie: GPT-4o mini (szybki, tani). Wyższa jakość: GPT-4o (~15× droższy).',
    en: 'Default: GPT-4o mini (fast, cheap). Higher quality: GPT-4o (~15× more expensive).'
  },
  hint_google: {
    pl: 'Domyślnie: Gemini Flash (szybki, tani). Wyższa jakość: Gemini Pro (~10× droższy).',
    en: 'Default: Gemini Flash (fast, cheap). Higher quality: Gemini Pro (~10× more expensive).'
  },
  hint_local: {
    pl: 'Lokalny model przez API kompatybilne z OpenAI. Dane pozostają na Twoim komputerze.',
    en: 'Local model via OpenAI-compatible API. Data stays on your machine.'
  },

  // Drop zone & file import
  drop_zone_text: { pl: 'Przeciągnij pliki tutaj lub kliknij, aby wybrać', en: 'Drag files here or click to browse' },
  drop_zone_hint: { pl: 'TXT, JSON, CSV, DOCX — możesz upuścić wiele plików naraz', en: 'TXT, JSON, CSV, DOCX — you can drop multiple files at once' },
  drop_unsupported: { pl: 'Nieobsługiwany format pliku. Obsługiwane: TXT, JSON, CSV, DOCX.', en: 'Unsupported file format. Supported: TXT, JSON, CSV, DOCX.' },
  drop_processing: { pl: 'Przetwarzanie', en: 'Processing' },
  drop_file: { pl: 'plik', en: 'file' },
  drop_files: { pl: 'plików', en: 'files' },
  drop_loaded: { pl: 'Załadowano', en: 'Loaded' },
  drop_remove: { pl: 'Usuń plik', en: 'Remove file' },
  import_or: { pl: 'lub wklej tekst', en: 'or paste text' },
  merge_title: { pl: 'Sesja zawiera już dane', en: 'Session already has data' },
  merge_info: { pl: 'Masz {existing} segmentów. Chcesz dodać {new} nowych czy zastąpić istniejące?', en: 'You have {existing} segments. Add {new} new ones or replace existing?' },
  merge_add: { pl: 'Dodaj do sesji', en: 'Add to session' },
  merge_replace: { pl: 'Zastąp', en: 'Replace' },
  merge_cancel: { pl: 'Anuluj', en: 'Cancel' },
  merge_done: { pl: 'Dodano segmenty', en: 'Segments added' },

  // Consolidation (actionable)
  consolidation_apply: { pl: 'Zastosuj', en: 'Apply' },
  consolidation_dismiss: { pl: 'Odrzuć', en: 'Dismiss' },
  consolidation_none: { pl: 'Brak sugestii konsolidacji — kody są wystarczająco zróżnicowane.', en: 'No consolidation suggestions — codes are sufficiently distinct.' },

  // Drift (actionable)
  drift_issues: { pl: 'problemów', en: 'issues' },

  // Diagnostics links
  diag_go_codebook: { pl: '→ Codebook', en: '→ Codebook' },

  // Grounding (rich)
  grounding_theory: { pl: 'Teoria', en: 'Theory' },
  grounding_author: { pl: 'Autor(zy)', en: 'Author(s)' },
  grounding_edit_placeholder: { pl: 'Edytuj uzasadnienie...', en: 'Edit grounding...' },
  grounding_verify_hint: { pl: '⚠ Zweryfikuj cytowane źródła — AI może halucynować referencje.', en: '⚠ Verify cited sources — AI may hallucinate references.' },

  // Keyboard shortcuts
  shortcut_prev: { pl: '← Poprzedni (skrót: ←)', en: '← Previous (shortcut: ←)' },
  shortcut_next: { pl: 'Następny → (skrót: →)', en: 'Next → (shortcut: →)' },

  // Codebook filter & export
  codebook_filter_placeholder: { pl: 'Filtruj kody...', en: 'Filter codes...' },
  codebook_export_btn: { pl: 'Eksportuj codebook', en: 'Export codebook' },

  // Undo
  undo_btn: { pl: 'Cofnij', en: 'Undo' },
  undo_done: { pl: 'Cofnięto ostatnią akcję.', en: 'Last action undone.' },
  undo_empty: { pl: 'Brak akcji do cofnięcia.', en: 'Nothing to undo.' },

  // Batch size
  setup_batch_size: { pl: 'Batch drift check (co ile segmentów)', en: 'Drift check batch size (segments)' },

  // Cost estimate
  auto_cost_estimate: { pl: 'Szacunkowy koszt', en: 'Estimated cost' },
  auto_cost_segments: { pl: 'segmentów × ~', en: 'segments × ~' },
  auto_cost_tokens: { pl: 'tokenów/segment', en: 'tokens/segment' },
  // Overwrite confirmations
  gen_themes_overwrite: {
    pl: 'Tematy już istnieją. Wygenerować nowe? (poprzednie zostaną nadpisane — możesz cofnąć Ctrl+Z)',
    en: 'Themes already exist. Generate new ones? (previous will be overwritten — you can undo with Ctrl+Z)'
  },
  gen_dims_overwrite: {
    pl: 'Wymiary już istnieją. Wygenerować nowe? (poprzednie zostaną nadpisane — możesz cofnąć Ctrl+Z)',
    en: 'Dimensions already exist. Generate new ones? (previous will be overwritten — you can undo with Ctrl+Z)'
  },
  // Pre-analysis briefing
  briefing_title: { pl: 'Analiza wstępna danych', en: 'Data pre-analysis' },
  briefing_segments: { pl: 'Segmenty', en: 'Segments' },
  briefing_avg_len: { pl: 'Śr. długość', en: 'Avg. length' },
  briefing_chars: { pl: 'znaków', en: 'chars' },
  briefing_authors: { pl: 'Rozmówcy', en: 'Speakers' },
  briefing_files: { pl: 'Pliki źródłowe', en: 'Source files' },
  briefing_suggest_inductive: {
    pl: '💡 Sugestia: tryb indukcyjny — brak frameworka, eksploracja danych',
    en: '💡 Suggestion: inductive mode — no framework provided, data exploration'
  },
  briefing_suggest_assisted: {
    pl: '💡 Sugestia: tryb asystowany — masz framework, AI dopasuje kody',
    en: '💡 Suggestion: assisted mode — framework provided, AI will match codes'
  },
  briefing_suggest_auto: {
    pl: '💡 Sugestia: tryb auto — duży zbiór (>200 segm.), ręczne kodowanie zajmie dużo czasu',
    en: '💡 Suggestion: auto mode — large dataset (>200 segments), manual coding would take long'
  },
  briefing_suggest_batch: {
    pl: '💡 Sugerowany batch size: {n} (drift check co tyle segmentów)',
    en: '💡 Suggested batch size: {n} (drift check every N segments)'
  },
  briefing_warn_short: {
    pl: '⚠ Segmenty bardzo krótkie (<50 zn.) — rozważ łączenie lub zmianę segmentacji',
    en: '⚠ Segments very short (<50 chars) — consider merging or changing segmentation'
  },
  briefing_warn_long: {
    pl: '⚠ Segmenty bardzo długie (>2000 zn.) — rozważ podział na mniejsze jednostki',
    en: '⚠ Segments very long (>2000 chars) — consider splitting into smaller units'
  },
  // Gioia table columns
  gioia_col_codes: { pl: 'Koncepty pierwszego rzędu', en: 'First-order concepts' },
  gioia_col_themes: { pl: 'Tematy drugiego rzędu', en: 'Second-order themes' },
  gioia_col_dims: { pl: 'Wymiary zagregowane', en: 'Aggregate dimensions' },
};

function t(key) {
  const entry = I18N[key];
  if (!entry) return key;
  return entry[currentLang] || entry['en'] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('coding_tool_lang', lang);
  document.documentElement.lang = lang;

  // Update static elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.innerHTML = val;
    }
  });

  // Update lang toggle buttons
  const btnPl = document.getElementById('langBtnPl');
  const btnEn = document.getElementById('langBtnEn');
  if (btnPl) btnPl.classList.toggle('active', lang === 'pl');
  if (btnEn) btnEn.classList.toggle('active', lang === 'en');

  // Update model hint
  if (typeof currentProvider !== 'undefined') {
    const hintEl = document.getElementById('modelHint');
    if (hintEl) hintEl.innerHTML = t('hint_' + currentProvider);
  }

  // Re-render active view
  if (typeof currentView !== 'undefined' && typeof showView === 'function') {
    showView(currentView);
  }
}

function toggleLang() {
  setLang(currentLang === 'pl' ? 'en' : 'pl');
}

// Apply saved language on page load (after DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
  if (currentLang !== 'pl') setLang(currentLang);
});
