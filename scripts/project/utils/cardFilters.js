export default function cardMatchesFilters(entry, filters) {
    const [
        state,
        type,
        subtype,
        owner,
        flagRequirementArg,
        name,
        rotation,
        excludeSelf,
        att
    ] = filters;

    const c = entry.card;

    const types = type ? (Array.isArray(type) ? type : [type]) : [];
    const subtypes = subtype ? (Array.isArray(subtype) ? subtype : [subtype]) : [];
    const names = name ? (Array.isArray(name) ? name : [name]) : [];
    const atts = att ? (Array.isArray(att) ? att : [att]) : [];

    const resolvedOwner = owner !== undefined ? owner : -1;
    const resolvedState = state === "field" ? "" : (state ?? "all");
    const excludeSelfUID = excludeSelf;

    /* ------------------ validación ------------------ */

    const typeOk = types.length === 0 || types.includes(c.type);
    const subtypeOk = subtypes.length === 0 || subtypes.includes(c.subtype);
    const ownerOk = resolvedOwner === -1 || entry.flags.owner === resolvedOwner;
    const stateOk = resolvedState === "all" || entry.flags.state === resolvedState;
    const nameOk = names.length === 0 || names.some(n => c.name?.includes(n));
    const attOk =
        atts.length === 0 ||
        atts.every(a => c.att?.includes(a));
    console.log(entry.cardUID, excludeSelfUID);
    const excludeSelfOk = excludeSelfUID ? entry.cardUID !== excludeSelfUID : true;

    /* ------------------ flags ------------------ */

    const flagsOk = [
        ...(flagRequirementArg || []),
        ...(rotation !== undefined
            ? [{
                key: "rotation",
                min: rotation,
                mustExists: 1
            }]
            : [])
    ].every(req => {
        const hasKey = entry.flags?.hasOwnProperty(req.key);
        const val = hasKey ? entry.flags[req.key] : 0;

        if (req.mustExists === 1 && !hasKey) return false;
        if (req.min !== undefined && val < req.min) return false;
        if (req.max !== undefined && val > req.max) return false;

        return true;
    });

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
