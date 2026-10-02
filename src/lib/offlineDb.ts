"use client";
// Cola local de hábitos pendientes de subir, para que marcar/desmarcar funcione sin
// internet. Usa IndexedDB directo (sin librerías) para que sobreviva recargas de página.
// Nada de esto lo ven los demás: solo se escribe en Supabase cuando sync() tiene éxito.

const DB_NAME = "winter-arc";
const DB_VERSION = 1;
const STORE = "habit_actions";

export type HabitActionType = "add" | "remove";
export type HabitActionStatus = "pending" | "synced";

export type HabitAction = {
  id: number;
  user_id: string;
  date: string;
  habit_key: string;
  action: HabitActionType;
  status: HabitActionStatus;
  created_at: number;
};

function hasIndexedDB() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) return Promise.reject(new Error("IndexedDB no disponible en este navegador"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("user_id", "user_id");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("No se pudo abrir la base local"));
    };
  });
  return dbPromise;
}

// Agrega un hábito marcado/desmarcado a la cola local, con status "pending"
export async function addPendingAction(action: Omit<HabitAction, "id" | "status">): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add({ ...action, status: "pending" satisfies HabitActionStatus });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error ?? new Error("No se pudo guardar localmente"));
  });
}

// Acciones pendientes de un usuario, en el orden en que se crearon (para subirlas en orden)
export async function getPendingActions(userId: string): Promise<HabitAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).index("user_id").getAll(userId);
    req.onsuccess = () => {
      const rows = (req.result as HabitAction[]) ?? [];
      resolve(
        rows
          .filter((a) => a.status === "pending")
          .sort((a, b) => a.id - b.id),
      );
    };
    req.onerror = () => reject(req.error ?? new Error("No se pudo leer la cola local"));
  });
}

// Marca una acción como ya subida a Supabase
export async function markActionSynced(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result as HabitAction | undefined;
      if (!row) return resolve();
      const putReq = store.put({ ...row, status: "synced" satisfies HabitActionStatus });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error ?? new Error("No se pudo actualizar la cola local"));
    };
    getReq.onerror = () => reject(getReq.error ?? new Error("No se pudo leer la cola local"));
  });
}

// Limpieza: borra acciones ya sincronizadas con más de un día, para no crecer sin límite.
// Es "best effort": si falla, no pasa nada (se vuelve a intentar en el siguiente ciclo).
export async function pruneSyncedActions(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const db = await openDb();
    const cutoff = Date.now() - olderThanMs;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        const row = cursor.value as HabitAction;
        if (row.status === "synced" && row.created_at < cutoff) cursor.delete();
        cursor.continue();
      };
      req.onerror = () => resolve();
    });
  } catch {
    // sin IndexedDB no hay nada que limpiar
  }
}
