// ─── Qualitative Coding Tool — Demo Mode ───
// Pre-generated sample data for offline demonstration (no API key needed)
// Bilingual: PL and EN datasets, selected based on currentLang

const DEMO = {

  data: {
    // ════════════════════════════════════════════════
    // ── ENGLISH DATASET ──
    // ════════════════════════════════════════════════
    en: {
      codingLang: 'en',
      researchQuestion: 'How do employees experience and adapt to ERP implementation failures in manufacturing organizations?',
      projectMemo: 'Demo dataset: 6 respondents discussing ERP implementation in a manufacturing company. The data reveals three aggregate dimensions of the implementation experience — organizational unreadiness, socio-technical misalignment, and bottom-up sensemaking. The most unexpected finding is the role of grassroots documentation as emergent knowledge management.',

      segments: [
        { segment_id: 'S01', text_primary: "When we started implementing the ERP system, nobody in the company knew how it would affect their daily work. Management said things would get better, but people on the shop floor were afraid they'd lose their jobs.", author: 'R1', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S02', text_primary: "The training was too short. Two days for the entire warehouse module — that's not enough. People went back to their stations and had no idea what to click.", author: 'R1', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S03', text_primary: "The line manager told us straight: 'Do it the old way until the system stabilises.' That was a clear signal that middle management didn't believe in the project.", author: 'R2', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S04', text_primary: "After three months it turned out the data in the system didn't match what we had on paper. Nobody had verified whether the data migration went correctly.", author: 'R2', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S05', text_primary: "The only person who truly understood the system was the external consultant. When his contract ended, we were left alone with the problems.", author: 'R3', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S06', text_primary: "Eventually we started creating informal instructions ourselves — screenshots, step-by-step guides. It wasn't official, but it worked better than the vendor's documentation.", author: 'R3', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S07', text_primary: "Senior management didn't want to hear about problems. In meetings they said the rollout was on track. But we were seeing something completely different.", author: 'R4', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S08', text_primary: "Yes.", author: 'R4', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S09', text_primary: "", author: 'R4', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S10', text_primary: "Hmm... I don't know... I think so, but I'm not sure what exactly you're asking.", author: 'R5', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S11', text_primary: "The key issue was that IT and production didn't talk to each other at all. IT assumed they knew what production needed, but they never actually asked.", author: 'R5', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S12', text_primary: "After a year of using it, I can say the system proved its worth, but it cost us a lot of nerves. If we'd had better training at the start, we would have saved six months of frustration.", author: 'R6', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S13', text_primary: "The most annoying thing was that the system required entering the same data in three different places. It was completely illogical.", author: 'R6', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S14', text_primary: "R7", author: 'R7', source_file: 'demo_erp_interviews.json' },
        { segment_id: 'S15', text_primary: "The change came when the new IT manager sat down on the shop floor and worked with people for a week. Only then did he understand what the real problems were, and started solving them.", author: 'R7', source_file: 'demo_erp_interviews.json' },
      ],

      codes: {
        S01: 'Fear of job loss', S02: 'Insufficient training', S03: 'Middle management resistance',
        S04: 'Data migration failure', S05: 'Knowledge dependency on consultant', S06: 'Grassroots documentation',
        S07: 'Narrative–reality gap', S08: '_NIEJASNY', S09: '_PUSTY', S10: '_NIEJASNY',
        S11: 'Cross-departmental silo', S12: 'Delayed value realisation', S13: 'Redundant data entry',
        S14: '_PUSTY', S15: 'Gemba-style leadership',
      },
      codeTypes: {
        'Fear of job loss': 'descriptive', 'Insufficient training': 'descriptive', 'Middle management resistance': 'descriptive',
        'Data migration failure': 'descriptive', 'Knowledge dependency on consultant': 'descriptive', 'Grassroots documentation': 'in_vivo',
        'Narrative–reality gap': 'process', '_NIEJASNY': 'descriptive', '_PUSTY': 'descriptive',
        'Cross-departmental silo': 'descriptive', 'Delayed value realisation': 'process', 'Redundant data entry': 'in_vivo',
        'Gemba-style leadership': 'process',
      },
      codeDefinitions: {
        'Fear of job loss': 'Employee anxiety about redundancy driven by system automation',
        'Insufficient training': 'Training programmes too short or shallow for system complexity',
        'Middle management resistance': 'Line managers explicitly or implicitly undermining the new system',
        'Data migration failure': 'Unverified or incorrect data transfer from legacy to new system',
        'Knowledge dependency on consultant': 'Critical system knowledge concentrated in external actor who left',
        'Grassroots documentation': 'Informal, user-created guides filling gaps in official documentation',
        'Narrative–reality gap': 'Disconnect between management narrative of success and shop-floor reality',
        'Cross-departmental silo': 'IT and production operating in isolation without meaningful communication',
        'Delayed value realisation': 'System benefits only emerging after extended, painful adoption period',
        'Redundant data entry': 'System requiring same data input in multiple places',
        'Gemba-style leadership': 'Manager gaining understanding by working alongside shop-floor employees',
        '_NIEJASNY': 'Ambiguous or fragmentary segment — auto-assigned sentinel',
        '_PUSTY': 'Empty segment — auto-assigned sentinel',
      },
      notes: {
        S01: 'Workers feared automation-driven redundancy', S02: 'Training duration inadequate for system complexity',
        S03: 'Explicit instruction to bypass the new system', S04: 'No verification of migrated data integrity',
        S05: 'Critical knowledge left with external actor', S06: 'User-created workarounds as informal knowledge transfer',
        S07: 'Disconnect between official narrative and shop-floor experience', S08: 'Single-word response, insufficient for coding',
        S09: 'Empty segment', S10: 'Ambiguous, fragmentary response', S11: 'IT and production operating in isolation',
        S12: 'System benefits emerged only after extended painful adoption', S13: 'UX friction from duplicate input requirements',
        S14: 'Identifier only, no content', S15: 'Leader gained understanding by going to the shop floor',
      },

      themes: {
        'Readiness & capacity deficit': ['Fear of job loss', 'Insufficient training'],
        'Institutional resistance': ['Middle management resistance', 'Narrative–reality gap'],
        'Technical implementation gaps': ['Data migration failure', 'Redundant data entry'],
        'Knowledge governance failure': ['Knowledge dependency on consultant', 'Cross-departmental silo'],
        'Emergent adaptation': ['Grassroots documentation', 'Gemba-style leadership', 'Delayed value realisation'],
      },
      dimensions: {
        'Organizational unreadiness': ['Readiness & capacity deficit', 'Institutional resistance'],
        'Socio-technical misalignment': ['Technical implementation gaps', 'Knowledge governance failure'],
        'Bottom-up sensemaking': ['Emergent adaptation'],
      },
      groundings: {
        'Organizational unreadiness': { theory: 'Organizational readiness for change', author: 'Weiner (2009)', text: 'Maps onto change valence and change efficacy dimensions — employees lacked both belief in system benefits and capability to use it, while middle management signalled low commitment.' },
        'Socio-technical misalignment': { theory: 'Socio-technical systems theory', author: 'Trist & Bamforth (1951); Bostrom & Heinen (1977)', text: 'Captures the classic misfit between technical subsystem (ERP configuration, data migration) and social subsystem (cross-departmental communication, knowledge distribution) during IS implementation.' },
        'Bottom-up sensemaking': { theory: 'Sensemaking in organizations', author: 'Weick (1995); Orlikowski (1996)', text: 'Users engaged in improvised sensemaking through grassroots documentation and gemba leadership, consistent with Orlikowski\'s situated change perspective where technology-in-practice emerges through use rather than design.' },
      },
      memos: {
        'S03': 'Interesting tension: the line manager\'s instruction ("do it the old way") is simultaneously rational risk management and active sabotage of the implementation. Worth exploring this duality in the discussion.',
        'S06': 'Strong parallel with communities of practice literature (Wenger, 1998) — workers self-organizing knowledge sharing when formal channels fail.',
        'S15': 'This is the only segment describing a positive turning point. The "gemba walk" pattern could be a key practical implication.',
      },
    },

    // ════════════════════════════════════════════════
    // ── POLISH DATASET ──
    // ════════════════════════════════════════════════
    pl: {
      codingLang: 'pl',
      researchQuestion: 'Jak pracownicy doświadczają i adaptują się do niepowodzeń wdrożenia systemu ERP w organizacjach produkcyjnych?',
      projectMemo: 'Zestaw demo: 6 respondentów opisuje wdrożenie ERP w firmie produkcyjnej. Dane ujawniają trzy wymiary zagregowane doświadczenia wdrożeniowego — nieprzygotowanie organizacyjne, niedopasowanie socjotechniczne i oddolne nadawanie sensu. Najbardziej nieoczekiwanym odkryciem jest rola oddolnej dokumentacji jako emergentnego zarządzania wiedzą.',

      segments: [
        { segment_id: 'S01', text_primary: "Kiedy zaczęliśmy wdrażać system ERP, nikt w firmie nie wiedział, jak to wpłynie na codzienną pracę. Zarząd mówił, że będzie lepiej, ale ludzie na produkcji bali się, że stracą pracę.", author: 'R1', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S02', text_primary: "Szkolenia były za krótkie. Dwa dni na cały moduł magazynowy — to za mało. Ludzie wracali na stanowiska i nie wiedzieli, co klikać.", author: 'R1', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S03', text_primary: "Menedżer liniowy powiedział nam wprost: 'Róbcie po staremu, dopóki system się nie ustabilizuje'. To był jasny sygnał, że kierownictwo średniego szczebla nie wierzy w ten projekt.", author: 'R2', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S04', text_primary: "Po trzech miesiącach okazało się, że dane w systemie nie zgadzają się z tym, co mamy na papierze. Nikt nie weryfikował, czy migracja danych przebiegła poprawnie.", author: 'R2', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S05', text_primary: "Jedyną osobą, która naprawdę rozumiała system, był konsultant zewnętrzny. Kiedy skończył się jego kontrakt, zostaliśmy sami z problemami.", author: 'R3', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S06', text_primary: "W końcu sami zaczęliśmy tworzyć nieformalne instrukcje — screenshoty, opisy krok po kroku. To nie było oficjalne, ale działało lepiej niż dokumentacja od dostawcy.", author: 'R3', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S07', text_primary: "Zarząd nie chciał słyszeć o problemach. Na spotkaniach mówili, że wdrożenie idzie zgodnie z planem. A my widzieliśmy coś zupełnie innego.", author: 'R4', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S08', text_primary: "Tak.", author: 'R4', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S09', text_primary: "", author: 'R4', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S10', text_primary: "Hmm... nie wiem... chyba tak, ale nie jestem pewien, o co dokładnie pytasz.", author: 'R5', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S11', text_primary: "Kluczowe było to, że dział IT i dział produkcji w ogóle ze sobą nie rozmawiali. IT myślało, że wie, czego potrzebuje produkcja, ale nigdy ich nie zapytali.", author: 'R5', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S12', text_primary: "Po roku użytkowania mogę powiedzieć, że system się sprawdził, ale kosztowało nas to dużo nerwów. Gdybyśmy mieli lepsze szkolenia na początku, zaoszczędzilibyśmy pół roku frustracji.", author: 'R6', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S13', text_primary: "Najbardziej irytujące było to, że system wymagał wprowadzania tych samych danych w trzech różnych miejscach. To było kompletnie nielogiczne.", author: 'R6', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S14', text_primary: "R7", author: 'R7', source_file: 'demo_wywiady_erp.json' },
        { segment_id: 'S15', text_primary: "Zmiana przyszła, kiedy nowy kierownik IT sam usiadł na produkcji i przez tydzień pracował z ludźmi. Dopiero wtedy zrozumiał, jakie są realne problemy, i zaczął je rozwiązywać.", author: 'R7', source_file: 'demo_wywiady_erp.json' },
      ],

      codes: {
        S01: 'Lęk przed utratą pracy', S02: 'Niewystarczające szkolenia', S03: 'Opór kierownictwa średniego szczebla',
        S04: 'Błąd migracji danych', S05: 'Uzależnienie od konsultanta', S06: 'Oddolna dokumentacja',
        S07: 'Rozbieżność narracji i rzeczywistości', S08: '_NIEJASNY', S09: '_PUSTY', S10: '_NIEJASNY',
        S11: 'Silos międzydziałowy', S12: 'Opóźniona realizacja wartości', S13: 'Redundantne wprowadzanie danych',
        S14: '_PUSTY', S15: 'Przywództwo typu gemba',
      },
      codeTypes: {
        'Lęk przed utratą pracy': 'descriptive', 'Niewystarczające szkolenia': 'descriptive', 'Opór kierownictwa średniego szczebla': 'descriptive',
        'Błąd migracji danych': 'descriptive', 'Uzależnienie od konsultanta': 'descriptive', 'Oddolna dokumentacja': 'in_vivo',
        'Rozbieżność narracji i rzeczywistości': 'process', '_NIEJASNY': 'descriptive', '_PUSTY': 'descriptive',
        'Silos międzydziałowy': 'descriptive', 'Opóźniona realizacja wartości': 'process', 'Redundantne wprowadzanie danych': 'in_vivo',
        'Przywództwo typu gemba': 'process',
      },
      codeDefinitions: {
        'Lęk przed utratą pracy': 'Obawa pracowników przed zwolnieniem wynikającym z automatyzacji procesów',
        'Niewystarczające szkolenia': 'Programy szkoleniowe zbyt krótkie lub powierzchowne w stosunku do złożoności systemu',
        'Opór kierownictwa średniego szczebla': 'Jawne lub ukryte podważanie nowego systemu przez menedżerów liniowych',
        'Błąd migracji danych': 'Niezweryfikowany lub niepoprawny transfer danych z systemu legacy do nowego',
        'Uzależnienie od konsultanta': 'Krytyczna wiedza o systemie skoncentrowana w osobie zewnętrznego konsultanta, który odszedł',
        'Oddolna dokumentacja': 'Nieformalne, tworzone przez użytkowników instrukcje wypełniające luki w oficjalnej dokumentacji',
        'Rozbieżność narracji i rzeczywistości': 'Rozdźwięk między narracją zarządu o sukcesie a rzeczywistością na hali produkcyjnej',
        'Silos międzydziałowy': 'IT i produkcja działające w izolacji bez realnej komunikacji',
        'Opóźniona realizacja wartości': 'Korzyści z systemu ujawniające się dopiero po długim, bolesnym okresie adaptacji',
        'Redundantne wprowadzanie danych': 'System wymagający wprowadzania tych samych danych w wielu miejscach',
        'Przywództwo typu gemba': 'Menedżer zyskujący zrozumienie poprzez pracę ramię w ramię z pracownikami produkcji',
        '_NIEJASNY': 'Niejednoznaczny lub fragmentaryczny segment — automatycznie przypisany sentinel',
        '_PUSTY': 'Pusty segment — automatycznie przypisany sentinel',
      },
      notes: {
        S01: 'Pracownicy obawiali się redundancji wynikającej z automatyzacji', S02: 'Czas szkolenia nieadekwatny do złożoności systemu',
        S03: 'Jawna instrukcja obejścia nowego systemu', S04: 'Brak weryfikacji integralności zmigrowanych danych',
        S05: 'Krytyczna wiedza odeszła z zewnętrznym aktorem', S06: 'Oddolne rozwiązania jako nieformalny transfer wiedzy',
        S07: 'Rozdźwięk między oficjalną narracją a doświadczeniem produkcji', S08: 'Jednowyrazowa odpowiedź, niewystarczająca do kodowania',
        S09: 'Pusty segment', S10: 'Niejednoznaczna, fragmentaryczna odpowiedź', S11: 'IT i produkcja działające w izolacji',
        S12: 'Korzyści z systemu pojawiły się po długim, bolesnym okresie', S13: 'Frustracja UX z powodu duplikowania danych',
        S14: 'Tylko identyfikator, brak treści', S15: 'Lider zdobył zrozumienie idąc na halę produkcyjną',
      },

      themes: {
        'Deficyt gotowości i kompetencji': ['Lęk przed utratą pracy', 'Niewystarczające szkolenia'],
        'Opór instytucjonalny': ['Opór kierownictwa średniego szczebla', 'Rozbieżność narracji i rzeczywistości'],
        'Luki implementacji technicznej': ['Błąd migracji danych', 'Redundantne wprowadzanie danych'],
        'Porażka zarządzania wiedzą': ['Uzależnienie od konsultanta', 'Silos międzydziałowy'],
        'Emergentna adaptacja': ['Oddolna dokumentacja', 'Przywództwo typu gemba', 'Opóźniona realizacja wartości'],
      },
      dimensions: {
        'Nieprzygotowanie organizacyjne': ['Deficyt gotowości i kompetencji', 'Opór instytucjonalny'],
        'Niedopasowanie socjotechniczne': ['Luki implementacji technicznej', 'Porażka zarządzania wiedzą'],
        'Oddolne nadawanie sensu': ['Emergentna adaptacja'],
      },
      groundings: {
        'Nieprzygotowanie organizacyjne': { theory: 'Gotowość organizacyjna do zmiany', author: 'Weiner (2009)', text: 'Mapuje się na wymiary wartościowania zmiany i poczucia skuteczności — pracownicy nie wierzyli w korzyści systemu ani nie potrafili go obsłużyć, a średnie kierownictwo sygnalizowało niskie zaangażowanie.' },
        'Niedopasowanie socjotechniczne': { theory: 'Teoria systemów socjotechnicznych', author: 'Trist i Bamforth (1951); Bostrom i Heinen (1977)', text: 'Oddaje klasyczne niedopasowanie między podsystemem technicznym (konfiguracja ERP, migracja danych) a podsystemem społecznym (komunikacja międzydziałowa, dystrybucja wiedzy) podczas wdrożenia systemu informatycznego.' },
        'Oddolne nadawanie sensu': { theory: 'Nadawanie sensu w organizacjach', author: 'Weick (1995); Orlikowski (1996)', text: 'Użytkownicy zaangażowali się w improwizowane nadawanie sensu poprzez oddolną dokumentację i przywództwo gemba, zgodnie z perspektywą zmiany sytuacyjnej Orlikowski, gdzie technologia-w-praktyce wyłania się z użycia, nie z projektu.' },
      },
      memos: {
        'S03': 'Interesujące napięcie: instrukcja menedżera liniowego („róbcie po staremu") jest jednocześnie racjonalnym zarządzaniem ryzykiem i aktywnym sabotażem wdrożenia. Warto eksplorować tę dualność w dyskusji.',
        'S06': 'Silna paralela z literaturą o wspólnotach praktyki (Wenger, 1998) — pracownicy samoorganizujący dzielenie się wiedzą, gdy formalne kanały zawodzą.',
        'S15': 'To jedyny segment opisujący pozytywny punkt zwrotny. Wzorzec „spaceru gemba" może być kluczową implikacją praktyczną.',
      },
    },
  },

  // ── Build state from a language dataset ──
  _buildState(d) {
    const codebook = {};
    const colors = ['#e74c3c','#e67e22','#f39c12','#9b59b6','#3498db','#2ecc71','#1abc9c','#34495e','#16a085','#d35400','#27ae60','#bdc3c7','#95a5a6'];
    const codeNames = [...new Set(Object.values(d.codes))];
    codeNames.forEach((code, i) => {
      const freq = Object.values(d.codes).filter(c => c === code).length;
      codebook[code] = {
        definition: d.codeDefinitions[code] || '', type: d.codeTypes[code] || 'descriptive',
        frequency: freq, created: `2026-05-27T10:00:${String(i).padStart(2,'0')}Z`,
        color: colors[i % colors.length], memo: '', summary: ''
      };
    });

    const codedRecords = d.segments.map((seg, i) => ({
      segment_id: seg.segment_id, source_type: 'interview', source_file: seg.source_file,
      text_primary: seg.text_primary, author: seg.author,
      first_order_code: d.codes[seg.segment_id], code_type: d.codeTypes[d.codes[seg.segment_id]] || 'descriptive',
      coding_mode: 'auto', researcher_code: null, tool_proposal: d.codes[seg.segment_id],
      final_decision: 'tool', cycle: 1, coder_id: 'demo', guided_mode: false,
      timestamp_coded: `2026-05-27T10:00:${String(i).padStart(2,'0')}Z`,
      notes: d.notes[seg.segment_id] || ''
    }));

    return { codebook, codedRecords };
  },

  // ── Run demo ──
  run() {
    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
    const d = this.data[lang] || this.data.en;
    const built = this._buildState(d);

    state.configured = true;
    state.sourceType = 'interview';
    state.codingMode = 'auto';
    state.guidedMode = false;
    state.codingLang = d.codingLang;
    state.coderId = 'demo';
    state.thresholdN = 20;
    state.batchSize = 10;
    state.researchQuestion = d.researchQuestion;
    state.framework = '';

    state.segments = JSON.parse(JSON.stringify(d.segments));
    state.currentIdx = d.segments.length;
    state.codedRecords = JSON.parse(JSON.stringify(built.codedRecords));
    state.codebook = JSON.parse(JSON.stringify(built.codebook));
    state.themes = JSON.parse(JSON.stringify(d.themes));
    state.dimensions = JSON.parse(JSON.stringify(d.dimensions));
    state._dimensionGroundings = JSON.parse(JSON.stringify(d.groundings));
    state.memos = JSON.parse(JSON.stringify(d.memos));
    state.projectMemo = d.projectMemo;
    state._themeAuditTrail = null;
    state._abductionStats = null;
    state._driftWarnings = [];

    window._demoMode = true;

    saveSession();
    showView('coding');
    renderCodingView();
    this._injectBanner();
    showStatus(t('demo_loaded'));

    const codingEl = document.getElementById('view-coding');
    if (codingEl) codingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  _injectBanner() {
    document.querySelectorAll('.demo-banner').forEach(el => el.remove());
    const views = ['view-coding', 'view-codebook', 'view-viz', 'view-export'];
    for (const viewId of views) {
      const panel = document.getElementById(viewId);
      if (panel) {
        const banner = document.createElement('div');
        banner.className = 'demo-banner';
        banner.innerHTML = '<strong>Demo mode</strong> — ' + t('demo_guide_banner');
        panel.insertBefore(banner, panel.firstChild);
      }
    }
  },

  isActive() { return window._demoMode === true; },

  exit() {
    window._demoMode = false;
    document.querySelectorAll('.demo-banner').forEach(el => el.remove());
    dismissSession();
  }
};
