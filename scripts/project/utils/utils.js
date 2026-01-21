function getSectionFromState(state) {
    if (state.startsWith("deck")) return "deck";
    if (state.startsWith("rune")) return "rune";
    if (state.startsWith("stones")) return "stones";
    if (state === "ruler") return "ruler";
    return null;
}


function normalizeType(type) {
    return Array.isArray(type) ? type.slice() : [type];
}
function resolveTypeByState(cardTypes, state) {
    const section = getSectionFromState(state);

    if (section === "rune") {
        if (cardTypes.includes("Master Rune")) return "Master Rune";
        if (cardTypes.includes("Rune")) return "Rune";
    }

    if (section === "deck") {
        if (cardTypes.includes("Chant")) return "Chant";
    }

    // stones y ruler NO reinterpretan tipos
    return cardTypes[0];
}


export { resolveTypeByState, normalizeType };