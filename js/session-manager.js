// ─── Qualitative Coding Tool — Session Manager (IndexedDB) ───
// Multi-session support with named slots, snapshots, and migration from localStorage.

const SessionManager = (() => {
  const DB_NAME = 'qct_sessions';
  const DB_VERSION = 1;
  const STORE_SESSIONS = 'sessions';
  const STORE_SNAPSHOTS = 'snapshots';
  const STORE_META = 'meta'; // active session id, etc.

  let db = null;

  // ── Open / init DB ──
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_SESSIONS)) {
          const s = d.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          s.createIndex('name', 'name', { unique: false });
          s.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!d.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const s = d.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
          s.createIndex('sessionId', 'sessionId', { unique: false });
          s.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!d.objectStoreNames.contains(STORE_META)) {
          d.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ── Helpers ──
  function tx(stores, mode) {
    const t = db.transaction(stores, mode);
    return t;
  }
  function store(name, mode) {
    return tx(name, mode).objectStore(name);
  }
  function reqP(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ── Meta (active session id) ──
  async function getMeta(key) {
    await open();
    const r = await reqP(store(STORE_META, 'readonly').get(key));
    return r ? r.value : null;
  }
  async function setMeta(key, value) {
    await open();
    await reqP(store(STORE_META, 'readwrite').put({ key, value }));
  }

  // ── Sessions CRUD ──
  async function listSessions() {
    await open();
    const all = await reqP(store(STORE_SESSIONS, 'readonly').getAll());
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function getSession(id) {
    await open();
    return reqP(store(STORE_SESSIONS, 'readonly').get(id));
  }

  async function saveSession(id, name, stateData) {
    await open();
    const now = Date.now();
    const existing = await reqP(store(STORE_SESSIONS, 'readonly').get(id));
    const record = {
      id,
      name: name || (existing ? existing.name : 'Sesja ' + new Date().toLocaleDateString('pl')),
      data: stateData,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      segmentCount: stateData.segments ? stateData.segments.length : 0,
      codeCount: stateData.codebook ? Object.keys(stateData.codebook).length : 0,
    };
    await reqP(store(STORE_SESSIONS, 'readwrite').put(record));
    await setMeta('activeSessionId', id);
    return record;
  }

  async function createSession(name) {
    const id = uid();
    const emptyState = {
      segments: [],
      codebook: {},
      themes: {},
      dimensions: {},
      codingMode: 'inductive',
      currentIndex: 0,
    };
    return saveSession(id, name || 'Nowa sesja', emptyState);
  }

  async function renameSession(id, newName) {
    await open();
    const s = await reqP(store(STORE_SESSIONS, 'readonly').get(id));
    if (!s) return null;
    s.name = newName;
    s.updatedAt = Date.now();
    await reqP(store(STORE_SESSIONS, 'readwrite').put(s));
    return s;
  }

  async function deleteSession(id) {
    await open();
    // Delete associated snapshots
    const snaps = await listSnapshots(id);
    const t = tx([STORE_SESSIONS, STORE_SNAPSHOTS], 'readwrite');
    t.objectStore(STORE_SESSIONS).delete(id);
    for (const snap of snaps) {
      t.objectStore(STORE_SNAPSHOTS).delete(snap.id);
    }
    await new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej; });
    // If deleted session was active, clear active
    const active = await getMeta('activeSessionId');
    if (active === id) {
      const remaining = await listSessions();
      if (remaining.length > 0) {
        await setMeta('activeSessionId', remaining[0].id);
      } else {
        await setMeta('activeSessionId', null);
      }
    }
  }

  async function duplicateSession(id, newName) {
    await open();
    const s = await reqP(store(STORE_SESSIONS, 'readonly').get(id));
    if (!s) return null;
    const newId = uid();
    const now = Date.now();
    const copy = {
      id: newId,
      name: newName || s.name + ' (kopia)',
      data: JSON.parse(JSON.stringify(s.data)),
      createdAt: now,
      updatedAt: now,
      segmentCount: s.segmentCount,
      codeCount: s.codeCount,
    };
    await reqP(store(STORE_SESSIONS, 'readwrite').put(copy));
    return copy;
  }

  // ── Snapshots ──
  async function createSnapshot(sessionId, label) {
    await open();
    const s = await reqP(store(STORE_SESSIONS, 'readonly').get(sessionId));
    if (!s) return null;
    const snap = {
      id: uid(),
      sessionId,
      label: label || new Date().toLocaleString('pl'),
      createdAt: Date.now(),
      data: JSON.parse(JSON.stringify(s.data)),
      segmentCount: s.segmentCount,
      codeCount: s.codeCount,
    };
    await reqP(store(STORE_SNAPSHOTS, 'readwrite').put(snap));
    return snap;
  }

  async function listSnapshots(sessionId) {
    await open();
    const all = await reqP(store(STORE_SNAPSHOTS, 'readonly').getAll());
    return all
      .filter(s => s.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async function restoreSnapshot(snapshotId) {
    await open();
    const snap = await reqP(store(STORE_SNAPSHOTS, 'readonly').get(snapshotId));
    if (!snap) return null;
    const session = await reqP(store(STORE_SESSIONS, 'readonly').get(snap.sessionId));
    if (!session) return null;
    // Save current state as a snapshot before restoring
    await createSnapshot(snap.sessionId, '⟵ przed przywróceniem');
    session.data = JSON.parse(JSON.stringify(snap.data));
    session.updatedAt = Date.now();
    session.segmentCount = snap.segmentCount;
    session.codeCount = snap.codeCount;
    await reqP(store(STORE_SESSIONS, 'readwrite').put(session));
    return session;
  }

  async function deleteSnapshot(snapshotId) {
    await open();
    await reqP(store(STORE_SNAPSHOTS, 'readwrite').delete(snapshotId));
  }

  // ── Active session ──
  async function getActiveSessionId() {
    return getMeta('activeSessionId');
  }

  async function setActiveSessionId(id) {
    return setMeta('activeSessionId', id);
  }

  // ── Migration from localStorage ──
  async function migrateFromLocalStorage() {
    const raw = localStorage.getItem('qct_state');
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      const id = uid();
      const session = await saveSession(id, 'Sesja (migracja)', data);
      // Don't remove localStorage yet — keep as fallback
      localStorage.setItem('qct_state_migrated', '1');
      return session;
    } catch (e) {
      console.warn('Migration from localStorage failed:', e);
      return null;
    }
  }

  // ── Export / Import ──
  async function exportSession(id) {
    await open();
    const s = await reqP(store(STORE_SESSIONS, 'readonly').get(id));
    if (!s) return null;
    return {
      _format: 'qct-session',
      _version: 1,
      name: s.name,
      exportedAt: new Date().toISOString(),
      data: s.data,
    };
  }

  async function importSession(jsonObj, name) {
    let data;
    if (jsonObj._format === 'qct-session') {
      data = jsonObj.data;
      name = name || jsonObj.name || 'Import';
    } else if (jsonObj.segments || jsonObj.codebook) {
      // Legacy QCT JSON format
      data = jsonObj;
      name = name || 'Import (legacy)';
    } else {
      throw new Error('Nierozpoznany format pliku');
    }
    const id = uid();
    return saveSession(id, name, data);
  }

  // ── Storage estimate ──
  async function getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return {
        used: est.usage || 0,
        quota: est.quota || 0,
        percent: est.quota ? ((est.usage / est.quota) * 100).toFixed(1) : 0,
      };
    }
    return null;
  }

  return {
    open,
    listSessions,
    getSession,
    saveSession,
    createSession,
    renameSession,
    deleteSession,
    duplicateSession,
    createSnapshot,
    listSnapshots,
    restoreSnapshot,
    deleteSnapshot,
    getActiveSessionId,
    setActiveSessionId,
    migrateFromLocalStorage,
    exportSession,
    importSession,
    getStorageEstimate,
  };
})();
