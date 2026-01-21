class KeywordLayer {
    constructor(runtime) {
        this.runtime = runtime;
        this.layer = {}; // { cardUID: { keyword: count } }
        this.eotQueue = []; // [{ cardUID, keyword, value }]
        this.sources = {};    // sourceId -> { keyword, cards:Set }

    }

    exportData() {
        const exportData =
        {
            layer: structuredClone(this.layer),
            eotQueue: structuredClone(this.eotQueue),
            sources: Object.fromEntries(
                Object.entries(this.sources).map(([sourceId, data]) => [
                    sourceId,
                    {
                        keyword: data.keyword,
                        cards: Array.from(data.cards)
                    }
                ])
            )
        };

        return exportData;
    }
    importData(data) {
        // asegurar estructuras existentes
        this.layer ??= {};
        this.eotQueue ??= [];
        this.sources ??= {};

        // fusionar layer
        for (const [cardUID, keywords] of Object.entries(data.layer || {})) {
            this.layer[cardUID] ??= {};
            for (const [keyword, value] of Object.entries(keywords)) {
                this.layer[cardUID][keyword] = value;
            }
        }

        // fusionar eotQueue (append, no replace)
        if (Array.isArray(data.eotQueue)) {
            this.eotQueue.push(...structuredClone(data.eotQueue));
        }

        // fusionar sources
        for (const [sourceId, src] of Object.entries(data.sources || {})) {
            if (!this.sources[sourceId]) {
                this.sources[sourceId] = {
                    keyword: src.keyword,
                    cards: new Set(src.cards)
                };
            } else {
                // merge de cards
                for (const card of src.cards) {
                    this.sources[sourceId].cards.add(card);
                }
            }
        }
    }


    /* ---------- INIT ---------- */

    initFromCard(cardUID, cardData) {
        if (!cardData?.keywords) return;

        for (const keyword of cardData.keywords) {

            this.add(cardUID, keyword, 1);
        }
    }

    /* ---------- CORE ---------- */

    add(cardUID, keyword, value = 1) {

        this.layer[cardUID] ??= {};
        this.layer[cardUID][keyword] =
            (this.layer[cardUID][keyword] ?? 0) + value;

        this.sync(cardUID, keyword);
    }

    remove(cardUID, keyword, value = 1) {
        const cardLayer = this.layer[cardUID];
        if (!cardLayer || cardLayer[keyword] == null) return;

        cardLayer[keyword] -= value;

        if (cardLayer[keyword] <= 0) {
            delete cardLayer[keyword];
        }

        this.sync(cardUID, keyword);
    }


    has(cardUID, keyword) {

        return !!this.layer[cardUID]?.[keyword];
    }

    applyContinuous(keyword, sourceId, targetCards, enable = 1) {
        const prev = this.sources[sourceId];
        // 1️⃣ siempre quitamos la contribución previa de esta source
        if (prev) {
            for (const cardUID of prev.cards) {
                this.remove(cardUID, keyword, 1);
            }
            delete this.sources[sourceId];
        }

        // 2️⃣ si la source ya no está activa, terminamos aquí
        if (!enable) return;

        // 3️⃣ agregamos la nueva declaración
        const set = new Set();
        for (const card of targetCards) {
            this.add(card.cardUID, keyword, 1);
            set.add(card.cardUID);
        }

        // 4️⃣ registramos estado actual
        this.sources[sourceId] = {
            keyword,
            cards: set
        };
    }



    /* ---------- SYNC ---------- */

    sync(cardUID, keyword) {

        this.exportData()
        const enabled = this.has(cardUID, keyword);
        this.runtime.callFunction(
            "setKeyword",
            cardUID,
            keyword,
            1,
            enabled ? 1 : 0
        );
    }

    /* ---------- UNTIL END OF TURN ---------- */

    addUntilEndOfTurn(cardUID, keyword, value = 1) {
        this.add(cardUID, keyword, value);

        this.eotQueue.push({
            cardUID,
            keyword,
            value
        });
    }

    onEndOfTurn() {
        for (const entry of this.eotQueue) {
            this.remove(entry.cardUID, entry.keyword, entry.value);
        }

        this.eotQueue.length = 0;
    }

    /* ---------- CLEANUP ---------- */

    removeAll(cardUID) {
        if (!this.layer[cardUID]) return;
        for (const keyword of Object.keys(this.layer[cardUID])) {
            this.runtime.callFunction(
                "setKeyword",
                cardUID,
                keyword,
                1,
                0
            );
        }

        delete this.layer[cardUID];
    }
}

export default KeywordLayer;