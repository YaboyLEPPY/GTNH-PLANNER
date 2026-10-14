import { useEffect, useState } from "react";
import { load, plain, decodeEntities } from "../data";
import { minecraftText } from "../domain/formatting";
import type { Goods, SourceItem } from "../types";
export function useData<T>(path: string) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError("");
    load<T>(path)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [path]);
  return { data, error };
}
export function Icon({
  goods,
  item,
  size = 32,
}: {
  goods?: Goods;
  item?: SourceItem;
  size?: number;
}) {
  const g = goods || item?.resolved;
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [g?.id]);
  return g && !missing ? (
    <img
      className="item-icon"
      src={`/assets/items/${g.icon}.webp`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={(e) => {
        setMissing(true);
      }}
    />
  ) : (
    <span
      className="unknown-icon"
      style={{ width: size, height: size }}
      title="No verified source icon"
    >
      ?
    </span>
  );
}
export function RichText({ text }: { text: string }) {
  return (
    <div className="rich-text">
      {minecraftText(decodeEntities(text)).map((run, i) => (
        <span
          key={i}
          style={{
            fontWeight: run.bold ? 700 : undefined,
            fontStyle: run.italic ? "italic" : undefined,
            textDecoration:
              [
                run.underline ? "underline" : "",
                run.strike ? "line-through" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined,
          }}
        >
          {run.text.split(/(https?:\/\/[^\s<>]+)/g).map((part, j) =>
            /^https?:/.test(part) ? (
              <a key={j} href={part} target="_blank" rel="noreferrer">
                {part}
              </a>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </span>
      ))}
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error" role="alert">
      {message}
      <button onClick={() => location.reload()}>Retry</button>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
