import { render } from "preact";
import { initTelegram } from "./lib/telegram";
import { App } from "./App";
import "./index.css";

initTelegram();

render(<App />, document.getElementById("app")!);
