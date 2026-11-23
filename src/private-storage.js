// Safari's extension origin keeps this database separate from publisher content scripts.
export function createPrivateStorage() {
  let connection;

  function connect() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open('authorC', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'key' });
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            connection = undefined;
          };
          db.onclose = () => { connection = undefined; };
          resolve(db);
        };
        request.onerror = () => {
          connection = undefined;
          reject(request.error);
        };
      });
    }
    return connection;
  }

  async function transact(mode, operation) {
    const db = await connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('entries', mode);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('Storage transaction aborted'));
      operation(transaction.objectStore('entries'));
    });
  }

  return {
    async get(keys) {
      const result = {};
      await transact('readonly', store => {
        if (keys === null) {
          const request = store.getAll();
          request.onsuccess = () => {
            for (const record of request.result) result[record.key] = record.value;
          };
        } else {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            const request = store.get(key);
            request.onsuccess = () => {
              if (request.result) result[key] = request.result.value;
            };
          }
        }
      });
      return result;
    },
    set(values, clearPrefix) {
      return transact('readwrite', store => {
        if (clearPrefix) store.delete(IDBKeyRange.bound(clearPrefix, clearPrefix + '\uffff'));
        for (const [key, value] of Object.entries(values)) store.put({ key, value });
      });
    },
    remove(keys) {
      return transact('readwrite', store => {
        for (const key of keys) store.delete(key);
      });
    },
  };
}
