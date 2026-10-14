import { lazy, Suspense, useState, useMemo } from "react";
import {
  BookOpen,
  Anvil,
  Package,
  Grid3X3,
  Settings,
  Mountain,
} from "lucide-react";
import { Questbook } from "./components/Questbook";
import {
  readWorld,
  writeWorld,
  backupKey,
  addPlan,
  validateWorld,
  type World,
} from "./domain/world";
import type { ProductionDraft, SavedPlan } from "./components/Production";
import type { SourceItem } from "./types";
const Production = lazy(() =>
  import("./components/Production").then((m) => ({ default: m.Production })),
);
const BasePlanner = lazy(() =>
  import("./components/BasePlanner").then((m) => ({ default: m.BasePlanner })),
);
const Materials = lazy(() =>
  import("./components/Materials").then((m) => ({ default: m.Materials })),
);
const WorldSettings = lazy(() =>
  import("./components/WorldSettings").then((m) => ({
    default: m.WorldSettings,
  })),
);
export default function App() {
  const [initial] = useState(readWorld),
    [world, setWorld] = useState(initial.world),
    [history, setHistory] = useState<World[]>([]),
    [tab, setTab] = useState("Questbook"),
    [draft, setDraft] = useState<ProductionDraft | null>(null),
    [saveError, setSaveError] = useState(initial.error || ""),
    [notice, setNotice] = useState("");
  const availableStock = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(world.stock).map(([id, n]) => [
          id,
          Math.max(0, n - (world.resources[id]?.reserved || 0)),
        ]),
      ),
    [world.stock, world.resources],
  );
  function update(w: World) {
    if (initial.raw && saveError) {
      setNotice("Recover or export the damaged save before making changes.");
      return;
    }
    setHistory((h) => [...h.slice(-49), world]);
    setWorld(w);
    try {
      writeWorld(w);
      setSaveError("");
    } catch (e) {
      setSaveError(
        `Saving failed: ${(e as Error).message}. Export a backup before leaving this page.`,
      );
    }
  }
  function undo() {
    if (!history.length) return;
    const w = history[history.length - 1];
    try {
      writeWorld(w);
      setWorld(w);
      setHistory((h) => h.slice(0, -1));
      setSaveError("");
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }
  function plan(item: SourceItem, source: string) {
    if (!item.resolved) return;
    setDraft({
      id: item.resolved.id,
      amount: Number(item.Count ?? item.Amount ?? 1),
      source,
    });
    setTab("Production");
  }
  const nav = [
    [BookOpen, "Questbook"],
    [Anvil, "Production"],
    [Package, "Materials"],
    [Grid3X3, "Base planner"],
    [Settings, "World & backup"],
  ] as const;
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("Questbook");
          }}
        >
          <div className="brand-mark">
            <Mountain size={27} />
          </div>
          <span>
            HORIZON <b>FOUNDRY</b>
            <small>A GT NEW HORIZONS COMPANION</small>
          </span>
        </a>
        <div className="local-indicator">
          <span />
          {world.name} · saved on this device
        </div>
      </header>
      <nav className="main-nav" aria-label="Main navigation">
        {nav.map(([Icon, label]) => (
          <button
            key={label}
            className={tab === label ? "current" : ""}
            onClick={() => {
              setTab(label);
              setNotice("");
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <main>
        {saveError && (
          <div className="error" role="alert">
            <div>
              {saveError}
              <small>Your existing stored data has not been overwritten.</small>
            </div>
            {initial.raw && (
              <>
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([initial.raw!]));
                    a.download = "horizon-foundry-damaged-save.json";
                    a.click();
                  }}
                >
                  Export damaged save
                </button>
                <button
                  onClick={() => {
                    try {
                      const previous = localStorage.getItem(backupKey);
                      if (!previous)
                        throw new Error(
                          "No previous autosave is available. Export damaged data, then reset.",
                        );
                      const w = validateWorld(JSON.parse(previous));
                      writeWorld(w);
                      setWorld(w);
                      setSaveError("");
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                >
                  Recover previous autosave
                </button>
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([initial.raw!]));
                    a.download = "horizon-foundry-damaged-save.json";
                    a.click();
                    writeWorld(world);
                    setSaveError("");
                  }}
                >
                  Export damaged save and start empty
                </button>
              </>
            )}
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <Suspense fallback={<p className="loading">Opening planner…</p>}>
          {tab === "Questbook" ? (
            <Questbook
              progress={world.progress}
              update={(progress) => update({ ...world, progress })}
              plan={plan}
              gather={(item, quest, id) => {
                if (item.resolved) {
                  update({
                    ...world,
                    questTargets: {
                      ...world.questTargets,
                      [`${id}:${item.resolved.id}`]: {
                        quest,
                        id: item.resolved.id,
                        amount: Number(item.Count ?? item.Amount ?? 1),
                      },
                    },
                  });
                  setNotice(
                    "Quest target linked to Materials. It shares existing demand instead of duplicating it.",
                  );
                }
              }}
            />
          ) : tab === "Production" ? (
            <Production
              draft={draft}
              stock={availableStock}
              onSave={(p: SavedPlan) => update(addPlan(world, p))}
              onGather={(bill) => {
                const resources = { ...world.resources };
                for (const r of bill) {
                  const existing = resources[r.id];
                  resources[r.id] = {
                    name: existing?.name || r.name,
                    unit: existing?.unit || r.unit,
                    notes: existing?.notes || "",
                    location: existing?.location || "",
                    reserved: existing?.reserved || 0,
                    desired: Math.max(
                      existing?.desired || 0,
                      r.amount + (world.stock[r.id] || 0),
                    ),
                  };
                }
                update({ ...world, resources });
              }}
            />
          ) : tab === "Materials" ? (
            <Materials
              world={world}
              update={update}
              undo={undo}
              canUndo={history.length > 0}
            />
          ) : tab === "World & backup" ? (
            <WorldSettings world={world} update={update} />
          ) : (
            <BasePlanner world={world} update={update} />
          )}
        </Suspense>
      </main>
      <footer>
        Community planner · Not an official GTNH product{" "}
        <span>Questbook 2.9.0-beta-3 / Recipes 2.9.0-v7</span>
      </footer>
    </>
  );
}
