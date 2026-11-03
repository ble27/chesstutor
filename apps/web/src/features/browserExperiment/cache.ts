import { object, integer } from "../../api/analysisFields";

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("chess-browser-experiment-v1", 1);
    let settled = false;
    const fail = () => {
      settled = true;
      clearTimeout(timer);
      reject(new Error("Local analysis storage unavailable."));
    };
    const timer = setTimeout(fail, 2000);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("positions", {
        keyPath: ["key", "ply"],
      });
    request.onsuccess = () => {
      clearTimeout(timer);
      if (settled) request.result.close();
      else {
        settled = true;
        resolve(request.result);
      }
    };
    request.onerror = fail;
    request.onblocked = fail;
  });
}
export async function cachedPositions(
  key: string,
): Promise<Map<number, unknown>> {
  try {
    const db = await database();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("positions", "readonly");
      const request = transaction
        .objectStore("positions")
        .getAll(IDBKeyRange.bound([key, 1], [key, 300]));
      request.onsuccess = () => {
        const values: unknown = request.result;
        try {
          const result = new Map<number, unknown>();
          if (Array.isArray(values) && values.length <= 300)
            for (const value of values) {
              const row = object(value);
              const ply = integer(row.ply, 1, 300);
              if (integer(object(row.raw).ply, 1, 300) === ply)
                result.set(ply, row.raw);
            }
          resolve(result);
        } catch {
          resolve(new Map());
        }
      };
      request.onerror = () => reject(new Error("Local cache read failed."));
      transaction.oncomplete = () => db.close();
    });
  } catch {
    return new Map();
  }
}
export async function savePosition(
  key: string,
  raw: unknown,
): Promise<boolean> {
  try {
    const db = await database();
    return await new Promise((resolve) => {
      const transaction = db.transaction("positions", "readwrite");
      transaction
        .objectStore("positions")
        .put({ key, ply: integer(object(raw).ply, 1, 300), raw });
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      transaction.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function clearCachedPositions(key: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("positions", "readwrite");
    transaction
      .objectStore("positions")
      .delete(IDBKeyRange.bound([key, 1], [key, 300]));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onabort = () => {
      db.close();
      reject(new Error("Cache removal failed."));
    };
  });
}
