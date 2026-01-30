import * as op from "./utils/operators.js";
import cardMatchesFilters from "./utils/cardFilters.js"
import { resolveTypeByState, normalizeType } from "./utils/utils.js"
import KeywordLayer from "./utils/keywords.js"

let UID_COUNTER = 0;

function nextUID() {
    UID_COUNTER++;
    return String(UID_COUNTER);
}


function sendDeckToRuntime(runtime) {
    const sections = Object.keys(runtime.lifeAsDev.DeckCreator.deck);

    for (const sec of sections) {
        const entries = Object.entries(runtime.lifeAsDev.DeckCreator.deck[sec]); // [name, qty]
        for (let i = 0; i < entries.length; i++) {
            const [name, qty] = entries[i];

            // buscar índice dentro de CARD_DATA
            const CARD_DB = runtime.lifeAsDev.DeckCreator.CARD_DATA;

            const card = Object.values(CARD_DB)
                .find(c => {
                    return c.name.toLowerCase() === name.toLowerCase()
                });

            if (!card) {
                continue;
            }


            if (qty === 0) continue;
            // determinar el tipo de deck según sección
            let deckType = "";
            let isRuler = false;
            switch (sec) {
                case "main":
                    deckType = "deck" + runtime.globalVars.myOwner;

                    break;

                case "runes":
                    deckType = "rune" + runtime.globalVars.myOwner;
                    break;

                case "stones":
                    deckType = "stones" + runtime.globalVars.myOwner;
                    break;

                case "ruler":
                    isRuler = true;
                    break;
            }

            // enviar la cantidad correspondiente
            for (let q = 0; q < qty; q++) {
                if (isRuler) {
                    // rulers se envían a createRuler
                    runtime.callFunction("createRuler", card.id);
                } else {
                    runtime.callFunction("sendToDeck", card.id, deckType);
                    /*      runtime.callFunction("sendToDeck", card.id, "discard" + runtime.globalVars.myOwner); */

                }
            }
        }
    }
}

function executeCardAbilities(localVars, runtime, event) {
    // Obtener card
    const card = runtime.lifeAsDev.cardInstances[localVars.mUID] ?? runtime.lifeAsDev.DeckCreator.CARD_DATA[localVars.cardId];

    const flags = JSON.parse(localVars.dictionary);
    // Construir contexto
    const ctx = {
        self: {
            card,
            cardUID: localVars.mUID,
            flags: flags.data
        },
        trigger: localVars.trigger,
        allCards: [...runtime.lifeAsDev.cards],
        event: event,
        runtime
    };

    if (!card.abilities) return;

    // Ejecutar abilities
    if (localVars.skillIndex === -1) {
        // ejecutar todas las continuous

        for (const ability of card.abilities) {
            if (ability.trigger === localVars.trigger) {
                runtime.lifeAsDev.checked = op.runAbilitySync(ctx, ability);
            }
        }
    } else {
        // ejecutar habilidad individual
        if (localVars.trigger === "checkCost") {
            runtime.lifeAsDev.checked = op.runAbilitySync(ctx, card.abilities[localVars.skillIndex]);
        } else
        ctx.mode = "resolve";
            op.runAbility(ctx, card.abilities[localVars.skillIndex]);

    }
}

const discardEndTurnTo7Cards = {
    trigger: "activate",
    steps: [
        {
            action: "filterCards",
            state: "hand",
            owner: 1,
            value: "hand"
        },
        {
            action: "cardCount",
            from: "hand",
            owner: 1,
            value: "handCount",
        },
        {
            action: "checkConditionAndAbort",
            conditions: [{
                op: ">",
                left: "handCount",
                right: 7
            }]
        },
        {
            action: "math",
            op: "-",
            a: "handCount",
            b: 7,
            result: "discardCount",
        },
        {
            action: "chooseCard",
            from: "hand",
            count: "discardCount",
            value: "chosen",
        },
        {
            action: "sendToDeck",
            from: "chosen",
            target: "discard",
        },

    ],
};




