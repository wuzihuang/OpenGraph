import type { GoalCharter } from "../../../packages/contracts/src/index.ts";

type GoalCharterBannerProps = {
  goal: string;
  goalCharter?: GoalCharter;
};

const layers: Array<{
  key: keyof GoalCharter;
  label: string;
  accent: string;
}> = [
  { key: "strategic", label: "Strategic", accent: "#e6d09a" },
  { key: "medium", label: "Medium", accent: "#e0b56a" },
  { key: "fast", label: "Fast", accent: "#9eb0ff" },
];

export function GoalCharterBanner(props: GoalCharterBannerProps) {
  const { goal, goalCharter } = props;

  if (!goalCharter) {
    return (
      <div className="goal-charter">
        <h1>{goal}</h1>
        <p className="goal-charter-missing">
          Goal Charter missing — planner must confirm Strategic / Medium / Fast
          goals before publish.
        </p>
      </div>
    );
  }

  return (
    <div className="goal-charter">
      <h1>{goal}</h1>
      <div className="goal-charter-grid">
        {layers.map(function renderLayer(layer) {
          return (
            <article
              key={layer.key}
              className="goal-charter-card"
              style={{ borderTopColor: layer.accent }}
            >
              <span>{layer.label}</span>
              <p>{goalCharter[layer.key]}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
