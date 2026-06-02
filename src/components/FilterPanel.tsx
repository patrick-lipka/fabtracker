import { useRef, useState } from "react";

interface FilterPanelProps {
  /** The current query — parsed to pre-select filters. */
  query: string;
  /** Submit the rebuilt query (modeled filters + any preserved terms). */
  onApply: (query: string) => void;
  onClose: () => void;
}

const CLASSES = [
  "Generic", "Brute", "Guardian", "Ninja", "Warrior", "Mechanologist", "Ranger",
  "Runeblade", "Wizard", "Illusionist", "Assassin", "Bard", "Merchant",
  "Necromancer", "Shapeshifter", "Pirate",
];
const TALENTS = [
  "Draconic", "Earth", "Elemental", "Ice", "Light", "Lightning", "Royal",
  "Shadow", "Chaos", "Mystic",
];
const TYPES = [
  "Action", "Attack", "Attack Reaction", "Defense Reaction", "Instant",
  "Aura", "Item", "Weapon", "Equipment", "Hero", "Token",
];
const RARITIES = [
  "Common", "Rare", "Super Rare", "Majestic", "Legendary", "Fabled", "Marvel",
  "Promo", "Basic",
];
const OPS: [string, string][] = [
  ["=", ":"],
  ["≥", ">="],
  ["≤", "<="],
];

interface State {
  name: string;
  text: string;
  cls: string;
  talent: string;
  type: string;
  rarity: string;
  pitch: string;
  keyword: string;
  set: string;
  owned: boolean;
  costOp: string;
  cost: string;
  powerOp: string;
  power: string;
  defOp: string;
  def: string;
}

const EMPTY: State = {
  name: "", text: "", cls: "", talent: "", type: "", rarity: "", pitch: "",
  keyword: "", set: "", owned: false,
  costOp: ":", cost: "", powerOp: ":", power: "", defOp: ":", def: "",
};

const quote = (v: string) => (/\s/.test(v) ? `"${v}"` : v);

// --- Query parsing (mirror of search.rs tokenizer) -------------------------

