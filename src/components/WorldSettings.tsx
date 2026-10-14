import { useState } from "react";
import { Download, Upload, Shield, RotateCcw } from "lucide-react";
import {
  applyLVProfile,
  emptyWorld,
  validateWorld,
  type World,
} from "../domain/world";
import { download } from "./Production";
import { ErrorBox } from "./Common";
export function WorldSettings({
  world,
  update,
}: {
  world: World;
  update: (w: World) => void;
}) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState<World>(),
    [message, setMessage] = useState("");
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORLD, ON YOUR DEVICE</div>
          <h1>
            World <span>& backup</span>
          </h1>
          <p>
            No account. No cloud sync. Export a backup to take your plan with
            you.
          </p>
        </div>
        <Shield size={36} color="#8e9bbf" />
      </div>
      <div className="columns">
        <section className="panel">
          <h2>World profile</h2>
          <label className="stacked">
            World name
            <input
              aria-label="World name"
              value={world.name}
              maxLength={200}
              onChange={(e) => update({ ...world, name: e.target.value })}
            />
          </label>
          <label className="stacked">
            Progression & playing notes
            <textarea
              aria-label="World notes"
              value={world.notes}
              onChange={(e) => update({ ...world, notes: e.target.value })}
            />
          </label>
          <details>
            <summary>Optional “Lachy's LV start” profile</summary>
            <p>
              Historical notes only, not current inventory. Renames this profile
              and its four base-floor suggestions; keeps actual stock and
              objects.
            </p>
            <button
              onClick={() => {
                update(applyLVProfile(world));
                setMessage(
                  "LV notes applied. Edit or delete them freely; no historical stock was added.",
                );
              }}
            >
              Apply editable LV notes
            </button>
          </details>
        </section>
        <section className="panel">
          <h2>Portable backups</h2>
          <p style={{ margin: "12px 0 18px" }}>
            This browser stores your stock, orders, quest progress, notes and
            base. Browser data can be cleared. Keep an exported copy.
          </p>
          <div className="backup-actions">
            <button
              onClick={() =>
                download(
                  JSON.stringify(world, null, 2),
                  "horizon-foundry-world.json",
                )
              }
            >
              <Download size={16} />
              Export world backup
            </button>
            <label className="import-button">
              <Upload size={16} />
              Choose backup
              <input
                aria-label="Import world backup"
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  setError("");
                  setPending(undefined);
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    if (f.size > 10_000_000)
                      throw new Error("Backup exceeds 10 MB.");
                    setPending(validateWorld(JSON.parse(await f.text())));
                  } catch (err) {
                    setError(
                      `Import rejected; your world is unchanged. ${(err as Error).message}`,
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {pending && (
            <div className="notice">
              <strong>Validated: {pending.name}</strong>
              <p>
                {pending.orders.length} orders · {pending.base.zones.length}{" "}
                base zones · {pending.progress.done.length} completed quests
              </p>
              <button
                onClick={() => {
                  download(
                    JSON.stringify(world, null, 2),
                    "horizon-foundry-before-import.json",
                  );
                  update(pending);
                  setPending(undefined);
                  setMessage(
                    "Backup imported. The previous world was exported first.",
                  );
                }}
              >
                Replace current world with this backup
              </button>
              <button onClick={() => setPending(undefined)}>Cancel</button>
            </div>
          )}
          <p style={{ marginTop: 15, fontSize: 12 }}>
            Schema 2 backups are validated before replacing anything. Schema 1
            is migrated by adding quest targets. Malformed or newer schemas are
            rejected. Undo covers this session; the previous autosave is
            retained for recovery.
          </p>
        </section>
      </div>
      {error && <ErrorBox message={error} />}
      <p role="status" className={message ? "notice" : ""}>
        {message}
      </p>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Source & calculation notes</h2>
        <p style={{ marginTop: 12 }}>
          A community project, not an official GTNH product. Questbook:
          2.9.0-beta-3, pinned official modpack data, CC BY-NC-SA 4.0. Midnight
          by kastaqt. Recipes & icons: ShadowTheAge 2.9.0-v7 export, no
          redistribution license. These versions differ.
        </p>
        <p style={{ marginTop: 12 }}>
          The source contains 46 chapter definitions and 67 unassigned quests.
          All are accessible. Ender IO's introduction is in MV, lights in
          Building Better Bases. Unknown item identities and custom NBT that
          cannot be verified remain explicit.
        </p>
        <p style={{ marginTop: 12 }}>
          The calculator checks voltage, detects cycles, rounds batches and
          allocates stock. It does not guarantee machine availability, research,
          tool durability, optimal routes, or multiblock validity. Probabilistic
          and secondary outputs are not credited. Check recipes against your
          game's NEI.
        </p>
        <div className="toolbar" style={{ marginTop: 15 }}>
          <a href="/data/integrity.json" target="_blank" rel="noreferrer">
            Full source integrity report ↗
          </a>
          <a href="/data/quest-source.tar.gz" download>
            Original quest data archive
          </a>
        </div>
      </section>
      <details style={{ marginTop: 25 }}>
        <summary>Start a new empty world</summary>
        <p>
          Export a backup first. This clears this profile's progress, plans and
          stock.
        </p>
        <button
          className="danger"
          onClick={() => {
            download(
              JSON.stringify(world, null, 2),
              "horizon-foundry-before-reset.json",
            );
            update(emptyWorld());
            setMessage(
              "New empty world created. Previous world exported; Undo remains available this session.",
            );
          }}
        >
          <RotateCcw size={16} />
          Export current world and reset
        </button>
      </details>
    </div>
  );
}
