const DB_NAME = "interview-recordings";
const DB_VERSION = 1;
const STORE_SEGMENTS = "segments";
const STORE_CHUNKS = "chunks";

export interface PendingSegment {
    interviewId: string;
    turnCount: number;
    uploadUrl: string;
    objectKey: string;
    expiresAt: number; // epoch ms
    status: "recording" | "pending" | "uploading";
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
                db.createObjectStore(STORE_SEGMENTS, { keyPath: ["interviewId", "turnCount"] });
            }
            if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
                // key: interviewId + "_" + turnCount + "_" + index
                db.createObjectStore(STORE_CHUNKS, { keyPath: "key" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function tx(
    db: IDBDatabase,
    stores: string | string[],
    mode: IDBTransactionMode,
): IDBTransaction {
    return db.transaction(stores, mode);
}

export async function saveSegmentMeta(segment: PendingSegment): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const t = tx(db, STORE_SEGMENTS, "readwrite");
        t.objectStore(STORE_SEGMENTS).put(segment);
        t.oncomplete = () => { db.close(); resolve(); };
        t.onerror = () => { db.close(); reject(t.error); };
    });
}

export async function appendChunk(
    interviewId: string,
    turnCount: number,
    index: number,
    chunk: Blob,
): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const key = `${interviewId}_${turnCount}_${index}`;
        const t = tx(db, STORE_CHUNKS, "readwrite");
        t.objectStore(STORE_CHUNKS).put({ key, interviewId, turnCount, index, chunk });
        t.oncomplete = () => { db.close(); resolve(); };
        t.onerror = () => { db.close(); reject(t.error); };
    });
}

export async function getChunks(
    interviewId: string,
    turnCount: number,
): Promise<Blob[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const results: { index: number; chunk: Blob }[] = [];
        const t = tx(db, STORE_CHUNKS, "readonly");
        const req = t.objectStore(STORE_CHUNKS).openCursor();
        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const record = cursor.value as { interviewId: string; turnCount: number; index: number; chunk: Blob };
                if (record.interviewId === interviewId && record.turnCount === turnCount) {
                    results.push({ index: record.index, chunk: record.chunk });
                }
                cursor.continue();
            } else {
                db.close();
                results.sort((a, b) => a.index - b.index);
                resolve(results.map((r) => r.chunk));
            }
        };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

export async function deleteSegment(
    interviewId: string,
    turnCount: number,
): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const t = tx(db, [STORE_SEGMENTS, STORE_CHUNKS], "readwrite");
        t.objectStore(STORE_SEGMENTS).delete([interviewId, turnCount]);

        // delete chunks for this segment
        const chunkStore = t.objectStore(STORE_CHUNKS);
        const req = chunkStore.openCursor();
        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const record = cursor.value as { interviewId: string; turnCount: number };
                if (record.interviewId === interviewId && record.turnCount === turnCount) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
        t.oncomplete = () => { db.close(); resolve(); };
        t.onerror = () => { db.close(); reject(t.error); };
    });
}

export async function getPendingSegments(): Promise<PendingSegment[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const results: PendingSegment[] = [];
        const t = tx(db, STORE_SEGMENTS, "readonly");
        const req = t.objectStore(STORE_SEGMENTS).openCursor();
        req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const seg = cursor.value as PendingSegment;
                if (seg.status === "pending") results.push(seg);
                cursor.continue();
            } else {
                db.close();
                resolve(results);
            }
        };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}
