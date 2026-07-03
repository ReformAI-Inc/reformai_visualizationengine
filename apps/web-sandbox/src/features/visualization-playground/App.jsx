import { useState, useRef, useCallback } from 'react';

// ─── constants ────────────────────────────────────────────────────────────────
const ENDPOINT = '/generate-visualization';
const HEALTH   = '/health';

const PRESET_SUGGESTIONS = [
  'Modern', 'Contemporary', 'Minimalist', 'Industrial', 'Midcentury Modern',
  'Farmhouse', 'Coastal', 'Japandi', 'Rustic', 'Bohemian',
  'Biophilic', 'French Country', 'Japanese', 'Neoclassic', 'Vintage'
];

const ROOM_TYPES = [
  'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room',
  'Home Office', 'Studio', 'Hallway',
];

// ─── tiny helpers ─────────────────────────────────────────────────────────────
const fmt = (bytes) => bytes < 1024 ? `${bytes}B` : `${(bytes/1024).toFixed(1)}KB`;
const ts  = () => new Date().toLocaleTimeString();
const cls = (...args) => args.filter(Boolean).join(' ');

function useFilePreview() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const clear = () => { setFile(null); setPreview(null); };
  const pick = (f) => {
    if (!f) { clear(); return; }
    setFile(f);
    const r = new FileReader();
    r.onload = (e) => setPreview(e.target.result);
    r.readAsDataURL(f);
  };
  return { file, preview, pick, clear };
}

// ─── sub-components ───────────────────────────────────────────────────────────
function Tag({ children, color = 'default' }) {
  const colors = {
    default: { bg: '#1f2937', text: '#9ca3af' },
    blue:    { bg: '#1e3a5f', text: '#60a5fa' },
    green:   { bg: '#14291c', text: '#4ade80' },
    red:     { bg: '#2d1515', text: '#f87171' },
    yellow:  { bg: '#2d2410', text: '#fbbf24' },
  };
  const c = colors[color] || colors.default;
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      {children}
    </span>
  );
}

