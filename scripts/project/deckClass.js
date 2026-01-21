const SECTION_RULES = {
    ruler: new Set(["Ruler"]),
    main: new Set(["Resonator", "Addition", "Chant"]),
    stones: new Set(["Magic Stone"]),
    runes: new Set(["Rune", "Master Rune"]),
    side: new Set(["Resonator", "Addition", "Chant", "Rune", "Master Rune"])
};

class DeckCreator {
    constructor(cardData) {
        this.CARD_DATA = cardData;
        this.deck = { ruler: {}, main: {}, stones: {}, runes: {}, side: {} };
        this.setupIfReady();
    }
    findCardByName(name) {
        return Object.values(this.CARD_DATA).find(
            c => c.name === name
        );
    }
    getCardTypes(card) {
        if (!card) return [];
        if (Array.isArray(card.type)) return card.type;
        if (typeof card.type === "string") return [card.type];
        return [];
    }

    validateDeck() {
        const errors = [];


        const count = (section) =>
            Object.values(this.deck[section]).reduce((a, b) => a + b, 0);

        const entries = (section) =>
            Object.entries(this.deck[section]);
        for (const section of ["ruler", "main", "stones", "runes", "side"]) {
            for (const [name] of entries(section)) {
                const card = this.findCardByName(name);
                if (!card) continue;

                const cardTypes = this.getCardTypes(card);
                const allowed = SECTION_RULES[section];

                const ok = cardTypes.some(t => allowed.has(t));
                if (!ok) {
                    errors.push(
                        `"${name}" cannot be in ${section} deck (invalid card type).`
                    );
                }
            }
        }


        // ---------- RULER ----------
        const rulerCount = count("ruler");
        if (rulerCount !== 1) {
            errors.push("You must have exactly 1 Ruler.");
        }

        // ---------- MAIN ----------
        const mainCount = count("main");
        if (mainCount < 40) {
            errors.push(`Main Deck has ${mainCount} cards (minimum 40).`);
        }
        if (mainCount > 60) {
            errors.push(`Main Deck has ${mainCount} cards (maximum 60).`);
        }

        for (const [name, qty] of entries("main")) {
            if (qty > 4) {
                errors.push(`Main Deck: "${name}" has ${qty} copies (max 4).`);
            }
        }

        // ---------- STONES ----------
        const stoneCount = count("stones");
        if (stoneCount < 10) {
            errors.push(`Magic Stone Deck has ${stoneCount} cards (minimum 10).`);
        }
        if (stoneCount > 20) {
            errors.push(`Magic Stone Deck has ${stoneCount} cards (maximum 20).`);
        }

        for (const [name, qty] of entries("stones")) {
            const card = this.findCardByName(name);
            if (!card) continue;

            if (!card.isBasic && qty > 4) {
                errors.push(`Magic Stone "${name}" has ${qty} copies (max 4).`);
            }
        }

        // ---------- RUNES ----------
        const runeCount = count("runes");
        if (![0, 5].includes(runeCount)) {
            errors.push(`Rune Deck must have exactly 0 or 5 cards (has ${runeCount}).`);
        }

        let masterRunes = 0;
        for (const [name, qty] of entries("runes")) {
            if (qty > 1) {
                errors.push(`Rune "${name}" has more than 1 copy.`);
            }

            const card = this.findCardByName(name);
            const types = this.getCardTypes(card);
            if (types.includes("Master Rune")) {
                masterRunes++;
            }

        }

        if (masterRunes > 1) {
            errors.push("Rune Deck may contain only 1 Master Rune.");
        }

        // ---------- SIDE ----------
        const sideCount = count("side");
        if (sideCount > 15) {
            errors.push(`Side Deck has ${sideCount} cards (maximum 15).`);
        }

        for (const [name, qty] of entries("side")) {
            if (qty > 4) {
                errors.push(`Side Deck: "${name}" has ${qty} copies (max 4).`);
            }
        }

        return errors;
    }


    getCardByIndex(index) {
        if (!Array.isArray(this.CARD_DATA)) return null;
        if (index < 0 || index >= this.CARD_DATA.length) return null;

        return this.CARD_DATA[index];
    }
    refreshDomRefs() {
        this.searchInput = document.getElementById('search');
        this.resultsEl = document.getElementById('results');
        this.tpl = document.getElementById('result-item-tpl');

        this.sectionEls = {
            ruler: document.getElementById('ruler-list'),
            main: document.getElementById('main-list'),
            stones: document.getElementById('stones-list'),
            runes: document.getElementById('runes-list'),
            side: document.getElementById('side-list')
        };
    }


    setupIfReady() {
        this.refreshDomRefs();

        // Si los elementos NO existen aún → no hacer nada
        if (!this.searchInput || !this.resultsEl || !this.tpl) {
            return false; // UI no lista
        }

        // Solo inicializa una vez
        this.init();

        return true; // todo ok
    }


