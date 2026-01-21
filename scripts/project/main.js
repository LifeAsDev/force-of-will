import DeckCreator from "./deckClass.js"
import KeywordLayer from "./utils/keywords.js"
runOnStartup(async runtime => {

    async function loadJSON() {
        const res = await fetch("CardDB.json");
        return res.json();
    }

    const cardsData = await loadJSON();


    runtime.lifeAsDev = { resolve: [] };
    runtime.lifeAsDev.cardInstances = {};

    runtime.lifeAsDev.event = {};
    runtime.lifeAsDev.keywordLayer = new KeywordLayer(runtime);

    // ⬅ Ahora sí lo creas con los datos reales
    runtime.lifeAsDev.DeckCreator = new DeckCreator(cardsData);
    runtime.lifeAsDev.endTurnAbilitys = [];

    // ⬅ Y ahora sí puedes cargar storage
    runtime.lifeAsDev.DeckCreator.loadFromStorage();

    // ⬅ Start game callback
    runtime.lifeAsDev.DeckCreator.startGame = () => {
        runtime.callFunction("goTo", "Room List");
    };
    runtime.continueAbilityHandler = function (onResolve) {
        return new Promise(resolve => {
            // Guardamos un handle para el UI
            runtime.__pendingAbilityResolve = (...args) => {
                if (onResolve) onResolve(...args);  // procesa los argumentos
                resolve(...args);                  // continúa la ability
            };
        });
    };

    runtime.resolveAbility = function (...args) {
        if (runtime.__pendingAbilityResolve) {
            runtime.__pendingAbilityResolve(...args);
            runtime.__pendingAbilityResolve = null;
        }
    };

});




