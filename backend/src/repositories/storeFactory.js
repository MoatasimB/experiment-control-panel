import { createPool } from "../db/client.js";
import { PostgresStore } from "./postgresStore.js";
import { Store } from "./store.js";

export function createStore() {
  if (process.env.DATABASE_URL) {
    return new PostgresStore(createPool());
  }

  return new Store();
}
