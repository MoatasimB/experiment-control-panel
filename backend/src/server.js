import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRouter } from "./api/routes.js";
import { loadEnv } from "./config/env.js";
import { createStore } from "./repositories/storeFactory.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
const publicDir = fs.existsSync(frontendDist)
  ? frontendDist
  : path.resolve(__dirname, "../../frontend");
const port = Number(process.env.PORT || 4173);

const store = createStore();
const server = http.createServer(createRouter(store, publicDir));

server.listen(port, () => {
  console.log(`Experiment Reliability Control Plane running at http://localhost:${port}`);
  console.log(process.env.DATABASE_URL ? "Using Postgres store." : "Using in-memory store.");
  if (!fs.existsSync(frontendDist)) {
    console.log("React build not found. For frontend development, run `npm run dev:web` in another terminal.");
  }
});
