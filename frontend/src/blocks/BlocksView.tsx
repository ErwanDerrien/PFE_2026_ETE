/**
 * BlocksView — point d'entrée de la vue Blocs (équipe A : Adel & Junior),
 * monté par le shell (`shell/App.tsx`) dans le panneau « Blocs Visuels ».
 *
 * Rend le canvas React Flow (`BlocksCanvas`) branché sur le store partagé :
 * le graphe est projeté depuis l'objet structuré (`codeObj`), et chaque
 * création/modification/suppression de bloc régénère l'AST + le code source.
 *
 * Le wrapper occupe tout le panneau (`.panel-content` est en position:relative,
 * ce qui ancre aussi la sidebar d'édition, positionnée en absolu).
 */

import BlocksCanvas from "./Components/BlocksCanvas";
import "./blocks.css";

function BlocksView({ mode }: { mode: "light" | "dark" }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <BlocksCanvas mode={mode} />
    </div>
  );
}

export default BlocksView;