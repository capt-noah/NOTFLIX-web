/**
 * Intelligent Typo-Tolerant & Fuzzy Search Engine for NotFlix
 * Combines Levenshtein Edit Distance, Token Overlap, and Substring Ranking.
 */

export function levenshteinDistance(s1, s2) {
    if (s1 === s2) return 0;
    if (!s1.length) return s2.length;
    if (!s2.length) return s1.length;

    const row = new Array(s2.length + 1);
    for (let i = 0; i <= s2.length; i++) {
        row[i] = i;
    }

    for (let i = 1; i <= s1.length; i++) {
        let prev = i;
        for (let j = 1; j <= s2.length; j++) {
            let val;
            if (s1[i - 1] === s2[j - 1]) {
                val = row[j - 1];
            } else {
                val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            }
            row[j - 1] = prev;
            prev = val;
        }
        row[s2.length] = prev;
    }

    return row[s2.length];
}

export function calculateFuzzyScore(targetText, queryText) {
    if (!targetText || !queryText) return 0;
    const target = String(targetText).toLowerCase().trim();
    const query = String(queryText).toLowerCase().trim();

    if (!target || !query) return 0;
    if (target === query) return 1.0;

    // Substring match gives high base score
    if (target.includes(query)) {
        return 0.85 + (0.15 * (query.length / target.length));
    }

    // Levenshtein on entire string
    const fullDist = levenshteinDistance(target, query);
    const maxLen = Math.max(target.length, query.length);
    const fullSim = 1 - (fullDist / maxLen);

    // Token-based matching (handles multi-word titles e.g. "Breaking Bad", "Stranger Things")
    const targetTokens = target.split(/[\s:,\-_.]+/).filter(Boolean);
    const queryTokens = query.split(/[\s:,\-_.]+/).filter(Boolean);

    if (queryTokens.length === 0) return fullSim;

    let tokenScoreSum = 0;
    for (const qToken of queryTokens) {
        let bestTokenMatch = 0;
        for (const tToken of targetTokens) {
            if (tToken === qToken) {
                bestTokenMatch = 1.0;
                break;
            }
            if (tToken.startsWith(qToken) || qToken.startsWith(tToken)) {
                const prefixSim = Math.min(tToken.length, qToken.length) / Math.max(tToken.length, qToken.length);
                bestTokenMatch = Math.max(bestTokenMatch, 0.8 * prefixSim);
            }
            const dist = levenshteinDistance(tToken, qToken);
            const tokenMax = Math.max(tToken.length, qToken.length);
            const sim = 1 - (dist / tokenMax);
            if (sim > bestTokenMatch) {
                bestTokenMatch = sim;
            }
        }
        tokenScoreSum += bestTokenMatch;
    }
    const tokenScore = tokenScoreSum / queryTokens.length;

    return Math.max(fullSim, tokenScore);
}

export function fuzzyFilterAndRank(items, query, getSearchableStrings = (item) => [item.title]) {
    if (!query || !query.trim()) return items;
    const cleanQuery = query.toLowerCase().trim();

    const scored = items.map(item => {
        const strings = getSearchableStrings(item).filter(Boolean);
        let maxScore = 0;

        for (const s of strings) {
            const score = calculateFuzzyScore(s, cleanQuery);
            if (score > maxScore) maxScore = score;
        }

        return { item, score: maxScore };
    });

    // Keep items with meaningful match (> 0.45 or substring containment)
    const matches = scored.filter(s => s.score >= 0.48);
    matches.sort((a, b) => b.score - a.score);

    return matches.map(m => m.item);
}
