import { useState } from "react";
import { HomePage } from "./components/HomePage";
import { GamePage } from "./components/GamePage";
import { ResultPage } from "./components/ResultPage";
import { StatsPage } from "./components/StatsPage";
import { RulesModal } from "./components/Modals";

type Screen = "home" | "game" | "result" | "stats";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <main className="app-shell">
      <div className="phone-frame">
        {screen === "home" && <HomePage onPlay={() => setScreen("game")} onStats={() => setScreen("stats")} onRules={() => setRulesOpen(true)} />}
        {screen === "game" && <GamePage onHome={() => setScreen("home")} onWin={() => setScreen("result")} />}
        {screen === "result" && <ResultPage onAgain={() => setScreen("game")} onHome={() => setScreen("home")} />}
        {screen === "stats" && <StatsPage onBack={() => setScreen("home")} />}
      </div>
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </main>
  );
}
