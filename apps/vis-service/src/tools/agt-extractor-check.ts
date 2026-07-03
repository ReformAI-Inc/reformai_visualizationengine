// AGT extractor accuracy check (review F9; V7 spec Rev1 §11 targets).
//
// Runs AGT extraction N times against each human-labeled fixture and reports:
//   - hard-fact precision: of count facts the classifier marked HARD, the
//     fraction whose value matches the label (target >= 90%)
//   - false-hard-fact rate: 1 - precision (target <= 5%) — a wrong hard fact
//     becomes a wrong prompt constraint AND a wrong verification anchor
//   - boolean accuracy, camera agreement (advisory), and confidence-tier
//     distribution (drift here changes prompt content + verification reach)
//
// Run whenever AGT_EXTRACTION_MODEL or the extraction prompt changes, and for
// any candidate successor model before adopting it:
//   npm run check:extractor              (3 runs/fixture, default model)
//   AGT_EXTRACTION_MODEL=gemini-3-flash npm run check:extractor
//
// PAID: 6 fixtures x N runs of flash-tier text extraction (~pennies). Needs
// API_KEY in the environment / .env. Not wired into CI.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractAGTFromImageData } from '../guardrails/extract.js';
import { classifyAGTConfidence } from '../guardrails/classify.js';
import { AGT_EXTRACTION_MODEL } from '../models/image-model.client.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(HERE, '../../../../fixtures');
const LABELS_PATH = path.join(FIXTURES_DIR, 'agt_labels.json');

const RUNS = Math.max(1, Number(process.env.EXTRACTOR_CHECK_RUNS || process.argv[2] || 3));

const mimeFor = (file: string) =>
    file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';

interface CountLabel { value: number; acceptable: number[] }
interface FixtureLabel {
    room_type: string;
    window_count: CountLabel;
    door_count: CountLabel;
    has_ceiling_fixture: boolean;
    has_built_in_niches: boolean;
    camera_perspective: { value: string; acceptable: string[] };
    notes?: string;
}

const main = async () => {
    const labels: Record<string, FixtureLabel | object> = JSON.parse(readFileSync(LABELS_PATH, 'utf-8'));
    const fixtures = Object.keys(labels).filter(k => !k.startsWith('_'));
    const available = new Set(readdirSync(FIXTURES_DIR));

    console.log(`AGT extractor check — model=${AGT_EXTRACTION_MODEL}, runs/fixture=${RUNS}\n`);

    let hardCountFacts = 0;
    let hardCountCorrect = 0;
    let boolFacts = 0;
    let boolCorrect = 0;
    let cameraRuns = 0;
    let cameraCorrect = 0;
    const tierCounts: Record<string, number> = { high: 0, medium: 0, low: 0 };
    const rows: object[] = [];

    for (const file of fixtures) {
        if (!available.has(file)) {
            console.warn(`  SKIP ${file} — fixture not found`);
            continue;
        }
        const label = labels[file] as FixtureLabel;
        const b64 = readFileSync(path.join(FIXTURES_DIR, file)).toString('base64');

        for (let run = 1; run <= RUNS; run++) {
            const agt = await extractAGTFromImageData(b64, mimeFor(file));
            const classified = classifyAGTConfidence(agt);

            for (const field of ['window_count', 'door_count'] as const) {
                const extracted = agt[field];
                const enforcement = classified[field].enforcement;
                const ok = label[field].acceptable.includes(extracted.value);
                tierCounts[extracted.confidence] = (tierCounts[extracted.confidence] ?? 0) + 1;
                if (enforcement === 'hard') {
                    hardCountFacts++;
                    if (ok) hardCountCorrect++;
                }
                rows.push({ fixture: file, run, field, value: extracted.value,
                            expected: label[field].value, ok, confidence: extracted.confidence, enforcement });
            }

            for (const field of ['has_ceiling_fixture', 'has_built_in_niches'] as const) {
                boolFacts++;
                const ok = agt[field].value === label[field];
                if (ok) boolCorrect++;
                rows.push({ fixture: file, run, field, value: agt[field].value,
                            expected: label[field], ok, confidence: agt[field].confidence });
            }

            cameraRuns++;
            if (label.camera_perspective.acceptable.includes(agt.camera_perspective.value)) cameraCorrect++;
            process.stdout.write('.');
        }
        console.log(`  ${file} done`);
    }

    const precision = hardCountFacts ? hardCountCorrect / hardCountFacts : null;
    const summary = {
        model: AGT_EXTRACTION_MODEL,
        runsPerFixture: RUNS,
        hard_count_facts: hardCountFacts,
        hard_fact_precision: precision === null ? 'n/a (no facts reached hard tier)' : `${(precision * 100).toFixed(1)}%`,
        false_hard_fact_rate: precision === null ? 'n/a' : `${((1 - precision) * 100).toFixed(1)}%`,
        spec_targets: 'precision >= 90%, false-hard <= 5% (V7 spec Rev1 §11)',
        boolean_accuracy: boolFacts ? `${((boolCorrect / boolFacts) * 100).toFixed(1)}%` : 'n/a',
        camera_agreement_advisory: cameraRuns ? `${((cameraCorrect / cameraRuns) * 100).toFixed(1)}%` : 'n/a',
        count_tier_distribution: tierCounts,
    };

    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));
    console.log('\n=== DETAIL ===');
    console.log(JSON.stringify(rows, null, 1));

    const failed = precision !== null && (precision < 0.9);
    if (failed) {
        console.error('\nRESULT: FAIL — hard-fact precision below the 90% spec target.');
        process.exit(1);
    }
    console.log('\nRESULT: PASS (or no hard-tier facts produced — inspect tier distribution).');
};

main().catch(err => {
    console.error('extractor check failed:', err);
    process.exit(2);
});
