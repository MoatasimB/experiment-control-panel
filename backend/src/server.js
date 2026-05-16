import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRouter } from "./api/routes.js";
import { Store } from "./repositories/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../frontend/src");
const port = Number(process.env.PORT || 4173);

const store = new Store();
const server = http.createServer(createRouter(store, publicDir));

server.listen(port, () => {
  console.log(`Experiment Reliability Control Plane running at http://localhost:${port}`);
});