function Label({ children, required }) {
  return (
    <label style={{ display: 'block', marginBottom: 5, color: '#8b949e', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {children} {required && <span style={{ color: '#da3633' }}>*</span>}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1a6fe8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, paddingBottom: 5, borderBottom: '1px solid #21262d' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function DropZone({ label, accept, multiple, files, onChange, required }) {
  const inputRef = useRef();
  const [over, setOver] = useState(false);

  const handle = (incoming) => {
    const arr = multiple ? Array.from(incoming) : [incoming[0]];
    onChange(multiple ? arr : arr[0] || null);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <Label required={required}>{label}</Label>
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        style={{
          border: `1px dashed ${over ? '#1a6fe8' : '#30363d'}`,
          borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
          background: over ? '#0d1f3c' : '#0d1117',
          transition: 'all 0.15s',
          minHeight: 44,
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}
      >
        <input ref={inputRef} type="file" accept={accept} multiple={multiple}
          style={{ display: 'none' }}
          onChange={(e) => handle(e.target.files)} />
        {(!files || (Array.isArray(files) && files.length === 0)) ? (
          <span style={{ color: '#484f58', fontSize: 12 }}>Click or drop {multiple ? 'files' : 'a file'}</span>
        ) : (
          (Array.isArray(files) ? files : [files]).map((f, i) => (
            <Tag key={i} color="blue">{f.name} <span style={{ opacity: 0.6 }}>({fmt(f.size)})</span></Tag>
          ))
        )}
      </div>
      {files && !Array.isArray(files) && (
        <button onClick={(e) => { e.stopPropagation(); onChange(null); }}
          style={{ marginTop: 4, fontSize: 11, color: '#da3633', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          × clear
        </button>
      )}
      {Array.isArray(files) && files.length > 0 && (
        <button onClick={() => onChange([])}
          style={{ marginTop: 4, fontSize: 11, color: '#da3633', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          × clear all ({files.length})
        </button>
      )}
    </div>
  );
}

function ImagePreview({ src, label, height = 140 }) {
  if (!src) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: '#484f58', marginBottom: 3 }}>{label}</div>
      <img src={src} alt={label} style={{
        height, maxWidth: '100%', objectFit: 'cover',
        borderRadius: 4, border: '1px solid #21262d', display: 'block',
      }} />
    </div>
  );
}

function StatusBar({ status, timing }) {
  const map = {
    idle:    { color: '#484f58', label: 'Idle' },
    pinging: { color: '#fbbf24', label: 'Checking backend…' },
    loading: { color: '#1a6fe8', label: 'Generating…' },
    success: { color: '#4ade80', label: 'Success' },
    error:   { color: '#f87171', label: 'Error' },
  };
  const s = map[status] || map.idle;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', marginBottom: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color,
        boxShadow: status === 'loading' ? `0 0 6px ${s.color}` : 'none',
        animation: status === 'loading' ? 'pulse 1.2s ease-in-out infinite' : 'none' }} />
      <span style={{ color: s.color, fontWeight: 600, fontSize: 12 }}>{s.label}</span>
      {timing && <span style={{ color: '#484f58', fontSize: 11 }}>· {timing}</span>}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

function RequestSummary({ req }) {
  if (!req) return null;
  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Request sent</div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 8px', fontSize: 12 }}>
        {[
          ['Endpoint', <Tag color="blue">POST {ENDPOINT}</Tag>],
          ['Room Type', req.roomType],
          ['Style', req.stylePreset.name],
          ['Style imageUrl', <span style={{ color: '#484f58', wordBreak: 'break-all', fontSize: 11 }}>{req.stylePreset.imageUrl || <i>empty</i>}</span>],
          ['Influence', `${req.styleInfluence} / 100`],
          ['Refinement', req.isRefinement ? <Tag color="yellow">true</Tag> : <Tag>false</Tag>],
          ['Prompt', req.textPrompt || <span style={{ color: '#484f58' }}><i>none</i></span>],
          ['Room image', req.roomImage ? <Tag color="green">{req.roomImage}</Tag> : '—'],
          ['Moodboard', req.moodBoardCount > 0 ? <Tag color="blue">{req.moodBoardCount} file(s)</Tag> : '—'],
          ['Furniture', req.furnitureImage ? <Tag color="blue">{req.furnitureImage}</Tag> : '—'],
          ['Prev result', req.previousResultImage ? <Tag color="blue">{req.previousResultImage}</Tag> : '—'],
          ['Sent at', req.sentAt],
          ...(req.contractorId ? [
            ['Contractor ID', <Tag color="blue">{req.contractorId}</Tag>],
            ['Renovation IDs', <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#60a5fa', margin: 0 }}>{JSON.stringify(req.renovationSelectionIds, null, 2)}</pre>],
          ] : []),
        ].map(([k, v]) => (
          <>
            <span style={{ color: '#484f58', fontWeight: 600 }}>{k}</span>
            <span style={{ color: '#e6edf3' }}>{v}</span>
          </>
        ))}
      </div>
    </div>
  );
}

function MetaPanel({ meta, rawError }) {
  if (!meta && !rawError) return null;

  if (rawError) {
    return (
      <div style={{ background: '#2d1515', border: '1px solid #da3633', borderRadius: 6, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 6, textTransform: 'uppercase' }}>Error Response</div>
        <pre style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#f87171', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(rawError, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Response Metadata</div>
      <pre style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#4ade80', whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(meta, null, 2)}
      </pre>
    </div>
  );
}

// ─── V6.0: Catalogue sub-components ──────────────────────────────────────────

const CATEGORY_ORDER = ['flooring', 'walls', 'countertops', 'cabinets'];
const CATEGORY_LABELS = { flooring: 'Flooring', walls: 'Walls', countertops: 'Countertops', cabinets: 'Cabinets' };

function ItemCard({ item, selected, onToggle }) {
  const attrs = Object.entries(item.attributes || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);

  return (
    <div
      onClick={onToggle}
      style={{
        border: `1px solid ${selected ? '#1a6fe8' : '#21262d'}`,
        background: selected ? '#0d1f3c' : '#0d1117',
        borderRadius: 6, padding: '8px 10px', marginBottom: 6,
        cursor: 'pointer', transition: 'all 0.12s', position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
        <span style={{ fontWeight: 600, color: selected ? '#60a5fa' : '#e6edf3', fontSize: 12 }}>
          {item.name}
        </span>
        {selected && <span style={{ color: '#1a6fe8', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </div>
      <div style={{ color: '#8b949e', fontSize: 10, fontStyle: 'italic', marginBottom: 5, lineHeight: 1.4 }}>
        "{item.promptDescription}"
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {attrs.map(a => (
          <span key={a} style={{ fontSize: 9, padding: '1px 5px', background: '#161b22', border: '1px solid #21262d', borderRadius: 3, color: '#484f58' }}>
            {a}
          </span>
        ))}
        <span style={{ fontSize: 9, padding: '1px 5px', background: '#161b22', border: '1px solid #21262d', borderRadius: 3, color: '#30363d' }}>
          {item.id}
        </span>
      </div>
    </div>
  );
}

function CataloguePanel({
  contractorId, setContractorId,
  catalogueItems, catalogueLoading, catalogueError,
  onLoad,
  renovationSelections, onSelect, onClear,
}) {
  const inputStyle = {
    flex: 1, padding: '6px 9px', background: '#0d1117',
    border: '1px solid #30363d', borderRadius: 5, color: '#e6edf3',
    fontSize: 12, outline: 'none', fontFamily: 'inherit',
  };
  const focus = { onFocus: e => e.target.style.borderColor = '#1a6fe8', onBlur: e => e.target.style.borderColor = '#30363d' };

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = catalogueItems.filter(i => i.category === cat);
    return acc;
  }, {});

  const activeSelections = Object.fromEntries(
    CATEGORY_ORDER.filter(cat => renovationSelections[cat])
      .map(cat => [cat, renovationSelections[cat]])
  );
  const hasSelections = Object.keys(activeSelections).length > 0;

  return (
    <div>
      {/* Contractor ID row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={contractorId}
          onChange={e => setContractorId(e.target.value)}
          placeholder="contractor_demo"
          style={inputStyle}
          {...focus}
        />
        <button
          type="button"
          onClick={onLoad}
          disabled={catalogueLoading || !contractorId.trim()}
          style={{
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            background: catalogueLoading ? '#161b22' : '#21262d',
            border: '1px solid #30363d', borderRadius: 5,
            color: catalogueLoading ? '#484f58' : '#8b949e',
            cursor: catalogueLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {catalogueLoading ? '⏳ Loading…' : '↓ Load'}
        </button>
      </div>

      {catalogueError && (
        <div style={{ fontSize: 11, color: '#f87171', background: '#2d1515', border: '1px solid #da3633', borderRadius: 5, padding: '5px 9px', marginBottom: 8 }}>
          {catalogueError}
        </div>
      )}

      {/* Category groups */}
      {CATEGORY_ORDER.map(cat => {
        const items = grouped[cat] || [];
        if (items.length === 0) return null;
        const selected = renovationSelections[cat];
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {CATEGORY_LABELS[cat]}
              </span>
              {selected && (
                <button
                  type="button"
                  onClick={() => onClear(cat)}
                  style={{ fontSize: 10, color: '#da3633', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  × clear
                </button>
              )}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  selected={selected === item.id}
                  onToggle={() => onSelect(cat, item.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Request preview */}
      {hasSelections && (
        <div style={{ marginTop: 8, background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Request Preview
          </div>
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#4ade80', margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify({
              headers: { 'X-Contractor-Id': contractorId },
              renovationSelectionIds: activeSelections,
            }, null, 2)}
          </pre>
        </div>
      )}

      {catalogueItems.length > 0 && !hasSelections && (
        <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: '6px 0' }}>
          Click an item to select it
        </div>
      )}
    </div>
  );
}

function RenovationDebugPanel({ debug }) {
  if (!debug) return null;
  const {
    contractorId,
    renovationAnchorsInserted,
    renovationAnchorCount,
    renovationSelectionIds,
    resolvedRenovationSelections,
    renovationAnchorsBlock,
  } = debug;

  // Only render if V6.0 fields are present
  if (!contractorId && !renovationAnchorsInserted && !renovationAnchorsBlock) return null;

  return (
    <div style={{ background: '#0d1117', border: `1px solid ${renovationAnchorsInserted ? '#1a6fe8' : '#21262d'}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: renovationAnchorsInserted ? '#60a5fa' : '#8b949e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Tier 2B — Renovation Debug {renovationAnchorsInserted ? <Tag color="blue">ACTIVE · {renovationAnchorCount} anchor{renovationAnchorCount !== 1 ? 's' : ''}</Tag> : <Tag>INACTIVE</Tag>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '4px 8px', fontSize: 11, marginBottom: 10 }}>
        {[
          ['contractorId', contractorId ?? '—'],
          ['anchorsInserted', renovationAnchorsInserted ? <Tag color="green">true</Tag> : <Tag>false</Tag>],
          ['anchorCount', renovationAnchorCount ?? 0],
        ].map(([k, v]) => (
          <>
            <span style={{ color: '#484f58', fontWeight: 600 }}>{k}</span>
            <span style={{ color: '#e6edf3' }}>{v}</span>
          </>
        ))}
      </div>

      {renovationSelectionIds && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', marginBottom: 4 }}>Selection IDs sent</div>
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#8b949e', margin: 0 }}>
            {JSON.stringify(renovationSelectionIds, null, 2)}
          </pre>
        </div>
      )}

      {resolvedRenovationSelections && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', marginBottom: 4 }}>Resolved prompt descriptions</div>
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#4ade80', margin: 0 }}>
            {JSON.stringify(resolvedRenovationSelections, null, 2)}
          </pre>
        </div>
      )}

      {renovationAnchorsBlock && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', marginBottom: 4 }}>Anchor block (sent to model)</div>
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#60a5fa', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#161b22', border: '1px solid #21262d', borderRadius: 4, padding: '8px 10px', maxHeight: 300, overflowY: 'auto' }}>
            {renovationAnchorsBlock}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── main app ─────────────────────────────────────────────────────────────────
export default function App() {
  // form state
  const [roomType, setRoomType]           = useState('Living Room');
  const [presetName, setPresetName]       = useState('Modern');
  const [textPrompt, setTextPrompt]       = useState('');
  const [isRefinement, setIsRefinement]   = useState(false);

  const roomImg      = useFilePreview();
  const furnitureImg = useFilePreview();
  const prevImg      = useFilePreview();
  const [moodFiles, setMoodFiles]         = useState([]);
  const [moodPreviews, setMoodPreviews]   = useState([]);

  // result state
  const [status, setStatus]       = useState('idle');
  const [timing, setTiming]       = useState(null);
  const [resultImg, setResultImg] = useState(null);
  const [meta, setMeta]           = useState(null);
  const [rawError, setRawError]   = useState(null);
  const [lastReq, setLastReq]     = useState(null);
  const [backendOk, setBackendOk] = useState(null);

  // V6.0: catalogue state
  const [contractorId, setContractorId]           = useState('contractor_demo');
  const [catalogueItems, setCatalogueItems]       = useState([]);
  const [catalogueLoading, setCatalogueLoading]   = useState(false);
  const [catalogueError, setCatalogueError]       = useState(null);
  const [renovationSelections, setRenovationSelections] = useState(
    { flooring: null, walls: null, countertops: null, cabinets: null }
  );

  // comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [comparisonTarget, setComparisonTarget] = useState('balanced_v7');
  const [baselineResult, setBaselineResult] = useState(null);
  const [improvedResult, setImprovedResult] = useState(null);
  const [baselineDebug, setBaselineDebug] = useState(null);
  const [improvedDebug, setImprovedDebug] = useState(null);

  // Legacy modes (V1–V4.1, Improved) archived 2026-07-02 — archive/legacy-pipelines/.
  const PIPELINE_LABELS = {
    'balanced_v5':      'Balanced V5.1 (Lean — Moodboard)',
    'balanced_v6':      'Balanced V6.0 (Service Provider Catalogue)',
    'balanced_v7':      'Balanced V7 (AGT Confidence-Gated)',
    'balanced_v7_nb2':  'Balanced V7 — NB2 (V7 prompts on Gemini 3.1)',
    'balanced_v8':      'Balanced V8 (Catalogue-First)',
  };

  const handleMoodChange = (files) => {
    setMoodFiles(files);
    const readers = files.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(setMoodPreviews);
  };

  // V6.0: catalogue loading
  const loadCatalogue = useCallback(async () => {
    if (!contractorId.trim()) return;
    setCatalogueLoading(true);
    setCatalogueError(null);
    setCatalogueItems([]);
    setRenovationSelections({ flooring: null, walls: null, countertops: null, cabinets: null });
    try {
      const res = await fetch('/api/catalogue', {
        headers: { 'X-Contractor-Id': contractorId.trim() },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setCatalogueItems(json.items || []);
    } catch (err) {
      setCatalogueError(err.message);
    } finally {
      setCatalogueLoading(false);
    }
  }, [contractorId]);

  const handleCatalogueSelect = useCallback((category, itemId) => {
    setRenovationSelections(prev => ({
      ...prev,
      [category]: prev[category] === itemId ? null : itemId,
    }));
  }, []);

  const handleCatalogueClear = useCallback((category) => {
    setRenovationSelections(prev => ({ ...prev, [category]: null }));
  }, []);

  const pingBackend = useCallback(async () => {
    setStatus('pinging');
    try {
      const r = await fetch(HEALTH);
      setBackendOk(r.ok);
      setStatus('idle');
    } catch {
      setBackendOk(false);
      setStatus('idle');
    }
  }, []);

  const callPipeline = async (fd, mode, extraHeaders = {}) => {
    const t0 = Date.now();
    const effectiveMode = mode;
    const url = `${ENDPOINT}?mode=${effectiveMode}`;
    const res = await fetch(url, { method: 'POST', body: fd, headers: extraHeaders });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(2) + 's';
    const json = await res.json();
    if (!res.ok) throw { ...json, httpStatus: res.status, elapsed };
    return { ...json, elapsed };
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!roomImg.file) return;

    // V6.0: build active renovation selection IDs — only active when V6 pipeline is selected
    const isV6Mode = comparisonTarget === 'balanced_v6' || comparisonTarget === 'balanced_v7' || comparisonTarget === 'balanced_v8';
    const activeRenovationSelections = isV6Mode
      ? Object.fromEntries(
          CATEGORY_ORDER.filter(cat => renovationSelections[cat])
            .map(cat => [cat, renovationSelections[cat]])
        )
      : {};
    const hasRenovationSelections = Object.keys(activeRenovationSelections).length > 0;
    const extraHeaders = contractorId.trim() && hasRenovationSelections
      ? { 'X-Contractor-Id': contractorId.trim() }
      : {};

    const createFormData = () => {
      const fd = new FormData();
      fd.append('roomImage', roomImg.file);
      fd.append('roomType', roomType);
      fd.append('stylePreset', JSON.stringify({ name: presetName }));
      fd.append('styleInfluence', '0');
      fd.append('isRefinement', String(isRefinement));
      // Removed hardcoded phaseAnchoring - let the backend decide based on query mode
      if (textPrompt) fd.append('textPrompt', textPrompt);
      moodFiles.forEach(f => fd.append('moodBoardImages', f));
      if (furnitureImg.file) fd.append('furnitureImage', furnitureImg.file);
      if (prevImg.file) fd.append('previousResultImage', prevImg.file);
      // V6.0: include renovation selections when active
      if (hasRenovationSelections) {
        fd.append('renovationSelectionIds', JSON.stringify(activeRenovationSelections));
      }
      return fd;
    };

    setLastReq({
      roomType, textPrompt,
      stylePreset: { name: presetName, imageUrl: '' },
      styleInfluence: 0, isRefinement,
      roomImage: roomImg.file.name,
      moodBoardCount: moodFiles.length,
      furnitureImage: furnitureImg.file?.name || null,
      previousResultImage: prevImg.file?.name || null,
      sentAt: ts(),
      // V6.0
      contractorId: hasRenovationSelections ? contractorId.trim() : null,
      renovationSelectionIds: hasRenovationSelections ? activeRenovationSelections : null,
    });

    setStatus('loading');
    setResultImg(null);
    setBaselineResult(null);
    setImprovedResult(null);
    setMeta(null);
    setRawError(null);

    try {
      if (compareMode) {
        // Run both in parallel — target pipeline is user-selectable
        const [baseline, target] = await Promise.all([
          callPipeline(createFormData(), 'baseline_original', extraHeaders),
          callPipeline(createFormData(), comparisonTarget, extraHeaders)
        ]);

        setBaselineResult(`data:image/png;base64,${baseline.data.image}`);
        setImprovedResult(`data:image/png;base64,${target.data.image}`);
        setBaselineDebug(baseline.data.debug);
        setImprovedDebug(target.data.debug);
        setTiming(`Baseline: ${baseline.elapsed} · ${PIPELINE_LABELS[comparisonTarget] ?? comparisonTarget}: ${target.elapsed}`);
        setStatus('success');
      } else {
        const result = await callPipeline(createFormData(), comparisonTarget, extraHeaders);
        setResultImg(`data:image/png;base64,${result.data.image}`);
        setImprovedDebug(result.data.debug);
        setMeta({ message: result.message, metadata: result.data.metadata, httpStatus: 200, elapsed: result.elapsed });
        setTiming(result.elapsed);
        setStatus('success');
      }
    } catch (err) {
      setRawError(err);
      setStatus('error');
    }
  }, [roomImg, roomType, presetName, isRefinement, textPrompt, moodFiles, furnitureImg, prevImg, compareMode, comparisonTarget, contractorId, renovationSelections]);

  const inputStyle = {
    width: '100%', padding: '7px 10px', background: '#0d1117',
    border: '1px solid #30363d', borderRadius: 5, color: '#e6edf3',
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };
  const focus = { onFocus: e => e.target.style.borderColor = '#1a6fe8', onBlur: e => e.target.style.borderColor = '#30363d' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #21262d', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#e6edf3' }}>Reform-AI</span>
        <span style={{ color: '#30363d' }}>·</span>
        <span style={{ color: '#8b949e', fontSize: 13 }}>Visualization Sandbox</span>
        <Tag color="yellow">DEV ONLY</Tag>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
             <input type="checkbox" id="compareToggle" checked={compareMode} onChange={e => setCompareMode(e.target.checked)}
                style={{ accentColor: '#1a6fe8' }} />
             <label htmlFor="compareToggle" style={{ fontSize: 13, color: '#e6edf3', cursor: 'pointer', fontWeight: 600 }}>
               Comparison Mode
             </label>
             <span style={{ color: '#484f58', fontSize: 12 }}>{compareMode ? 'Baseline vs' : 'Pipeline'}</span>
             <select
               value={comparisonTarget}
               onChange={e => setComparisonTarget(e.target.value)}
               style={{
                 background: '#161b22', border: '1px solid #30363d', borderRadius: 4,
                 color: '#e6edf3', fontSize: 12, padding: '2px 6px', cursor: 'pointer',
                 outline: 'none',
               }}
             >
               <option value="balanced_v5">Balanced V5.1 (Lean — Moodboard)</option>
               <option value="balanced_v6">Balanced V6.0 (Service Provider Catalogue)</option>
               <option value="balanced_v7">Balanced V7 (AGT Confidence-Gated)</option>
               <option value="balanced_v7_nb2">Balanced V7 — NB2 (Gemini 3.1)</option>
               <option value="balanced_v8">Balanced V8 (Catalogue-First)</option>
             </select>
          </div>
          <div style={{ width: 1, height: 16, background: '#30363d' }} />
          {backendOk === true && <Tag color="green">backend ok</Tag>}
          {backendOk === false && <Tag color="red">backend unreachable</Tag>}
          <button onClick={pingBackend}
            style={{ fontSize: 11, padding: '3px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: 5, color: '#8b949e', cursor: 'pointer' }}>
            ping /health
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: Form ── */}
        <form onSubmit={handleSubmit} style={{ borderRight: '1px solid #21262d', padding: 20, overflowY: 'auto', height: 'calc(100vh - 45px)' }}>

          <Section title="Room Image (required)">
            <DropZone label="Room Image" accept="image/*" required
              files={roomImg.file} onChange={roomImg.pick} />
            <ImagePreview src={roomImg.preview} label="Preview" height={120} />
          </Section>

          <Section title="Room Config">
            <div style={{ marginBottom: 12 }}>
              <Label required>Room Type</Label>
              <select value={roomType} onChange={e => setRoomType(e.target.value)} style={{ ...inputStyle }} {...focus}>
                {ROOM_TYPES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </Section>

          <Section title="Style Preset">
            <div style={{ marginBottom: 10 }}>
              <Label required>Preset Name</Label>
              <input value={presetName} onChange={e => setPresetName(e.target.value)}
                list="presets" placeholder="e.g. Modern" style={inputStyle} {...focus} />
              <datalist id="presets">
                {PRESET_SUGGESTIONS.map(p => <option key={p} value={p} />)}
              </datalist>
              <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {PRESET_SUGGESTIONS.map(p => (
                  <button key={p} type="button" onClick={() => setPresetName(p)}
                    style={{ fontSize: 10, padding: '2px 7px', background: presetName === p ? '#1a6fe8' : '#161b22',
                      border: `1px solid ${presetName === p ? '#1a6fe8' : '#30363d'}`, borderRadius: 4,
                      color: presetName === p ? '#fff' : '#8b949e', cursor: 'pointer' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Moodboard Images (optional)">
            <DropZone label="Moodboard Images" accept="image/*" multiple
              files={moodFiles} onChange={handleMoodChange} />
            {moodPreviews.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {moodPreviews.map((p, i) => (
                  <img key={i} src={p} alt={`mood ${i}`} style={{ height: 54, width: 54, objectFit: 'cover', borderRadius: 3, border: '1px solid #21262d' }} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Furniture Image (optional)">
            <DropZone label="Furniture Image" accept="image/*"
              files={furnitureImg.file} onChange={furnitureImg.pick} />
            <ImagePreview src={furnitureImg.preview} label="Furniture preview" height={90} />
          </Section>

          <Section title="Refinement">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <input type="checkbox" id="isRef" checked={isRefinement} onChange={e => setIsRefinement(e.target.checked)}
                style={{ accentColor: '#1a6fe8', width: 15, height: 15 }} />
              <label htmlFor="isRef" style={{ cursor: 'pointer', fontSize: 13, color: '#e6edf3' }}>isRefinement</label>
              {isRefinement && <Tag color="yellow">will send previousResultImage if provided</Tag>}
            </div>
            {isRefinement && (
              <>
                <DropZone label="Previous Result Image" accept="image/*"
                  files={prevImg.file} onChange={prevImg.pick} />
                <ImagePreview src={prevImg.preview} label="Prev result preview" height={90} />
              </>
            )}
          </Section>

          <Section title="User Prompt (optional)">
            <textarea value={textPrompt} onChange={e => setTextPrompt(e.target.value)}
              placeholder="Any specific requests to the model…"
              rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} {...focus} />
          </Section>

          {(comparisonTarget === 'balanced_v6' || comparisonTarget === 'balanced_v7' || comparisonTarget === 'balanced_v8') && <Section title="Service Provider Catalogue">
            <CataloguePanel
              contractorId={contractorId}
              setContractorId={setContractorId}
              catalogueItems={catalogueItems}
              catalogueLoading={catalogueLoading}
              catalogueError={catalogueError}
              onLoad={loadCatalogue}
              renovationSelections={renovationSelections}
              onSelect={handleCatalogueSelect}
              onClear={handleCatalogueClear}
            />
          </Section>}

          <button type="submit" disabled={!roomImg.file || status === 'loading'}
            style={{
              width: '100%', padding: '10px 0', fontWeight: 700, fontSize: 14,
              background: (!roomImg.file || status === 'loading') ? '#21262d' : '#1a6fe8',
              color: (!roomImg.file || status === 'loading') ? '#484f58' : '#fff',
              border: 'none', borderRadius: 6, cursor: (!roomImg.file || status === 'loading') ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}>
            {status === 'loading' ? '⏳ Generating…' : '▶ Generate Visualization'}
          </button>
        </form>

        {/* ── Right: Results ── */}
        <div style={{ padding: 20, overflowY: 'auto', height: 'calc(100vh - 45px)' }}>
          <StatusBar status={status} timing={timing} />
          <RequestSummary req={lastReq} />
          <MetaPanel meta={meta} rawError={rawError} />

          {status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
              <div style={{ width: 40, height: 40, border: '3px solid #21262d', borderTop: '3px solid #1a6fe8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: '#484f58', fontSize: 12 }}>Waiting for Gemini…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {compareMode && (baselineResult || improvedResult) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', marginBottom: 8 }}>Original Baseline</div>
                {baselineResult ? (
                  <>
                    <img src={baselineResult} style={{ width: '100%', borderRadius: 6, border: '1px solid #21262d', display: 'block', marginBottom: 10 }} />
                    <MetaPanel meta={{ debug: baselineDebug }} />
                  </>
                ) : <div style={{ height: 200, background: '#0d1117', border: '1px dashed #21262d', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', fontSize: 12 }}>Waiting for baseline...</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a6fe8', textTransform: 'uppercase', marginBottom: 8 }}>{PIPELINE_LABELS[comparisonTarget] ?? comparisonTarget}</div>
                {improvedResult ? (
                  <>
                    <img src={improvedResult} style={{ width: '100%', borderRadius: 6, border: '1px solid #21262d', display: 'block', marginBottom: 10 }} />
                    <MetaPanel meta={{ debug: improvedDebug }} />
                  </>
                ) : <div style={{ height: 200, background: '#0d1117', border: '1px dashed #21262d', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', fontSize: 12 }}>Waiting for {PIPELINE_LABELS[comparisonTarget] ?? comparisonTarget}...</div>}
              </div>
            </div>
          )}

          {!compareMode && resultImg && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Generated Output (Improved)
              </div>
              <img src={resultImg} alt="Generated visualization"
                style={{ width: '100%', borderRadius: 6, border: '1px solid #21262d', display: 'block', marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <a href={resultImg} download={`vis-${Date.now()}.png`}
                  style={{ fontSize: 12, color: '#1a6fe8', textDecoration: 'none', padding: '5px 12px',
                    border: '1px solid #1a6fe8', borderRadius: 5, display: 'inline-block' }}>
                  ↓ Download image
                </a>
              </div>
              <RenovationDebugPanel debug={improvedDebug} />
              <MetaPanel meta={{ debug: improvedDebug }} />
            </div>
          )}

          {status === 'idle' && !lastReq && (
            <div style={{ color: '#484f58', fontSize: 12, textAlign: 'center', marginTop: 80 }}>
              Upload a room image and hit Generate to test the backend.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
