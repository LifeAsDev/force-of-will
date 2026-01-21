// =============================
//  OPERADORES
// =============================
const Operators = {
	">": (a, b) => a > b,
	">=": (a, b) => a >= b,
	"<": (a, b) => a < b,
	"<=": (a, b) => a <= b,
	"==": (a, b) => a == b,
	"===": (a, b) => a === b,
	"!=": (a, b) => a != b,
	"+": (a, b) => a + b,
	"-": (a, b) => a - b,
	"*": (a, b) => a * b,
	"/": (a, b) => a / b,
};

function cardMatchesFilters(entry, filters, ctx) {
	const {
		state,
		type,
		subtype,
		owner,
		flagRequirements,
		name,
		recovered,
		excludeSelf,
		att,
	} = filters;

	const c = entry.card;

	const types = type ? (Array.isArray(type) ? type : [type]) : [];
	const subtypes = subtype
		? Array.isArray(subtype)
			? subtype
			: [subtype]
		: [];
	const names = name ? (Array.isArray(name) ? name : [name]) : [];
	const atts = att ? (Array.isArray(att) ? att : [att]) : [];

	const resolvedOwner = owner !== undefined ? owner : -1;
	const resolvedState = state === "field" ? "" : (state ?? "all");
	const excludeSelfUID = excludeSelf;

	/* ------------------ validación ------------------ */

	const cSubtypes = Array.isArray(c.subtype)
		? c.subtype
		: c.subtype !== undefined
			? [c.subtype]
			: [];

	const typeOk = types.length === 0 || types.includes(c.type);
	const subtypeOk =
		subtypes.length === 0 || cSubtypes.some((st) => subtypes.includes(st));
	const ownerOk = resolvedOwner === -1 || entry.flags.owner === resolvedOwner;
	const stateOk =
		resolvedState === "all" || entry.flags.state === resolvedState;
	const nameOk = names.length === 0 || names.some((n) => c.name?.includes(n));
	const attOk = atts.length === 0 || atts.every((a) => c.att?.includes(a));
	const excludeSelfOk = excludeSelfUID
		? entry.cardUID !== excludeSelfUID
		: true;

	/* ------------------ flags ------------------ */

	const safeResolve = (ctx, value) => (ctx ? resolveValue(ctx, value) : value);
	let rotationReq;
	if (recovered === 1) {
		rotationReq = 0;
	} else if (recovered === 0) {
		rotationReq = 90;
	} else {
		rotationReq = undefined; // "" o undefined → ignorar
	}

	const flagsOk = [
		...(flagRequirements || []),
		...(rotationReq !== undefined
			? [
					{
						key: "rotation",
						min: rotationReq,
						max: rotationReq,
						mustExists: 1,
					},
				]
			: []),
	].every((req) => {
		const hasKey = entry.flags?.hasOwnProperty(req.key);
		const val = hasKey ? entry.flags[req.key] : 0;

		const min = req.min !== undefined ? safeResolve(ctx, req.min) : undefined;
		const max = req.max !== undefined ? safeResolve(ctx, req.max) : undefined;

		if (req.mustExists === 1 && !hasKey) return false;
		if (min !== undefined && val < min) return false;
		if (max !== undefined && val > max) return false;

		return true;
	});

	/* ------------------ barrier ------------------ */

	// Barrier solo importa si el efecto viene del oponente
	if (filters._sourceOwner !== undefined) {
		const isEnemy = entry.flags.owner !== filters._sourceOwner;

		if (isEnemy) {
			const sourceCard = filters._sourceCard;
			const sourceType = sourceCard?.type;

			if (
				(sourceType === "Chant" && entry.flags.BarrierChant) ||
				(sourceType === "Rune" && entry.flags.BarrierRune)
			) {
				return false;
			}
		}
	}

	return (
		typeOk &&
		subtypeOk &&
		ownerOk &&
		stateOk &&
		nameOk &&
		attOk &&
		flagsOk &&
		excludeSelfOk
	);
}

function isValidOwnerTarget(stepOwner, sourceOwner, targetOwner) {
	if (stepOwner === 0) {
		// solo targets del oponente de la carta source
		return targetOwner !== sourceOwner;
	}
	if (stepOwner === 1) {
		// solo targets del mismo dueño que la carta source
		return targetOwner === sourceOwner;
	}
	// si stepOwner no está definido o no es 0/1, permitir cualquier target
	return true;
}
// =============================
//  RESOLVE VALUE
// =============================
function resolveValue(ctx, val) {
	if (typeof val !== "string") return val;

	if (val in ctx.vars) return ctx.vars[val]; // variables guardadas en el contexto

	return val; // fallback
}

// =============================
//  EVALUATE CONDITION
// =============================
function evaluateCondition(ctx, cond) {
	const opFunc = Operators[cond.op];
	if (!opFunc) throw new Error("Unknown op: " + cond.op);

	const left = resolveValue(ctx, cond.left);
	const right = resolveValue(ctx, cond.right);

	return opFunc(left, right);
}

function cloneCards(cards) {
	return cards.map((c) => structuredClone(c));
}

function getTargetCardsOld(ctx, step, t) {
	// 1. Self / Me
	if (t === "self" || t === "me" || t === undefined) {
		return cloneCards([ctx.self]);
	}

	// 2. All cards
	if (t === "all" || t === "allCards") {
		return cloneCards(ctx.allCards ?? []);
	}

	// 3. Event cards
	if (t === "eventCards") {
		return cloneCards(ctx.event?.cards ?? []);
	}

	// 4. Vars → referencia directa (NO clone)
	if (ctx.vars && t in ctx.vars) {
		return ctx.vars[t] ?? [];
	}

	// 5. Default
	return [];
}

