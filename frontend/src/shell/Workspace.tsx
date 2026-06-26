/**
 * Workspace — vue principale : un éditeur de code à gauche, le canvas de blocs
 * à droite. Toute frappe pousse le code dans le store (`setSource`), qui parse
 * et reprojette le graphe ; le canvas se met à jour automatiquement.
 */

import { useEffect, useState } from "react";
import { useAstStore } from "../sync";
import BlocksCanvas from "../blocks/Components/BlocksCanvas";
import "../blocks/blocks.css";

const SAMPLE = `function classify(score) {
  let grade = "F";

  if (score >= 90) {
    grade = "A";
  } else if (score >= 70) {
    grade = "B";
  }

  for (let i = 0; i < score; i++) {
    grade = grade + "!";
  }

  return grade;
}

classify(85);
`;

export default function Workspace() {
  const [code, setCode] = useState(SAMPLE);
  const setSource = useAstStore((s) => s.setSource);
  const error = useAstStore((s) => s.error);

  // Seed le store au montage avec l'exemple.
  useEffect(() => {
    setSource(SAMPLE, "editor");
  }, [setSource]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setCode(next);
    setSource(next, "editor");
  };

  return (
    <div className="workspace">
      <textarea
        className="code-pane"
        value={code}
        onChange={onChange}
        spellCheck={false}
        aria-label="Code source"
      />
      <div className="canvas-pane">
        {error && (
          <div className="canvas-error">
            <strong>{error.phase}</strong> : {error.message}
          </div>
        )}
        <BlocksCanvas />
      </div>
    </div>
  );
}