    init() {
        this.bindSearch();
        this.bindTopButtons();
        this.renderAllSections();
        const startButton = document.getElementById('startGame');
        startButton.addEventListener('click', () => {
            const errors = this.validateDeck();

            if (errors.length) {
                alert("Deck is invalid:\n\n" + errors.join("\n"));
                return;
            }

            if (this.startGame) this.startGame();
        });

    }
    bindSearch() {
        this.searchInput.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;

            const q = e.target.value.trim().toLowerCase();

            this.renderResults(q);
        });
    }

    renderResults(query) {
        this.resultsEl.innerHTML = '';
        if (!query) return;

        const filtered = Object.values(this.CARD_DATA).filter(card =>
            card.type &&
            card.type !== "J-Ruler" &&
            card.name.toLowerCase().includes(query)
        );

        for (const card of filtered) {
            const node = this.tpl.content.cloneNode(true);
            const root = node.querySelector('.result-item');
            root.querySelector('.name').textContent = card.name;
            root.querySelector('.meta').textContent = card.id;
            const buttons = root.querySelectorAll('.btn-add');

            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const section = btn.dataset.section;
                    this.addToSection(section, card.name);
                });
            });

            root.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    // default: add to main (or choose another)
                    this.addToSection('main', card.name);
                }
            });
            this.resultsEl.appendChild(node);
        }
    }
    addToSection(section, name) {
        if (!this.deck[section]) return;
        if (!this.deck[section][name]) {
            this.deck[section][name] = 1;
        } else {
            this.deck[section][name]++;
        } this.renderSection(section);
        this.saveToStorage();
    }
    renderSection(section) {
        const el = this.sectionEls[section];
        el.innerHTML = '';

        const entries = Object.entries(this.deck[section]); // [name, count]

        for (const [name, count] of entries) {
            const item = document.createElement('div');
            item.className = 'card-entry';

            const n = document.createElement('div');
            n.className = 'name';
            n.textContent = name + " x" + count;

            const controls = document.createElement('div');
            controls.className = "controls";

            // ---- BUTTON REMOVE (–) ----
            const btnMinus = document.createElement('button');
            btnMinus.textContent = '-';
            btnMinus.addEventListener('click', () => {
                this.deck[section][name]--;

                if (this.deck[section][name] <= 0) {
                    delete this.deck[section][name];
                }

                this.renderSection(section);
                this.saveToStorage();
            });

            // ---- BUTTON ADD (+) ----
            const btnPlus = document.createElement('button');
            btnPlus.textContent = '+';
            btnPlus.addEventListener('click', () => {
                this.deck[section][name]++;
                this.renderSection(section);
                this.saveToStorage();
            });

            controls.appendChild(btnMinus);
            controls.appendChild(btnPlus);

            item.appendChild(n);
            item.appendChild(controls);
            el.appendChild(item);
        }

        const counter = document.querySelector("[data-section='" + section + "'] .count");
        if (counter) {
            const total = entries.reduce((sum, [, c]) => sum + c, 0);
            counter.textContent = total;
        }
    }

    renderAllSections() {
        for (const s of Object.keys(this.deck)) this.renderSection(s);
    }

    bindTopButtons() {
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('Clear entire deck?')) {
                for (const k of Object.keys(this.deck)) this.deck[k] = {};
                this.renderAllSections();
                this.saveToStorage();
            }
        });
        document.getElementById('btn-export').addEventListener('click', () => {
            const text = this.exportDeckAsText();
            const w = window.open('', '_blank');
            w.document.body.style.whiteSpace = 'pre';
            w.document.body.textContent = text;
        });
        document.getElementById('btn-import').addEventListener('click', () => {
            const text = prompt('Paste deck text (format: SECTION: Card name)');
            if (!text) return;
            this.importDeckFromText(text);
            this.saveToStorage();
            this.renderAllSections();
        });
    }
    exportDeckAsText() {
        let out = [];

        for (const section of Object.keys(this.deck)) {
            const obj = this.deck[section];

            // agrega header tipo: //ruler
            out.push(`//${section}`);

            for (const name of Object.keys(obj)) {
                const qty = obj[name];
                out.push(`${qty} ${name}`);
            }

            out.push(""); // línea en blanco entre secciones
        }

        return out.join("\n");
    }

    importDeckFromText(text) {
        const lines = text.split(/\r?\n/).map(l => l.trim());
        let section = "main";

        for (const l of lines) {
            if (!l) continue;

            // ---- HEADER ----
            const header = l.match(/^\/\/\s*(\w+)/i);
            if (header) {
                section = header[1].toLowerCase();
                if (!this.deck[section]) continue;
                continue;
            }

            // ---- PARSE QTY / NAME ----
            let qty = 1;
            let name = l;

            const m = l.match(/^(\d+)\s+(.+)$/);
            if (m) {
                qty = parseInt(m[1], 10);
                name = m[2];
            }

            // ---- FIND CARD ----
            const card = this.findCardByName(name);
            if (!card) {
                console.log(`"${name}" no encontrada`);
                continue;
            }

            // ---- ONLY REQUIRE: HAS TYPE ----
            if (!card.type) {
                console.log(`"${name}" ignorada (no tiene type)`);
                continue;
            }

            // ---- ADD ----
            if (!this.deck[section][card.name]) {
                this.deck[section][card.name] = 0;
            }

            this.deck[section][card.name] += qty;
        }
    }



    saveToStorage() {
        try {
            const stringify = JSON.stringify(this.deck);
            localStorage.setItem('deck_v1', stringify);
        } catch { }
    }
    loadFromStorage() {
        try {
            const raw = localStorage.getItem('deck_v1');
            if (!raw) return;

            const obj = JSON.parse(raw);
            for (const k of Object.keys(this.deck)) {
                if (obj[k] && typeof obj[k] === "object") {
                    this.deck[k] = obj[k];
                }
            }
            this.renderAllSections();
        } catch { }
    }

}
export default DeckCreator;