const scriptsInEvents = {

	async EventDeck_Event3_Act3(runtime, localVars)
	{
		runtime.lifeAsDev.DeckCreator.setupIfReady();
		
	},

	async EventSheet1_Event8_Act2(runtime, localVars)
	{

	},

	async EventRoomList_Event1_Act6(runtime, localVars)
	{
			runtime.__pendingAbilityResolve = null;
		
			// 2️⃣ Estado lógico del motor
			runtime.lifeAsDev.resolve = [];
			runtime.lifeAsDev.endTurnAbilitys = [];
			runtime.lifeAsDev.cardInstances = {};
			runtime.lifeAsDev.event = {};
			runtime.lifeAsDev.keywordLayer = new KeywordLayer(runtime);
			runtime.oncePerTurn = new Set();
			runtime.lifeAsDev.DeckCreator.reset?.();
			runtime.lifeAsDev.DeckCreator.loadFromStorage?.();
		
	},

	async EventRoomList_Event5_Act3(runtime, localVars)
	{
		Lobby.goToDeck = () => {
		    runtime.callFunction("goTo","Deck");
		};
		Lobby.onRefreshRooms = () => {
		    runtime.callFunction("refresh");
		};
		Lobby.onCreateRoom = (name) => {
		    runtime.callFunction("createGame",name,"host");
		};
	},

	async EventRoomList_Event8(runtime, localVars)
	{
		const rooms = localVars.roomList.split("|").filter(r => r !== "");
		
		Lobby.updateRoomList(rooms);
	},

	async EventAutomatic_Event4_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.DeckCreator.deck = {
		    "ruler": {
		        "Arthur": 1,"Lucifer":0
		    },
		    "main": {
		        "Freya's Transforming Cane": 0,
		        "Repair Bug": 0,
		        "Mini Leviathan": 0,
		        "Mecha Leviathan":0,
		        "Wheel Drone": 0,
		        "Precision-Guided Munition, Sky Beat": 0,
		        "Mordred, the Operator": 0,
		        "Super Mobile Fortress Camelot": 0,
		        "Guinevere, The Mobility Queen": 0,
		        "Skyfall": 0,
		        "Mechanized Knight": 0,
		        "Sky Round Guardian": 0,
		        "Merlin, the Control Unit of Sky Round": 0,
		        "Sky Round Musketeer": 0,
		        "Mechanical Bishop": 0,
		        "Perceval, the Shining Knight": 0,
		        "Mechanical Soldier":0,
		        "Donut Drone": 0,
		        "Gawain, the Swift Knight": 0,
		        "Sky Round Technician": 0,
		        "Skynet": 5,
		        "Butterfly Gimmick": 10,
		        "The Knight's Castle in the Sky, Sky Round": 0,
		        "Arondight, the Nitrogen Blade": 2,
		        "Lancelot, the Glass Knight": 0,
		        "Skeleton Horde":0,
		        "Wanderer of the Abyss":0,"Azazel, the Fallen Angel of Gloom":0,"Diseased Rat":0,
		        "Astema, the Returnee of Hatred":0,"Dark Soldier of the Fallen":0,"Armaros, the Fallen Angel of Nullification":0,"Bottomless Chasm of Death, the Abyss":0,"Sacrificial Altar":0,"Belial, the Evil from the Scriptures":0,"Alseid, the Harvester":0,
		        "Soul Prison":0,
		        "Orchard of the Immortals":0,"Immortal Commander":0,"corpse sorcerer":1,"March of the Dead":1, "Skynet": 0,"Ocean Beam": 0,"Scrap and Build": 0,
		        "Whispers of the Devil":0
		    },
		    "stones": {
		        "Magic Stone of Chaos": 8,
		        "Magic Stone of Dramaturgy": 0,
		        "Water Magic Stone": 4,"Darkness Magic Stone": 8,
		        "Magic Stone of the Undead":0, 
		        "Magic Stone of Corruption":0,
		    },
		    "runes": {
		        "Ocean Beam": 0,
		        "Scrap and Build": 1,
		        "Anti-Matter Cannon, Excalibur": 0,
		        "Caliburn, the Sword of Judgment": 0,
		        "Maintenance": 0,"Demon Division":0,
		        "Jet-Black Wings":0,"Black Rosario":0,
		        "Skynet": 0,"Whispers of the Devil":1,"Undeath":1
		    },
		    "side": {}
		}
	},

	async EventAutomatic_Event12_Act3(runtime, localVars)
	{
		window.onChatSend = (msg) => {
		    runtime.callFunction("sendChatMessage",msg);
		};
	},

	async EventAutomatic_Event27_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.DeckCreator.deck = {
		    "ruler": {
		        "Arthur": 1
		    },
		    "main": {
		        "Freya's Transforming Cane": 2,
		        "Repair Bug": 4,
		        "Mini Leviathan": 3,
		        "Mecha Leviathan": 2,
		        "Wheel Drone": 1,
		        "Precision-Guided Munition, Sky Beat": 1,
		        "Mordred, the Operator": 2,
		        "Super Mobile Fortress Camelot": 2,
		        "Guinevere, The Mobility Queen": 1,
		        "Skyfall": 2,
		        "Mechanized Knight": 4,
		        "Sky Round Guardian": 2,
		        "Merlin, the Control Unit of Sky Round": 1,
		        "Sky Round Musketeer": 2,
		        "Mechanical Bishop": 2,
		        "Perceval, the Shining Knight": 1,
		        "Mechanical Soldier": 3,
		        "Donut Drone": 4,
		        "Gawain, the Swift Knight": 4,
		        "Sky Round Technician": 2,
		        "Skynet": 1,
		        "Butterfly Gimmick": 4,
		        "The Knight's Castle in the Sky, Sky Round": 4,
		        "Arondight, the Nitrogen Blade": 2,
		        "Lancelot, the Glass Knight": 2
		    },
		    "stones": {
		        "Magic Stone of Chaos": 4,
		        "Magic Stone of Dramaturgy": 4,
		        "Water Magic Stone": 4
		    },
		    "runes": {
		        "Ocean Beam": 1,
		        "Scrap and Build": 1,
		        "Anti-Matter Cannon, Excalibur": 1,
		        "Caliburn, the Sword of Judgment": 1,
		        "Maintenance": 1
		    },
		    "side": {}
		}
	},

	async EventAutomatic_Event29_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.DeckCreator.deck ={
		    "ruler": {
		      "Lucifer": 1
		    },
		    "main": {
		      "Belial, the Evil from the Scriptures": 1,
		      "Skeleton Horde": 4,
		      "Wanderer of the Abyss": 4,
		      "Azazel, the Fallen Angel of Gloom": 2,
		      "Diseased Rat": 4,
		      "Astema, the Returnee of Hatred": 1,
		      "Dark Soldier of the Fallen": 4,
		      "Armaros, the Fallen Angel of Nullification": 1,
		      "Bottomless Chasm of Death, the Abyss": 2,
		      "Soul Prison": 1,
		      "Sewing Zombie": 4,
		      "Sacrificial Altar": 3,
		      "Contract Demon": 2,
		      "Immortal Commander": 2,
		      "March of the Dead": 4,
		      "Alseid, the Harvester": 2,
		      "Corpse Sorcerer": 3,
		      "Orchard of the Immortals": 1,
		      "Skeleton Knight": 1,
		      "Believer Blinded by Faith": 4,
		      "Fallen Angel of the Ritual": 4,
		      "Ruins of Neverending Rain, Rainruins": 2,
		      "Whispers of the Devil": 2
		    },
		    "stones": {
		      "Magic Stone of Corruption": 4,
		      "Darkness Magic Stone": 8,
		      "Magic Stone of the Undead": 4
		    },
		    "runes": {
		      "Jet-Black Wings": 1,
		      "Undeath": 1,
		      "Black Rosario": 1,
		      "Demon Division": 2
		    },
		    "side": {}
		  }
		
	},

	async EventAutomatic_Event33_Act1(runtime, localVars)
	{
		sendDeckToRuntime(runtime);
	},

	async EventAutomatic_Event80_Act1(runtime, localVars)
	{
let msg = localVars.p1;

// si el mensaje viene de otro jugador
    msg = `<span class="opponent-tag">Opponent:</span> ${msg}`;


window.ChatUI.addMessage(msg, true);

	},

	async EventAutomatic_Event87_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event91_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event92_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event96_Act2(runtime, localVars)
	{

	},

	async EventAutomatic_Event97_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event131_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event192(runtime, localVars)
	{
		const message = {
			type:localVars.type,
			p1:localVars.p1,
			p2:localVars.p2,
			p3:localVars.p3,
			p4:localVars.p4,
			p5:localVars.p5,
		    p6:localVars.p6,
		    p7:localVars.p7
		}
		localVars.message = JSON.stringify(message);
	},

	async EventAutomatic_Event288_Act2(runtime, localVars)
	{

	},

	async EventAutomatic_Event311_Act3(runtime, localVars)
	{
		runtime.resolveAbility(localVars.option);
	},

	async EventAutomatic_Event323_Act2(runtime, localVars)
	{
		runtime.oncePerTurn?.clear();
	},

	async EventAutomatic_Event365_Act1(runtime, localVars)
	{
		  const card = {
		    card: 
		    {},
		   cardUID: "cardUID",
		    flags: {owner:runtime.globalVars.playerTurn}
		};
		          runtime.lifeAsDev.resolve.unshift({
		                    ability:discardEndTurnTo7Cards,
		                    event: structuredClone(runtime.lifeAsDev.event),
		                    card
		                });
	},

	async EventAutomatic_Event366_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.keywordLayer.onEndOfTurn();
		
		runtime.lifeAsDev.event = {
		    type: "endTurn",
		    gameTurn: runtime.globalVars.gameTurn
		};
		
		
		
	},

	async EventAutomatic_Event366_Act5(runtime, localVars)
	{

	},

	async EventAutomatic_Event372_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.decks = {};
	},

	async EventAutomatic_Event373_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.decks[localVars.arrType] = [];
	},

	async EventAutomatic_Event374_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.decks[localVars.arrType].push(runtime.lifeAsDev.card);
	},

	async EventAutomatic_Event376(runtime, localVars)
	{
		const resolving = runtime.lifeAsDev.resolve[0];
		localVars.resolveType = resolving.action ?? "effect";
		
	},

	async EventAutomatic_Event378(runtime, localVars)
	{
		const resolving = runtime.lifeAsDev.resolve.shift();
		
	},

	async EventAutomatic_Event383(runtime, localVars)
	{
const resolving = runtime.lifeAsDev.resolve.shift();
const mainOwner = runtime.globalVars.mainOwner;
const ctx = {
    self: {
        card: resolving.card.card,
        cardUID: resolving.card.cardUID,
        flags: resolving.card.flags
    },
    trigger: localVars.trigger,
    allCards: [...runtime.lifeAsDev.cards],
    event: resolving.event,
    runtime,
    decks: runtime.lifeAsDev.decks,
    mode:"resolve"
};
const type = resolving.card.card.type;


runtime.callFunction("resolvingEffect",resolving.card.cardUID);

if(resolving.cancelled) {
    runtime.callFunction("destroyResolveEffect",resolving.card.cardUID);
    return runtime.callFunction("resolveChase");
    }

await op.runAbility(ctx, resolving.ability);

runtime.callFunction("destroyResolveEffect",resolving.card.cardUID);

if (type === "Rune"||type ==="Chant" || type === "Master Rune") {
    const deck = type === "Chant" ? "discard" : "rev. runes";
    const zone = `${deck}${resolving.card.flags.owner}`;
console.log(zone);
    runtime.callFunction(
        "cardToDeck",
        resolving.card.cardUID,
        zone,
        1
    );
}

runtime.callFunction("resolveChase");

	},

	async EventAutomatic_Event394_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.resolve = [];
	},

	async EventAutomatic_Event403_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event403_Act3(runtime, localVars)
	{

	},

	async EventAutomatic_Event406_Act4(runtime, localVars)
	{

	},

	async EventAutomatic_Event408(runtime, localVars)
	{
		if(runtime.lifeAsDev.resolve.length > 0){
		    runtime.callFunction("resolveInstance",runtime.lifeAsDev.resolve[0].card.cardUID,"");
		}else runtime.callFunction("endChase");
	},

	async EventAutomatic_Event424_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event425(runtime, localVars)
	{
		for(let card of runtime.lifeAsDev.resolve){
		    if(card.action !== "playToField")
		    runtime.callFunction("triggerResolveEffect", card.card.cardUID);
		}
		
	},

	async EventAutomatic_Event438_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event438_Act2(runtime, localVars)
	{

	},

	async EventAutomatic_Event439_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event445_Act1(runtime, localVars)
	{
		localVars.checked = runtime.lifeAsDev.checked?1:0;
		
	},

	async EventAutomatic_Event454_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event536_Act4(runtime, localVars)
	{
		runtime.callFunction("showOptions",localVars.stringify+"|");
	},

	async EventAutomatic_Event539(runtime, localVars)
	{
		runtime.lifeAsDev.costs = JSON.parse(localVars.cost);
		localVars.costCount =runtime.lifeAsDev.costs.length ;
	},

	async EventAutomatic_Event540_Act2(runtime, localVars)
	{
		localVars.produce = runtime.lifeAsDev.costs[localVars.index];
	},

	async EventAutomatic_Event542_Act4(runtime, localVars)
	{
		runtime.resolveAbility(localVars.cost);
	},

	async EventAutomatic_Event547(runtime, localVars)
	{
		const resolving = runtime.lifeAsDev.card
		const mUID = localVars.mUID;
		const index = localVars.index;
		const ctx = {
		    self: {
		        card: resolving.card,
		        cardUID: resolving.cardUID,
		        flags: resolving.flags
		    },
		    trigger: localVars.trigger,
		    allCards: [...runtime.lifeAsDev.cards],
		    runtime,
		    decks: runtime.lifeAsDev.decks,
		    mode:"activate"
		};
		
		await op.runAbility(ctx, resolving.card.abilities[localVars.index]);
		
		runtime.callFunction("endActivateAbility",mUID,index);
		
	},

	async EventAutomatic_Event551(runtime, localVars)
	{
		const resolving = runtime.lifeAsDev.card
		
		const ctx = {
		    self: {
		        card: resolving.card,
		        cardUID: resolving.cardUID,
		        flags: resolving.flags
		    },
		    trigger: localVars.trigger,
		    allCards: [...runtime.lifeAsDev.cards],
		    runtime,
		    decks: runtime.lifeAsDev.decks,
		    mode:"verify"
		};
		
		runtime.lifeAsDev.checked = op.runAbilitySync(ctx, resolving.card.abilities[localVars.index]);
	},

	async EventAutomatic_Event566_Act1(runtime, localVars)
	{
		runtime.resolveAbility(1);
	},

	async EventAutomatic_Event567_Act5(runtime, localVars)
	{
		runtime.resolveAbility(0);
	},

	async EventAutomatic_Event584_Act1(runtime, localVars)
	{
		localVars.cardDataStringify = JSON.stringify(runtime.lifeAsDev.cardInstances);
	},

	async EventAutomatic_Event647_Act1(runtime, localVars)
	{
		localVars.checked = runtime.lifeAsDev.checked?1:0;
		
	},

	async EventAutomatic_Event671_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
	},

	async EventAutomatic_Event673_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.cards.push(
		runtime.lifeAsDev.card
		);
	},

	async EventAutomatic_Event674_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
	},

	async EventAutomatic_Event676_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.cards.push(
		runtime.lifeAsDev.card
		);
	},

	async EventAutomatic_Event678_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.cards.push(
		runtime.lifeAsDev.card
		);
	},

	async EventAutomatic_Event679_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
	},

	async EventAutomatic_Event681_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.cards.push(
		runtime.lifeAsDev.card
		);
	},

	async EventAutomatic_Event683_Act1(runtime, localVars)
	{
		for (let card of runtime.lifeAsDev.cards) {
		    const ctx = {
		        self: card,
		        trigger: "checkCost",
		        allCards: [...runtime.lifeAsDev.cards],
		        runtime,
		        event: runtime.lifeAsDev.event,
		        mode: "activate"
		    };
		
		    if (!card.card.abilities) continue;
		    for (const ability of card.card.abilities) {
		        if (ability.trigger === "automatic") {
		            const push = op.runAbilitySync(ctx, ability);
		         
		            if (push) {
		                runtime.globalVars.canPay = 1;
		                runtime.lifeAsDev.resolve.unshift({
		                    ability,
		                    event: structuredClone(runtime.lifeAsDev.event),
		                    card
		                });
		
		            }
		        }
		    }
		}
		
		localVars.count = runtime.lifeAsDev.resolve.length;
	},

	async EventAutomatic_Event685_Act1(runtime, localVars)
	{
		for (let card of runtime.lifeAsDev.cards) {
		    const ctx = {
		        self: card,
		        trigger: "continuous",
		        allCards: [...runtime.lifeAsDev.cards],
		        runtime,
		        event: runtime.lifeAsDev.event,
		        mode: "resolve"
		    };
		
		    if (!card.card.abilities) continue;
		    for (const ability of card.card.abilities) {
		        if (ability.trigger === "continuous") {
		            const push = op.runAbility(ctx, ability);
		       
		        }
		    }
		}
		
		localVars.count = runtime.lifeAsDev.resolve.length;
	},

	async EventAutomatic_Event701_Act3(runtime, localVars)
	{
		const cardData = runtime.lifeAsDev.DeckCreator.CARD_DATA[localVars.cardID];
		
		runtime.lifeAsDev.cardInstances[localVars.cardUID] = 
		structuredClone(cardData);
		
	},

	async EventAutomatic_Event701_Act4(runtime, localVars)
	{
		 const card = runtime.lifeAsDev.cardInstances[localVars.cardUID];
		
		runtime.lifeAsDev.keywordLayer.initFromCard(
		  localVars.cardUID,
		  card
		);
		
	},

	async EventAutomatic_Event702_Act9(runtime, localVars)
	{
		const cardInstance = structuredClone(runtime.lifeAsDev.card);
		
		runtime.lifeAsDev.event = {
		    type: "enter",
		    cards: [cardInstance]
		};
		
	},

	async EventAutomatic_Event702_Act10(runtime, localVars)
	{

	},

	async EventAutomatic_Event705_Act3(runtime, localVars)
	{

	},

	async EventAutomatic_Event708_Act11(runtime, localVars)
	{
		const cardInstance = structuredClone(runtime.lifeAsDev.card);
		
		runtime.lifeAsDev.event = {
		    type: "enter",
		    cards: [cardInstance]
		};
		
	},

	async EventAutomatic_Event716(runtime, localVars)
	{
		runtime.lifeAsDev.resolving = {
		    action: "playToField",
		    card: runtime.lifeAsDev.card
		};
		runtime.lifeAsDev.resolve.unshift(runtime.lifeAsDev.resolving);
	},

	async EventAutomatic_Event726(runtime, localVars)
	{
		runtime.lifeAsDev.resolving = {
		    ability: runtime.lifeAsDev.card.card.abilities[localVars.index],
		    event: structuredClone(runtime.lifeAsDev.event),
		    card: runtime.lifeAsDev.card
		};
		runtime.lifeAsDev.resolve.unshift(runtime.lifeAsDev.resolving);
	},

	async EventAutomatic_Event728(runtime, localVars)
	{
		runtime.lifeAsDev.resolving = {
		    ability: runtime.lifeAsDev.card.card.abilities[localVars.skillIndex],
		    event: structuredClone(runtime.lifeAsDev.event),
		    card: runtime.lifeAsDev.card
		};
		runtime.lifeAsDev.resolve.unshift(runtime.lifeAsDev.resolving);
		
		
	},

	async EventAutomatic_Event737_Act12(runtime, localVars)
	{
		// Obtener arrays separados
		const cardUID = localVars.cardsUID;
		const flags = JSON.parse(localVars.dictionary);
		
		const cardData = runtime.lifeAsDev.cardInstances[cardUID];
		
		runtime.lifeAsDev.card = {
		    card: cardData,
		    cardUID,
		    flags: flags.data
		};
	},

	async EventAutomatic_Event738_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
	},

	async EventAutomatic_Event740_Act2(runtime, localVars)
	{
		runtime.lifeAsDev.cards.push(
		runtime.lifeAsDev.card
		);
	},

	async EventAutomatic_Event742_Act7(runtime, localVars)
	{
		executeCardAbilities(localVars,runtime);
	},

	async EventAutomatic_Event781_Act4(runtime, localVars)
	{
		const vars = JSON.parse(localVars.stepVars);
		runtime.resolveAbility(vars);
		
	},

	async EventAutomatic_Event793_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
		runtime.lifeAsDev.cards2 = [];
	},

	async EventAutomatic_Event798_Act1(runtime, localVars)
	{
		
		runtime.lifeAsDev[localVars.pile].push(
		runtime.lifeAsDev.card
		);
		
	},

	async EventAutomatic_Event800_Act2(runtime, localVars)
	{
		
		
		runtime.resolveAbility(runtime.lifeAsDev.cards,runtime.lifeAsDev.cards2);
		
	},

	async EventAutomatic_Event801_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
	},

	async EventAutomatic_Event805_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards.push(runtime.lifeAsDev.card);
		
	},

	async EventAutomatic_Event817_Act1(runtime, localVars)
	{
		runtime.resolveAbility(runtime.lifeAsDev.cards);
		
	},

	async EventAutomatic_Event818_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
	},

	async EventAutomatic_Event823_Act1(runtime, localVars)
	{
		// Obtener arrays separados
		const cardUID = localVars.cardsUID;
		const flags = JSON.parse(localVars.dictionary);
		const counters = parseCounters(localVars.countersString);
		const cardData = runtime.lifeAsDev.cardInstances[localVars.cardsUID];
		
		runtime.lifeAsDev.cards.push(
		 {
		        card: cardData,
		        cardUID,
		        counters,
		        flags:flags.data
		    }
		);
		
	},

	async EventAutomatic_Event828_Act1(runtime, localVars)
	{
		runtime.resolveAbility(runtime.lifeAsDev.cards);
		
	},

	async EventAutomatic_Event829_Act1(runtime, localVars)
	{
		runtime.lifeAsDev.cards = [];
	},

	async EventAutomatic_Event831_Act2(runtime, localVars)
	{


runtime.resolveAbility(`group${localVars.picked}`);

	},

	async EventAutomatic_Event837_Act2(runtime, localVars)
	{
		runtime.resolveAbility();
		
	},

	async EventAutomatic_Event842_Act1(runtime, localVars)
	{
		const entry = runtime.lifeAsDev.card;
		const filters = JSON.parse(localVars.filters);
		
		const passed = op.cardMatchesFilters(entry, filters);
		
		
		if (!passed) {
		    localVars.pickCard = 0;
		}
		
	},

	async EventAutomatic_Event845(runtime, localVars)
	{
		const options =JSON.parse(localVars.stringify);
		localVars.cardsId = options
		    .map(effect => effect.item.card.card.id) // Extraer los cardId
		    .join("|"); // Unirlos con "|"
		
		localVars.cardsIndex = options
		    .map(effect => effect.index) // Extraer los cardId
		    .join("|"); // Unirlos con "|"    
	},

	async EventAutomatic_Event850(runtime, localVars)
	{
		const cards = JSON.parse(localVars.stringify);
		const arrPeep = runtime.objects.arrPeep.getFirstInstance();
		
		arrPeep.setSize(cards.length, 3, 1);
		
		for (let i = 0; i < cards.length; i++) {
		    const cardId = cards[i].card.id;
		    const cardUID   = cards[i].cardUID;
		    const marked    = cards[i].flags?.marked ? 1 : 0;
		    arrPeep.setAt(cardId, i, 1, 0); // columna 0: cardId
		    arrPeep.setAt(cardUID,   i, 0, 0); // columna 1: cardUID
		    arrPeep.setAt(marked,    i, 2, 0); // columna 2: marked
		}
		
	},

	async EventAutomatic_Event854_Act3(runtime, localVars)
	{
		runtime.lifeAsDev.cards= JSON.parse(localVars.stringify);
		
	},

	async EventAutomatic_Event855(runtime, localVars)
	{
		localVars.cardCount = runtime.lifeAsDev.cards[localVars.group].length;
	},

	async EventAutomatic_Event856_Act2(runtime, localVars)
	{
		localVars.mUID = runtime.lifeAsDev.cards[localVars.group][localVars.index].cardUID;
	},

	async EventAutomatic_Event860(runtime, localVars)
	{
		const cards = JSON.parse(localVars.stringify);
		const arrPeep = runtime.objects.arrPeep.getFirstInstance();
		
		arrPeep.setSize(cards.length, 3, 1);
		
		for (let i = 0; i < cards.length; i++) {
		    const cardId = cards[i].card.id;
		    const cardUID   = cards[i].cardUID;
		    const marked    = cards[i].flags?.marked ? 1 : 0;
		    arrPeep.setAt(cardId, i, 1, 0); // columna 0: cardId
		    arrPeep.setAt(cardUID,   i, 0, 0); // columna 1: cardUID
		    arrPeep.setAt(marked,    i, 2, 0); // columna 2: marked
		}
		
	},

	async EventAutomatic_Event865(runtime, localVars)
	{
		const cards = JSON.parse(localVars.stringify);
		const arrPeep = runtime.objects.arrPeep.getFirstInstance();
		arrPeep.setSize(cards.length, 3, 1);
		
		for (let i = 0; i < cards.length; i++) {
		    const cardId = cards[i].card.id;
		    const cardUID   = cards[i].cardUID;
		    const marked    = cards[i].flags?.marked ? 1 : 0;
		    arrPeep.setAt(cardId, i, 1, 0); // columna 0: cardId
		    arrPeep.setAt(cardUID,   i, 0, 0); // columna 1: cardUID
		    arrPeep.setAt(marked,    i, 2, 0); // columna 2: marked
		}
		
	},

	async EventAutomatic_Event869(runtime, localVars)
	{
		const payload = JSON.parse(localVars.stringify);
		
		// 1️⃣ extraer cartas y counterType
		const cards = payload.cards ?? [];
		runtime.globalVars.counterTypeChoose = payload.counterType ?? "default";
		
		const arrPeep = runtime.objects.arrPeep.getFirstInstance();
		
		arrPeep.setSize(cards.length, 3, 1);
		
		for (let i = 0; i < cards.length; i++) {
			const cardId  = cards[i].card.id;
			const cardUID = cards[i].cardUID;
			const marked  = cards[i].flags?.marked ? 1 : 0;
		
			// col 0: cardUID
			// col 1: cardId
			// col 2: marked
			arrPeep.setAt(cardUID, i, 0, 0);
			arrPeep.setAt(cardId,  i, 1, 0);
			arrPeep.setAt(marked,  i, 2, 0);
		}
		
	},

	async EventAutomatic_Event873(runtime, localVars)
	{
		const cards = JSON.parse(localVars.stringify);
		const arrPeep = runtime.objects.arrPeep.getFirstInstance();
		arrPeep.setSize(cards.length, 3, 1);
		
		for (let i = 0; i < cards.length; i++) {
		    const cardId = cards[i].card.id;
		    const cardUID   = cards[i].cardUID;
		    const marked    = cards[i].flags?.marked ? 1 : 0;
		    arrPeep.setAt(cardId, i, 1, 0); // columna 0: cardId
		    arrPeep.setAt(cardUID,   i, 0, 0); // columna 1: cardUID
		    arrPeep.setAt(marked,    i, 2, 0); // columna 2: marked
		}
		
	},

	async EventAutomatic_Event894_Act1(runtime, localVars)
	{
		 const card = runtime.lifeAsDev.cardInstances[localVars.mUID];
		runtime.lifeAsDev.keywordLayer.removeAll(localVars.mUID);
		
		runtime.lifeAsDev.keywordLayer.initFromCard(
		  localVars.mUID,
		  card
		);
		
		runtime.lifeAsDev.keywordLayer.exportData();
		
	},

	async EventAutomatic_Event902(runtime, localVars)
	{
		const instanceCard = runtime.objects.card.getFirstPickedInstance();
		const cardInstance = structuredClone(runtime.lifeAsDev.card);
		
		runtime.lifeAsDev.event = {
		    type: "zoneChange",
		    cards: [cardInstance],
		    from: instanceCard.instVars.from.replace("1","").replace("0",""),
		    to: localVars.arr.replace("1","").replace("0",""),
		};
		
	},

	async EventAutomatic_Event962_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event963_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event964_Act2(runtime, localVars)
	{
		console.log(localVars.cardD,runtime.lifeAsDev.cardInstances[localVars.cardD]);
	},

	async EventAutomatic_Event980_Act2(runtime, localVars)
	{
		localVars.nextUID = nextUID();
	},

	async EventAutomatic_Event982(runtime, localVars)
	{
		runtime.lifeAsDev.cardInstances[localVars.mUID] = JSON.parse(localVars.dataCard);
		
	},

	async EventAutomatic_Event983_Act1(runtime, localVars)
	{

	},

	async EventAutomatic_Event996_Act1(runtime, localVars)
	{
		const cardDataConst =
		    runtime.lifeAsDev.DeckCreator.CARD_DATA[localVars.cardID];
		
		if (!runtime.lifeAsDev.cardInstances[localVars.mUID]) {
		
		    runtime.lifeAsDev.cardInstances[localVars.mUID] =
		        structuredClone(cardDataConst);
		
		    const cardData =
		        runtime.lifeAsDev.cardInstances[localVars.mUID];
		
		    cardData.mUID = localVars.mUID;
		
		    // ---- RESOLVER TYPE DINÁMICAMENTE ----
		    const rawTypes = normalizeType(cardData.type);
		    const resolvedType = resolveTypeByState(rawTypes, localVars.state);
		
		    cardData.type = resolvedType; // ← SIEMPRE string
		}
		
	},

	async EventAutomatic_Event996_Act3(runtime, localVars)
	{
		const cardData = runtime.lifeAsDev.cardInstances[localVars.mUID];
		
		
		runtime.lifeAsDev.keywordLayer.initFromCard(
		  localVars.mUID,
		  cardData
		);
		
		
		
	},

	async EventAutomatic_Event997(runtime, localVars)
	{
		const instanceCard = runtime.objects.card.getFirstPickedInstance();
		
		const cardData1 = runtime.lifeAsDev.cardInstances[localVars.mUID];
		let cardData = {};
		if (cardData1) {
		    cardData = cardData1;
		} else {
		    cardData = runtime.lifeAsDev.DeckCreator.CARD_DATA[localVars.cardID];
		
		}
		
		
		instanceCard.instVars.atk = cardData.atk ?? 0;
		instanceCard.instVars.def = cardData.def ?? 0;
		instanceCard.instVars.cardImage = cardData.image ?? "";
		instanceCard.instVars.cardId = cardData.id ?? "";
		instanceCard.instVars.token = cardData.isToken ?? 0;
		instanceCard.instVars.divinity = cardData.divinity ?? 0;
		
		const toPipeString = (value) =>
		    Array.isArray(value)
		        ? value.join("|")
		        : value
		            ? String(value)
		            : "";
		
		// Asignaciones
		instanceCard.instVars.type = toPipeString(cardData.type);
		instanceCard.instVars.subtype = toPipeString(cardData.subtype);
		instanceCard.instVars.produce = toPipeString(cardData.produce);
	},

	async EventAutomatic_Event1035_Act4(runtime, localVars)
	{
		const cardData = runtime.lifeAsDev.DeckCreator.CARD_DATA[localVars.cardId];
		
		runtime.lifeAsDev.cardInstances[localVars.mUID] = structuredClone(cardData);
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