function getTargetCards(ctx, step, t) {
	// 1. Self / Me
	if (t === "self" || t === "me" || t === undefined) {
		return [ctx.self];
	}

	// 2. All cards
	if (t === "all" || t === "allCards") {
		return ctx.allCards ?? [];
	}

	// 3. Event cards
	if (t === "eventCards") {
		return ctx.event?.cards ?? [];
	}

	// 4. Vars → referencia directa (NO clone)
	if (ctx.vars && t in ctx.vars) {
		return ctx.vars[t] ?? [];
	}

	// 5. Default
	return [];
}

// =============================
//  HANDLERS
// =============================
const AbilityHandlers = {
	requireChaseEffect(ctx, step) {
		const runtime = ctx.runtime;
		const chase = runtime.lifeAsDev.resolve;

		// variable donde guardar 0 / 1
		const resultVar = step.value ?? "result";

		let condition = false;

		if (!Array.isArray(chase) || chase.length === 0) {
			ctx.vars[resultVar] = 0;
			return;
		}

		// Buscar desde el top del chase
		for (let i = 0; i < chase.length; i++) {
			const item = chase[i];
			const ability = item.ability;
			const sourceCard = item.card;
			const cardData = sourceCard?.card;

			if (!ability || !sourceCard) continue;
			if (item.cancelled) continue;

			// 1. Trigger
			if (step.type && ability.trigger !== step.type) continue;

			// 2. Tipo de carta fuente
			if (step.sourceType && cardData.type !== step.sourceType) continue;

			const sourceOwner = ctx.self.flags.owner;
			const targetOwner = sourceCard.flags.owner;

			if (
				step.owner !== undefined &&
				!isValidOwnerTarget(step.owner, sourceOwner, targetOwner)
			) {
				continue;
			}

			// MATCH
			ctx.targetChaseIndex = i;
			ctx.targetChaseItem = item;

			condition = true;
			break;
		}

		// Guardar resultado como 0 o 1
		ctx.vars[resultVar] = condition ? 1 : 0;
	},

	async chooseChaseEffect(ctx, step) {
		const runtime = ctx.runtime;
		const chase = runtime.lifeAsDev.resolve;
		const effectValue = step.effectValue ?? "value";
		const value = step.value ?? "value";

		if (!Array.isArray(chase) || chase.length === 0) {
			throw { abortAbility: true, result: false };
		}

		const options = [];

		for (let i = 0; i < chase.length; i++) {
			const item = chase[i];
			const ability = item.ability;
			const sourceCard = item.card;
			if (!ability || !sourceCard) continue;

			const cardData = sourceCard.card;
			if (!cardData) continue;
			if (item.cancelled) continue;

			// 1. Trigger
			if (step.type && ability.trigger !== step.type) continue;

			// 2. Tipo de carta fuente
			if (step.sourceType && cardData.type !== step.sourceType) continue;

			const sourceOwner = ctx.self.flags.owner;
			const targetOwner = sourceCard.flags.owner;

			// 3. Owner
			if (
				step.owner !== undefined &&
				!isValidOwnerTarget(step.owner, sourceOwner, targetOwner)
			) {
				continue;
			}

			options.push({
				index: i,
				item,
			});
		}

		if (options.length === 0) {
			throw { abortAbility: true, result: false };
		}

		// 👉 Enviar solo lo que C3 necesita
		runtime.callFunction(
			"chooseChaseEffect",
			JSON.stringify(options),
			step.count,
		);

		// ⏸️ Pausa real del motor
		const continueAbilityHandler = async (chosenCards) => {
			// índices seleccionados (vienen en p3)
			const selectedIndexes = chosenCards
				.map((card) => card.flags?.p3)
				.filter((index) => index !== undefined);

			// Guardar índices
			ctx.vars[effectValue] = selectedIndexes;

			// Guardar cartas SOURCE reales del chase
			ctx.vars[value] = selectedIndexes
				.map((i) => chase[i]?.card)
				.filter(Boolean);
		};

		await runtime.continueAbilityHandler(continueAbilityHandler);
	},
	cancelAbility(ctx, step = {}) {
		const runtime = ctx.runtime;
		const chase = runtime.lifeAsDev.resolve;
		if (!Array.isArray(chase) || chase.length === 0) return;

		const target = step.target;

		let indexes = [];

		// 1️⃣ Prioridad: valor explícito en ctx.vars
		if (target && ctx.vars[target] !== undefined) {
			indexes = ctx.vars[target];
		}

		for (const index of indexes) {
			const item = chase[index];
			if (!item) continue;

			item.cancelled = true;
		}
	},
	requireEventSource(ctx, step) {
		const source = step.source ?? "self";

		// Por ahora, solo tiene sentido self/me
		if (source !== "self" && source !== "me") return;

		const eventCards = ctx.event?.cards ?? [];
		const selfUID = ctx.self?.cardUID;
		const allConditionsMet = eventCards.some((ec) => ec.cardUID === selfUID);
		ctx.vars[step.value ?? "eventSourceMatch"] = allConditionsMet ? 1 : 0;
	},
	requireEvent(ctx, step) {
		const ev = ctx.event;
		const from = step.from === "field" ? "" : step.from;
		const to = step.to;
		// No hay evento → abortar
		if (!ev) {
			return (ctx.vars[step.value ?? "eventMatch"] = 0);
		}

		// Filtrar zona origen
		if (step.from !== undefined && ev.from !== from) {
			return (ctx.vars[step.value ?? "eventMatch"] = 0);
		}

		// Filtrar zona destino
		if (step.to !== undefined && ev.to !== to) {
			return (ctx.vars[step.value ?? "eventMatch"] = 0);
		}
		ctx.vars[step.value ?? "eventMatch"] = 1;
	},
	async dealDividedDamage(ctx, step) {
		const from = step.from ?? "all";
		const optional = step.optional ?? 0;
		const damage = ctx.vars[step.damage] || step.damage || 0;

		const cards = getTargetCards(ctx, step, from);

		const owner = step.owner !== undefined ? resolveWho(step.owner, ctx) : -1;
		const filters = {
			type: step.type ?? "",
			subtype: step.subtype ?? "",
			owner,
			state: step.state ?? "field",
			name: step.name ?? "",
			recovered: step.recovered ?? "",
			att: step.att ? (Array.isArray(step.att) ? step.att : [step.att]) : [],
			flagRequirement: step.flagRequirements ?? [],
			excludeSelf: step.excludeSelf ? ctx.self.cardUID : null,
			_sourceOwner: ctx.self.flags.owner,
			_sourceCard: ctx.self.card,
		};

		const filtered = [];

		for (const entry of cards) {
			const ok = cardMatchesFilters(entry, filters, ctx);
			entry.flags.marked = ok ? 1 : 0;
			if (ok) filtered.push(entry);
		}

		// 👉 mandas SOLO las válidas
		ctx.runtime.callFunction(
			"chooseCard",
			JSON.stringify(filtered),
			damage,
			optional,
			"dividedDamage",
		);

		const continueAbilityHandler = async () => {};
		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	async chooseCard(ctx, step) {
		const excludeSelf = step.excludeSelf ? ctx.self.cardUID : null;
		const count = step.count ? (ctx.vars[step.count] ?? step.count) : 1;

		const optional = step.optional ?? 0;
		const from = step.from ?? "all";

		// 1️⃣ universo
		const cards = getTargetCards(ctx, step, from);

		const filters = {
			type: step.type
				? Array.isArray(step.type)
					? step.type
					: [step.type]
				: [],
			subtype: step.subtype
				? Array.isArray(step.subtype)
					? step.subtype
					: [step.subtype]
				: [],
			owner: step.owner !== undefined ? resolveWho(step.owner, ctx) : -1,
			state: step.state === "field" ? "" : (step.state ?? "all"),
			recovered: step.recovered ?? "",
			name: step.name
				? Array.isArray(step.name)
					? step.name
					: [step.name]
				: [],
			produce: step.produce ?? "",
			flagRequirements: step.flagRequirements || [],
			excludeSelf,
			att: step.att ? (Array.isArray(step.att) ? step.att : [step.att]) : [],
			_sourceOwner: ctx.self.flags.owner,
			_sourceCard: ctx.self.card,
		};

		const filtered = [];

		for (const entry of cards) {
			if (cardMatchesFilters(entry, filters, ctx)) {
				filtered.push(entry);
			}
		}

		// c3 recibe SOLO cartas válidas
		ctx.runtime.callFunction(
			"chooseCard",
			JSON.stringify(filtered),
			count,
			optional,
			"chooseCard",
		);

		const continueAbilityHandler = async (chosenCards) => {
			ctx.vars[step.value] = chosenCards;
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	async chooseCardFrom(ctx, step) {
		const excludeSelf = step.excludeSelf ? ctx.self.cardUID : null;
		const from = step.from ?? "all";
		const count = step.count ?? 1;
		const optional = step.optional ?? 0;

		// 1️⃣ universo
		const cards = getTargetCards(ctx, step, from);

		const types = step.type
			? Array.isArray(step.type)
				? step.type
				: [step.type]
			: [];

		const subtypes = step.subtype
			? Array.isArray(step.subtype)
				? step.subtype
				: [step.subtype]
			: [];

		const owner = step.owner !== undefined ? resolveWho(step.owner, ctx) : -1;

		let state = step.state ?? "all";
		if (state === "field") state = "";

		const names = step.name
			? Array.isArray(step.name)
				? step.name
				: [step.name]
			: [];
		const att = step.att
			? Array.isArray(step.att)
				? step.att
				: [step.att]
			: [];

		const produce = step.produce ?? "";
		const flagRequirement = step.flagRequirements || [];

		// 1️⃣ Marcar cartas que cumplen el filtro
		const marked = [];
		const filters = {
			type: types,
			subtype: subtypes,
			owner,
			state,
			name: names,
			produce,
			flagRequirements: flagRequirement,
			att,
			excludeSelf,

			// 🔴 contexto del efecto (Barrier)
			_sourceOwner: ctx.self.flags.owner,
			_sourceCard: ctx.self.card,
		};

		for (const entry of cards) {
			const ok = cardMatchesFilters(entry, filters, ctx);
			entry.flags.marked = ok ? 1 : 0;
		}

		// 2️⃣ Solo las marcadas pueden elegirse
		ctx.runtime.callFunction(
			"chooseCard",
			JSON.stringify(cards),
			count,
			optional,
			"chooseCardFrom",
		);

		const continueAbilityHandler = async (chosenCards) => {
			ctx.vars[step.value] = chosenCards;
			if (!ctx.vars[from]) {
				return;
			}

			const chosenUIDs = new Set(chosenCards.map((c) => c.cardUID));
			const remaining = cards.filter((entry) => !chosenUIDs.has(entry.cardUID));

			ctx.vars[from] = remaining;
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	async chooseTwoPiles(ctx, step) {
		const excludeSelf = step.excludeSelf ? ctx.self.cardUID : null;
		const from = step.from ?? "all";
		const count = step.count ?? 1;
		const optional = step.optional ?? 0;

		// 1️⃣ universo
		const cards = getTargetCards(ctx, step, from);

		const filters = {
			type: step.type
				? Array.isArray(step.type)
					? step.type
					: [step.type]
				: [],
			subtype: step.subtype
				? Array.isArray(step.subtype)
					? step.subtype
					: [step.subtype]
				: [],
			owner: step.owner !== undefined ? resolveWho(step.owner, ctx) : -1,
			state: step.state === "field" ? "" : (step.state ?? "all"),
			name: step.name
				? Array.isArray(step.name)
					? step.name
					: [step.name]
				: [],
			produce: step.produce ?? "",
			flagRequirements: step.flagRequirements || [],
			att: step.att ? (Array.isArray(step.att) ? step.att : [step.att]) : [],
			excludeSelf,

			// 🔴 contexto del efecto (Barrier)
			_sourceOwner: ctx.self.flags.owner,
			_sourceCard: ctx.self.card,
		};

		const filtered = [];

		for (const entry of cards) {
			if (cardMatchesFilters(entry, filters, ctx)) {
				filtered.push(entry);
			}
		}

		// 4️⃣ c3 recibe SOLO cartas válidas
		ctx.runtime.callFunction(
			"chooseCard",
			JSON.stringify(filtered),
			count,
			optional,
			"choosePile",
		);

		const continueAbilityHandler = async (pile1, pile2) => {
			ctx.vars[step.value1] = pile1;
			ctx.vars[step.value2] = pile2;
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	async chooseTwoGroups(ctx, step) {
		const target1 = step.target1 ?? "group1";
		const target2 = step.target2 ?? "group2";
		const value1 = step.value1;
		const value2 = step.value2;
		const list = {
			group1: ctx.vars[target1] || [],
			group2: ctx.vars[target2] || [],
		};

		ctx.runtime.callFunction(
			"chooseCard",
			JSON.stringify(list),
			1,
			1,
			"chooseGroup",
		);

		const continueAbilityHandler = async (chooseGroup) => {
			// 1) Guardar las elegidas
			if (value1) ctx.vars[value1] = list[chooseGroup];
			const otherGroup = chooseGroup === "group1" ? "group2" : "group1";
			if (value2) {
				ctx.vars[value2] = list[otherGroup];
			}
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	async chooseRemoveCounters(ctx, step) {
		const from = step.from ?? "all";
		const count = step.count ?? 1;

		// 1️⃣ universo
		const cards = getTargetCards(ctx, step, from);
		const flagRequirements = [...(step.flagRequirements || [])];

		// Si se quiere remover contadores, la carta DEBE tener ese contador
		if (step.counterType) {
			flagRequirements.push({
				key: step.counterType,
				min: 1,
			});
		}

		// 2️⃣ normalizar filtros
		const filters = {
			type: step.type
				? Array.isArray(step.type)
					? step.type
					: [step.type]
				: [],
			subtype: step.subtype
				? Array.isArray(step.subtype)
					? step.subtype
					: [step.subtype]
				: [],
			owner: step.owner !== undefined ? resolveWho(step.owner, ctx) : -1,
			state: step.state === "field" ? "" : (step.state ?? "all"),
			name: step.name
				? Array.isArray(step.name)
					? step.name
					: [step.name]
				: [],
			produce: step.produce ?? "",
			flagRequirements,
			att: step.att ? (Array.isArray(step.att) ? step.att : [step.att]) : [],
			excludeSelf: step.excludeSelf ? ctx.self.cardUID : null,

			// 🔴 contexto del efecto (Barrier)
			_sourceOwner: ctx.self.flags.owner,
			_sourceCard: ctx.self.card,
		};

		const filtered = [];

		for (const entry of cards) {
			if (cardMatchesFilters(entry, filters, ctx)) {
				filtered.push(entry);
			}
		}

		// 4️⃣ ahora sí, selección de contadores
		ctx.runtime.callFunction(
			"chooseCard",
			JSON.stringify({
				cards: filtered,
				counterType: step.counterType ?? "default",
			}),
			count,
			0,
			"chooseRemoveCounters",
		);

		const continueAbilityHandler = async (chosenCards) => {
			// chosenCards ya viene validado
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	addCounter(ctx, step) {
		const counterType = step.counterType ?? "+100/+100";
		let amount = step.amount;

		// Si es string, interpretar como variable en ctx.vars
		if (typeof amount === "string") {
			amount = ctx.vars[amount];

			// Seguridad: si la variable no existe o no es número → 0
			if (typeof amount !== "number") {
				amount = 0;
			}
		}

		// Si amount sigue sin ser número (null/undefined) → 0
		if (typeof amount !== "number") {
			amount = 0;
		}

		const cards = getTargetCards(ctx, step, step.target);
		for (let card of cards) {
			ctx.runtime.callFunction(
				"addCounterType",
				card.cardUID,
				counterType,
				amount,
			);
		}
	},
	rest(ctx, step) {
		const cards = getTargetCards(ctx, step, step.target);

		for (let card of cards) {
			ctx.runtime.callFunction("restCard", card.cardUID);
		}
	},
	recover(ctx, step) {
		const cards = getTargetCards(ctx, step, step.target);

		for (let card of cards) {
			ctx.runtime.callFunction("recoverCard", card.cardUID);
		}
	},
	getTotalCounterCount(ctx, step) {
		const counterType = step.type ?? "+100/+100";
		const value = step.value ?? "counterCount";
		const cards = getTargetCards(ctx, step, step.target);
		let totalCount = 0;
		for (let card of cards) {
			const value = card.flags[counterType] ?? 0;
			totalCount += value;
		}
		ctx.vars[value] = totalCount;
	},
	totalAtk(ctx, step) {
		const value = step.value ?? "totalAtk";
		const cards = getTargetCards(ctx, step, step.target);
		let totalAtk = 0;

		for (const card of cards) {
			const atk = card.flags?.atk ?? 0; // Asume que el atributo `atk` está en `flags`
			totalAtk += atk;
		}

		ctx.vars[value] = totalAtk; // Guarda el total en el contexto
	},
	setKeyword(ctx, step) {
		const keyword = step.keyword;
		const cards = getTargetCards(ctx, step, step.target);
		const value = ctx.vars[step.value] ?? 1;
		const enable =
			step.enable === undefined ? 1 : (ctx.vars[step.enable] ?? step.enable);

		const layer = ctx.runtime.lifeAsDev.keywordLayer;

		for (const card of cards) {
			if (step.untilEndOfTurn === 1) {
				if (enable) {
					layer.addUntilEndOfTurn(card.cardUID, keyword, value);
				} else {
					// normalmente no se usa, pero lo dejamos correcto
					layer.remove(card.cardUID, keyword, value);
				}
			} else {
				if (enable) {
					layer.add(card.cardUID, keyword, value);
				} else {
					layer.remove(card.cardUID, keyword, value);
				}
			}
		}
	},
	adjustStats(ctx, step) {
		const cards = getTargetCards(ctx, step, step.target);
		const rawStats = step.stats ?? [0, 0];

		let atkDelta = 0;
		let defDelta = 0;

		atkDelta = resolveValue(ctx, rawStats[0]);
		defDelta = resolveValue(ctx, rawStats[1]);

		const enable =
			step.enable === undefined ? 1 : (ctx.vars[step.enable] ?? step.enable);
		const toggleable = step.toggleable ?? 1;
		for (let card of cards) {
			ctx.runtime.callFunction(
				"adjustStats",
				ctx.self.cardUID,
				card.cardUID,
				atkDelta,
				defDelta,
				enable,
				toggleable,
			);
		}
	},
	filterCards(ctx, step) {
		const excludeSelf = step.excludeSelf ? ctx.self.cardUID : null;
		const from = step.from ?? "all";
		const cards = getTargetCards(ctx, step, from);
		const types = step.type
			? Array.isArray(step.type)
				? step.type
				: [step.type]
			: [];

		const subtypes = step.subtype
			? Array.isArray(step.subtype)
				? step.subtype
				: [step.subtype]
			: [];
		const count = step.count;
		const owner = step.owner != undefined ? resolveWho(step.owner, ctx) : -1;
		let state = step.state ?? "all";
		if (state === "field") state = "";
		const names = step.name
			? Array.isArray(step.name)
				? step.name
				: [step.name]
			: [];
		const produce = step.produce ?? "";
		const flagRequirements = step.flagRequirements || [];
		const att = step.att
			? Array.isArray(step.att)
				? step.att
				: [step.att]
			: [];

		const filters = {
			type: types,
			subtype: subtypes,
			owner,
			state,
			name: names,
			produce,
			flagRequirements,
			att,
			excludeSelf,
		};

		let filtered = cards.filter((entry) =>
			cardMatchesFilters(entry, filters, ctx),
		);

		if (count) filtered = filtered.slice(0, count);

		ctx.vars[step.value] = filtered;

		const setToRemove = new Set(filtered);
		const remaining = cards.filter((entry) => !setToRemove.has(entry));

		ctx.vars[from] = remaining;
	},
	calculateTotalCost(ctx, step) {
		const cards = getTargetCards(ctx, step, step.from);
		let total = 0;

		for (const entry of cards) {
			// asumiendo que cada item es { card: { cost: N } }
			const c = entry.card;
			const cost = c?.cost.length ?? 0;

			// si cost no existe → suma 0
			total += cost;
		}
		ctx.vars[step.value] = total;
	},
	sendToDeck(ctx, step) {
		const baseZone = step.target; // "deck", "discard", etc
		const from = step.from;
		const top = step.top ?? 1;

		const list = getTargetCards(ctx, step, from);

		for (const entry of list) {
			let absoluteOwner;

			if (step.owner !== undefined) {
				// owner explícito: 1 = self, 0 = opponent
				const sourceOwner = ctx.self.flags.owner;
				absoluteOwner =
					step.owner === 1 || step.owner === "self"
						? sourceOwner
						: sourceOwner ^ 1;
			} else {
				// owner real de la carta
				absoluteOwner = entry.flags.owner;
			}

			// 🔑 AHORA ES DIRECTO: el índice ES el owner
			const zoneIndex = absoluteOwner; // 0 | 1

			const zoneId = `${baseZone}${zoneIndex}`;

			ctx.runtime.callFunction("cardToDeck", entry.cardUID, zoneId, top);
		}
	},
	async branch(ctx, step) {
		const ok = evaluateCondition(ctx, step.condition);
		if (!ok) return;

		// Ejecutar pasos internos usando EL MISMO MODELO
		for (const innerStep of step.steps || []) {
			const requiresInput = INPUT_STEPS.has(innerStep.action);

			if (requiresInput) {
				const turnPlayer = ctx.runtime.globalVars.myOwner;
				const stepPlayer = resolveWho(innerStep.who, ctx);

				if (stepPlayer !== turnPlayer) {
					await AbilityHandlers.sendStep(ctx, innerStep);
					continue;
				}
			}

			await runStep(ctx, innerStep);
			if (requiresInput) {
				ctx.runtime.callFunction("sendVars", JSON.stringify(ctx.vars));
			}
		}
	},
	applyContinuousKeyword(ctx, step) {
		const keyword = step.keyword;
		const cards = getTargetCards(ctx, step, step.target) ?? [];
		const enable =
			step.enable === undefined ? 1 : (ctx.vars[step.enable] ?? step.enable);

		const sourceId =
			step.source === "self"
				? `${ctx.self.cardUID}:${step.keyword}`
				: step.source;

		const layer = ctx.runtime.lifeAsDev.keywordLayer;
		if (!layer) return;

		layer.applyContinuous(keyword, sourceId, cards, enable);
	},
	getHighestCounterCount(ctx, step) {
		const counterType = step.type ?? "+100/+100";
		const value = step.value ?? "counterCount";

		// Obtener todas las cartas objetivo
		const cards = getTargetCards(ctx, step, step.target);

		let highest = 0;

		// Recorrer cada carta y quedarnos con el mayor número
		for (const card of cards) {
			const count = card.flags?.[counterType] ?? 0;
			if (count > highest) highest = count;
		}

		// Guardar resultado en variables del ability
		ctx.vars[value] = highest;
	},
	condition(ctx, step) {
		const value = step.value ?? "conditionResult";
		const conditions = step.conditions || [];

		const allConditionsMet = conditions.every((condition) =>
			evaluateCondition(ctx, condition),
		);
		ctx.vars[value] = allConditionsMet ? 1 : 0;
	},
	checkActivateCost(ctx, step) {
		const conditions = step.conditions || [];
		const allConditionsMet = conditions.every((condition) =>
			evaluateCondition(ctx, condition),
		);

		if (
			!allConditionsMet ||
			ctx.trigger === "checkCost" ||
			ctx.mode === "verify"
		) {
			throw { abortAbility: true, result: allConditionsMet };
		}
	},
	checkConditionAndAbort(ctx, step) {
		const conditions = step.conditions || [];
		const allConditionsMet = conditions.every((condition) =>
			evaluateCondition(ctx, condition),
		);
		if (!allConditionsMet || ctx.trigger === "checkCost") {
			throw { abortAbility: true, result: allConditionsMet };
		}
	},
	canPayCost(ctx, step) {
		const cards = getTargetCards(ctx, step, "all");
		const type = step.type ?? "normal";
		const cost = step.cost || [];

		const availableResources = cards
			.filter((entry) => {
				const c = entry.card;
				return (
					c.produce &&
					entry.flags.owner === ctx.runtime.globalVars.playerTurn &&
					entry.flags.rotation === 0
				);
			})
			.flatMap((entry) =>
				type === "normal"
					? entry.card.produce
					: (entry.card.mayProduceAwakening ?? entry.card.produce),
			);

		const result = cost.every((required) => {
			let index = -1;

			if (required === "Rest") {
				return (
					ctx.self.flags.rotation === 0 &&
					ctx.self.flags.enteredThisTurn === undefined
				);
			}

			if (required === "Void") {
				index = availableResources.length > 0 ? 0 : -1;
			} else {
				index = availableResources.indexOf(required);
			}

			if (index !== -1) {
				availableResources.splice(index, 1);
				return true;
			}

			return false;
		});

		ctx.vars[step.result] = result ? 1 : 0;
	},
	async payCost(ctx, step) {
		const cost = step.cost || [];
		const type = step.type ?? "any";
		const result = step.result ?? "";
		const optional = step.optional ?? 0;
		ctx.runtime.callFunction(
			"payAbilityCost",
			JSON.stringify(cost),
			type,
			optional,
		);
		const continueAbilityHandler = async (resultt) => {
			ctx.vars[result] = resultt;
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	async chooseOne(ctx, step) {
		const result = step.result ?? "";
		const options = step.options;
		ctx.runtime.callFunction("chooseOne", options.join("|"));
		const continueAbilityHandler = async (resultt) => {
			ctx.vars[result] = resultt;
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	reduceCost(ctx, step) {
		const reduce = step.reduce || [];
		for (const r of reduce) {
			ctx.runtime.callFunction("reduceCost", r);
		}
	},
	addCost(ctx, step) {
		const reduce = step.reduce || [];
		for (const r of reduce) {
			ctx.runtime.callFunction("addCost", r);
		}
	},
	async payCustomCost(ctx, step) {
		const value = step.value ?? "customCost";
		const type = step.type ?? "any";
		ctx.runtime.callFunction("payCustomCost", type);
		const continueAbilityHandler = async (valuee) => {
			ctx.vars[value] = valuee; // Guardar el pago en el contexto
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},

	draw(ctx, step) {
		const baseDeck = step.deck ? step.deck : "deck";
		const deckIndex = step.owner
			? resolveWho(step.owner, ctx)
			: ctx.self.flags.owner;
		const deckId = `${baseDeck}${deckIndex}`;

		ctx.runtime.callFunction("drawCard", step.count ?? 1, deckId, deckIndex);
	},
	destroy(ctx, step) {
		const list = getTargetCards(ctx, step, step.target);
		ctx.vars[step.value] = 0;

		for (const entry of list) {
			ctx.vars[step.value] = 1;
			const discard = `discard${entry.flags.originalOwner}`;
			entry.flags.state = discard;
			ctx.runtime.callFunction("cardToDeck", entry.cardUID, discard, 1);
		}
	},
	findDeckCard(ctx, step) {
		const owner = ctx.self.flags.owner;
		const stepOwner = step.owner ?? 1;
		const zoneIndex = stepOwner ? owner : 1 - owner;
		const deckId = `${step.from}${zoneIndex}`;

		const deck = ctx.decks[deckId] ?? [];
		const count = step.count ?? 100;

		// 🔧 Resolver filtros
		const rawFilters = step.filters ?? {};
		const filters = structuredClone(rawFilters);

		if (Array.isArray(filters.flagRequirements)) {
			filters.flagRequirements = filters.flagRequirements.map((req) => ({
				...req,
				min: req.min !== undefined ? resolveValue(ctx, req.min) : undefined,
				max: req.max !== undefined ? resolveValue(ctx, req.max) : undefined,
			}));
		}

		const found = [];

		for (let i = 0; i < deck.length && found.length < count; i++) {
			const entry = deck[i];
			if (cardMatchesFilters(entry, filters, ctx)) {
				found.push(entry);
				deck.splice(i, 1);
				i--;
			}
		}

		ctx.vars[step.value] = found;
	},
	peekDeckCards(ctx, step) {
		const owner = ctx.self.flags.owner;
		const stepOwner = step.owner ?? 1;
		const zoneIndex = stepOwner ? owner : 1 - owner;
		const deckId = `${step.from}${zoneIndex}`;

		const deck = ctx.decks[deckId] ?? [];

		const peekCount = step.count ? (ctx.vars[step.count] ?? step.count) : 1;

		// mirar solo las primeras N cartas
		const limit = Math.min(peekCount, deck.length);
		const result = [];
		for (let i = 0; i < limit; i++) {
			result.push(deck[i]);
		}

		ctx.vars[step.value] = result;
	},
	toOwnerHand(ctx, step) {
		const list = getTargetCards(ctx, step, step.target);

		for (const entry of list) {
			const handId = `hand`;
			ctx.runtime.callFunction("cardToDeck", entry.cardUID, handId, 1);
		}
	},
	async sendStep(ctx, step) {
		ctx.runtime.callFunction(
			"sendStep",
			JSON.stringify(step),
			ctx.self.cardUID,
			JSON.stringify(ctx.vars),
			JSON.stringify(ctx.runtime.lifeAsDev.resolve),
		);
		const continueAbilityHandler = async (vars) => {
			// Combinar los vars del contrincante con los del contexto actual
			ctx.vars = { ...ctx.vars, ...vars };
		};

		await ctx.runtime.continueAbilityHandler(continueAbilityHandler);
	},
	async getStep(ctx, step) {
		const handler = AbilityHandlers[step.action];
		await handler(ctx, step);

		return JSON.stringify(ctx.vars);
	},
	playCard(ctx, step) {
		let from = step.from ?? "field";

		const owner =
			step.owner !== undefined
				? resolveWho(step.owner, ctx)
				: (ctx.ability?._controller ?? ctx.self.flags.owner);

		const list = getTargetCards(ctx, step, from);
		for (let card of list) {
			ctx.runtime.callFunction("playCard", card.cardUID, owner, -1, -1);
		}
	},

	playToken(ctx, step) {
		if (!step.dataCard) {
			throw new Error("playToken requires dataCard");
		}

		const owner =
			step.owner !== undefined
				? resolveWho(step.owner, ctx)
				: ctx.self.flags.owner;

		const originUID = ctx.self.cardUID;

		// Clon seguro
		const dataCard = structuredClone(step.dataCard);

		// Defaults mínimos
		dataCard.name ??= "Token";
		dataCard.type ??= "Resonator";
		dataCard.subtype ??= "";
		const rawAtk = dataCard.atk ?? 0;
		const rawDef = dataCard.def ?? 0;

		dataCard.atk = resolveValue(ctx, rawAtk);
		dataCard.def = resolveValue(ctx, rawDef);
		dataCard.cost ??= [];
		dataCard.abilities ??= [];
		dataCard.image ??= ctx.self.card.image;
		dataCard.id ??= "token" + ctx.runtime.lifeAsDev.cardInstances.length;
		// Flags internos
		dataCard.isToken = 1;

		ctx.runtime.callFunction(
			"playTokenFromData",
			JSON.stringify(dataCard),
			originUID,
			owner,
		);
	},
	oncePerTurn(ctx, step) {
		const runtime = ctx.runtime;

		runtime.oncePerTurn ??= new Set();

		const key = step.key ?? "default";
		const cardUID = ctx.self.cardUID;
		const id = `${cardUID}:${key}`;
		// ===== VERIFY =====
		ctx.vars[step.result] = !runtime.oncePerTurn.has(id);
		if (ctx.mode === "verify") {
			return;
		}

		// ===== EXECUTE =====
		if (runtime.oncePerTurn.has(id)) {
			return;
		}
		runtime.oncePerTurn.add(id);
	},
	math(ctx, step) {
		const opFunc = Operators[step.op];
		if (!opFunc) {
			throw new Error(`Unknown operator: ${step.op}`);
		}

		const a = resolveValue(ctx, step.a);
		const b = resolveValue(ctx, step.b);

		// Realizar la operación y guardar el resultado
		ctx.vars[step.result] = opFunc(a, b);
	},
	log(ctx, step) {
		const raw = ctx.vars[step.value] ?? step.value;
		const value = structuredClone(raw);

		console.log(step.value, ":", value);
		return value;
	},
	shuffle(ctx, step) {
		const baseDeck = step.target; // "deck"
		const owner = step.owner ?? 1;

		const deckIndex = owner ? ctx.self.flags.owner : ctx.self.flags.owner ^ 1;

		const targetDeck = `${baseDeck}${deckIndex}`;
		ctx.runtime.callFunction("shuffleDeck", targetDeck, 1);
	},
	async pushToEnd(ctx, step) {
		const cards = getTargetCards(ctx, step, step.target);

		for (const card of cards) {
			ctx.runtime.lifeAsDev.endTurnAbilitys.push({
				ctx: {
					vars: structuredClone(ctx.vars),
					self: card,
				},
				steps: step.steps,
			});
		}
	},
	cardCount(ctx, step) {
		const value = step.value ?? "counterCount";

		// Obtener todas las cartas objetivo
		const cards = getTargetCards(ctx, step, step.from);
		ctx.vars[value] = cards.length;
	},
	addAbilities(ctx, step) {
		const cards = getTargetCards(ctx, step, step.target);
		for (const cardEntry of cards) {
			const cardUID = cardEntry.cardUID;
			const instance = ctx.runtime.lifeAsDev.cardInstances[cardUID];
			if (!Array.isArray(instance.abilities)) {
				instance.abilities = [];
			}

			if (!Array.isArray(step.abilities)) return;

			for (const ability of step.abilities) {
				instance.abilities.push({
					...structuredClone(ability),
					_sourceUID: ctx.self.cardUID,
					_controller: ctx.self.flags.owner,
					_turn: ctx.runtime.globalVars.gameTurn,
				});
			}
		}
	},
	removeAbilities(ctx, step) {
		const cards = getTargetCards(ctx, step, step.target);
		if (!cards || !step.id) return;

		for (const cardEntry of cards) {
			const card = ctx.runtime.lifeAsDev.cardInstances[cardEntry.cardUID];
			if (!Array.isArray(card.abilities)) continue;

			card.abilities = card.abilities.filter(
				(ability) => ability.id !== step.id,
			);
		}
	},
	modifyLP(ctx, step) {
		const amount = resolveValue(ctx, step.amount);
		const turnPlayer = ctx.runtime.globalVars.myOwner;
		const stepPlayer = step.player ?? 0;
		const owner = ctx.self.flags.owner;

		const relativeOwnerLP = !stepPlayer
			? owner !== turnPlayer
			: owner === turnPlayer;

		ctx.runtime.callFunction("modifyLP", relativeOwnerLP ? 1 : 0, amount, 1);
	},
	requireMyTurn(ctx, step) {
		const turnPlayer = ctx.runtime.globalVars.playerTurn; // jugador cuyo turno termina
		const cardOwner = ctx.self.flags.owner; // dueño de la carta

		const isMyTurnEnd = turnPlayer === cardOwner;

		ctx.vars[step.value] = isMyTurnEnd ? 1 : 0;
	},
};

// =============================
//  RUN STEP
// =============================
async function runStep(ctx, step) {
	const handler = AbilityHandlers[step.action];
	if (!handler) throw new Error("Unknown action: " + step.action);

	await handler(ctx, step);
}

const INPUT_STEPS = new Set([
	"chooseCard",
	"chooseRemoveCounters",
	"chooseTwoPiles",
	"chooseTwoGroups",
	"payCustomCost",
	"getCards",
	"chooseCardFrom",
	"payCost",
	"chooseChaseEffect",
	"chooseOne",
	"dealDividedDamage",
]);

function resolveWho(stepWho, ctx) {
	// prioridad: controller de la ability (si existe)
	const base =
		ctx.ability?.controller !== undefined
			? ctx.ability.controller
			: ctx.self.flags.owner; // 0 | 1

	// default: "yo"
	if (stepWho === undefined) {
		return base;
	}

	// relativo al base
	return stepWho === 1 ? base : base ^ 1;
}

// =============================
//  RUN ABILITY
// =============================
async function runAbility(ctx, ability) {
	ctx.vars = ctx.vars || {};
	ctx.vars.whileActive =
		(ctx.self.flags.whileActive && ctx.self.flags.Silence) ?? 1;
	ctx.vars.runesRevealed = ctx.runtime.globalVars.runesRevealed ?? 8;
	ctx.vars.lp1 = ctx.runtime.globalVars.lp1 ?? 4000;
	ctx.vars.lp2 = ctx.runtime.globalVars.lp2 ?? 4000;
	if (
		ability.trigger === "automatic" &&
		ctx.event &&
		ctx.event.type &&
		ability.event != ctx.event.type
	) {
		return false;
	}
	const turnPlayer = ctx.runtime.globalVars.myOwner;
	try {
		for (const step of ability.steps) {
			const requiresInput = INPUT_STEPS.has(step.action);
			if (requiresInput) {
				const stepPlayer = resolveWho(step.who, ctx);
				if (stepPlayer !== turnPlayer) {
					await AbilityHandlers.sendStep(ctx, step);
					continue;
				}
			}

			// ejecutar siempre local
			await runStep(ctx, step);
			if (requiresInput) {
				ctx.runtime.callFunction("sendVars", JSON.stringify(ctx.vars));
			}
		}
	} catch (err) {
		if (err && err.abortAbility) {
			return err.result;
		}
		throw err; // errores reales siguen hacia afuera
	}
	ctx.runtime.callFunction("endAbility");
}

function runStepSync(ctx, step) {
	const handler = AbilityHandlers[step.action];
	if (!handler) throw new Error("Unknown action: " + step.action);

	// Llamada directa. Si el handler es async devuelve una Promise,
	// pero aquí no se espera.
	const result = handler(ctx, step);

	return result;
}

function runAbilitySync(ctx, ability) {
	ctx.vars = {};
	ctx.vars.whileActive =
		(ctx.self.flags.whileActive && ctx.self.flags.Silence) ?? 1;
	ctx.vars.runesRevealed = ctx.runtime.globalVars.runesRevealed ?? 8;
	ctx.mode = "verify";
	ctx.vars.lp1 = ctx.runtime.globalVars.lp1 ?? 4000;
	ctx.vars.lp2 = ctx.runtime.globalVars.lp2 ?? 4000;
	try {
		if (
			ability.trigger === "automatic" &&
			ctx.event &&
			ctx.event.type &&
			ability.event != ctx.event.type
		) {
			return false;
		}

		if (
			ability.steps.every(
				(step) =>
					step.action !== "checkActivateCost" && ability.trigger !== "payCost",
			)
		) {
			return true;
		}
		if (ability.trigger === "awakening") return result.result;
		for (const step of ability.steps) {
			const result = runStepSync(ctx, step);

			// Si el handler devolvió una excepción interna, lanzarla
			if (result && result.abortAbility) {
				return result.result;
			}
		}
	} catch (err) {
		if (err && err.abortAbility) {
			return err.result;
		}
		throw err;
	}
}

export {
	runAbility,
	runStep,
	evaluateCondition,
	resolveValue,
	AbilityHandlers,
	runStepSync,
	runAbilitySync,
	cardMatchesFilters,
};