function tokenize(q: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const c of q) {
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if (/\s/.test(c) && !inQuotes) {
      if (cur) tokens.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function splitTerm(tok: string): { key: string; op: string; value: string } | null {
  const i = tok.search(/[:=<>]/);
  if (i <= 0) return null;
  const op = tok.slice(i).match(/^[:=<>]+/)![0];
  const value = tok.slice(i + op.length).replace(/^"|"$/g, "");
  if (!value) return null;
  return { key: tok.slice(0, i).toLowerCase(), op, value };
}

/** Parse a query into the panel's fields plus any terms it doesn't model. */
function parseQuery(query: string): { state: State; leftover: string[] } {
  const f: State = { ...EMPTY };
  const leftover: string[] = [];
  const find = (opts: string[], v: string) => opts.find((o) => o.toLowerCase() === v.toLowerCase());
  const num = (field: "cost" | "power" | "defense", op: string, v: string): boolean => {
    const o = op === "=" || op === ":" ? ":" : op === ">=" ? ">=" : op === "<=" ? "<=" : "";
    if (!o || v === "" || Number.isNaN(Number(v))) return false;
    if (field === "cost") (f.costOp = o), (f.cost = v);
    if (field === "power") (f.powerOp = o), (f.power = v);
    if (field === "defense") (f.defOp = o), (f.def = v);
    return true;
  };

  for (const tok of tokenize(query)) {
    const t = splitTerm(tok);
    if (!t) {
      leftover.push(tok);
      continue;
    }
    let handled = true;
    switch (t.key) {
      case "name": case "n": f.name = t.value; break;
      case "text": case "o": case "oracle": f.text = t.value; break;
      case "kw": case "keyword": f.keyword = t.value; break;
      case "s": case "set": case "e": f.set = t.value; break;
      case "have": case "owned": case "own": f.owned = true; break;
      case "pitch":
        if (["1", "2", "3"].includes(t.value)) f.pitch = t.value;
        else handled = false;
        break;
      case "c": case "class": {
        const m = find(CLASSES, t.value);
        if (m && !f.cls) f.cls = m;
        else handled = false;
        break;
      }
      case "t": case "type": {
        const tal = find(TALENTS, t.value);
        const ty = find(TYPES, t.value);
        if (tal && !f.talent) f.talent = tal;
        else if (ty && !f.type) f.type = ty;
        else handled = false;
        break;
      }
      case "r": case "rarity": {
        const m = find(RARITIES, t.value);
        if (m && !f.rarity) f.rarity = m;
        else handled = false;
        break;
      }
      case "cost": handled = num("cost", t.op, t.value); break;
      case "power": case "pow": case "p": handled = num("power", t.op, t.value); break;
      case "defense": case "def": case "d": handled = num("defense", t.op, t.value); break;
      default: handled = false;
    }
    if (!handled) leftover.push(tok);
  }
  return { state: f, leftover };
}

function buildQuery(f: State): string {
  const parts: string[] = [];
  const text = (field: string, v: string) => {
    const t = v.trim();
    if (t) parts.push(`${field}:${quote(t)}`);
  };
  const num = (field: string, op: string, v: string) => {
    const t = v.trim();
    if (t !== "" && !Number.isNaN(Number(t))) parts.push(`${field}${op}${t}`);
  };
  text("name", f.name);
  text("text", f.text);
  if (f.cls) parts.push(`c:${quote(f.cls)}`);
  if (f.talent) parts.push(`t:${quote(f.talent)}`);
  if (f.type) parts.push(`t:${quote(f.type)}`);
  if (f.rarity) parts.push(`r:${quote(f.rarity)}`);
  if (f.pitch) parts.push(`pitch:${f.pitch}`);
  num("cost", f.costOp, f.cost);
  num("power", f.powerOp, f.power);
  num("defense", f.defOp, f.def);
  text("kw", f.keyword);
  text("set", f.set);
  if (f.owned) parts.push("have:1");
  return parts.join(" ");
}

/** A visual builder for the search query language — no typing required. */
export function FilterPanel({ query, onApply, onClose }: FilterPanelProps) {
  // Parse the current query once on open: pre-select modeled fields, and keep
  // any terms the panel can't model so Apply preserves them.
  const parsed = useRef(parseQuery(query)).current;
  const [f, setF] = useState<State>(parsed.state);
  const set = (patch: Partial<State>) => setF((s) => ({ ...s, ...patch }));
  const apply = () => {
    onApply([...parsed.leftover, buildQuery(f)].filter(Boolean).join(" "));
    onClose();
  };

  return (
    <div className="absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[340px] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl shadow-black/50">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Filters</h3>

      <div className="flex flex-col gap-2.5">
        <Field label="Name">
          <Input value={f.name} onChange={(v) => set({ name: v })} placeholder="card name" />
        </Field>
        <Field label="Rules text">
          <Input value={f.text} onChange={(v) => set({ text: v })} placeholder="text on the card" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Class">
            <Select value={f.cls} onChange={(v) => set({ cls: v })} options={CLASSES} />
          </Field>
          <Field label="Talent">
            <Select value={f.talent} onChange={(v) => set({ talent: v })} options={TALENTS} />
          </Field>
          <Field label="Type">
            <Select value={f.type} onChange={(v) => set({ type: v })} options={TYPES} />
          </Field>
          <Field label="Rarity">
            <Select value={f.rarity} onChange={(v) => set({ rarity: v })} options={RARITIES} />
          </Field>
          <Field label="Pitch">
            <Select value={f.pitch} onChange={(v) => set({ pitch: v })} options={["1", "2", "3"]} />
          </Field>
        </div>

        <NumRow label="Cost" op={f.costOp} val={f.cost} onOp={(v) => set({ costOp: v })} onVal={(v) => set({ cost: v })} />
        <NumRow label="Power" op={f.powerOp} val={f.power} onOp={(v) => set({ powerOp: v })} onVal={(v) => set({ power: v })} />
        <NumRow label="Defense" op={f.defOp} val={f.def} onOp={(v) => set({ defOp: v })} onVal={(v) => set({ def: v })} />

        <div className="grid grid-cols-2 gap-2">
          <Field label="Keyword">
            <Input value={f.keyword} onChange={(v) => set({ keyword: v })} placeholder="e.g. dominate" />
          </Field>
          <Field label="Set">
            <Input value={f.set} onChange={(v) => set({ set: v })} placeholder="e.g. wtr" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-200">
          <input type="checkbox" checked={f.owned} onChange={(e) => set({ owned: e.target.checked })} />
          Only cards I own
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setF(EMPTY)}
          className="text-xs text-muted hover:text-white"
        >
          Clear
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-gray-200 hover:border-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-surface-2 px-1.5 py-1 text-xs text-gray-200 focus:border-accent focus:outline-none"
    >
      <option value="">Any</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function NumRow({
  label,
  op,
  val,
  onOp,
  onVal,
}: {
  label: string;
  op: string;
  val: string;
  onOp: (v: string) => void;
  onVal: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <select
        value={op}
        onChange={(e) => onOp(e.target.value)}
        className="rounded-md border border-border bg-surface-2 px-1.5 py-1 text-xs text-gray-200 focus:border-accent focus:outline-none"
      >
        {OPS.map(([label, value]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={val}
        onChange={(e) => onVal(e.target.value)}
        placeholder="—"
        className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none"
      />
    </div>
  );
}
