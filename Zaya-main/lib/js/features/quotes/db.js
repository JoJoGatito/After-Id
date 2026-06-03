let db;
let dbPromiseResolve;
const dbInitializedPromise = new Promise((resolve) => {
  dbPromiseResolve = resolve;
});

// Initialize IndexedDB with enhanced schema
const request = indexedDB.open("QuotesDB", 3); // Increment version to force upgrade

request.onupgradeneeded = function(event) {
  // console.log("Database upgrade needed, recreating object stores...");
  db = event.target.result;

  // Delete existing object stores if they exist (clean slate)
  if (db.objectStoreNames.contains("quotes")) {
    db.deleteObjectStore("quotes");
  }
  if (db.objectStoreNames.contains("settings")) {
    db.deleteObjectStore("settings");
  }

  // Create quotes object store with enhanced schema
  const quotesStore = db.createObjectStore("quotes", { keyPath: "id", autoIncrement: true });
  quotesStore.createIndex("pdfUrl", "pdfUrl", { unique: false });
  quotesStore.createIndex("timestamp", "timestamp", { unique: false });
  // console.log("Created quotes object store with indexes");

  // Create settings object store
  const settingsStore = db.createObjectStore("settings", { keyPath: "id" });
  // console.log("Created settings object store");
};

request.onsuccess = function(event) {
  db = event.target.result;
  // Ensure the database is ready before interacting with it
  window.dbInitialized = true;
  dbPromiseResolve(db);
  initializeDefaultSettings();
};

async function waitForDb() {
  if (window.dbInitialized && db) return db;
  return dbInitializedPromise;
}

function initializeDefaultSettings() {
  if (window.dbInitialized) {
    const transaction = db.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");

    // Set default theme if not exists
    const getThemeRequest = store.get("user_settings");
    getThemeRequest.onsuccess = function(event) {
      if (!event.target.result) {
        store.add({
          id: "user_settings",
          theme: "default",
          autoHide: true,
          volume: 50
        });
      }
    };
  }
}

export async function getAllQuotes(callback) {
  const database = await waitForDb();
  if (database) {
    const transaction = database.transaction("quotes", "readonly");
    const store = transaction.objectStore("quotes");
    const request = store.getAll();

    request.onsuccess = function(event) {
      callback(event.target.result);
    };
  } else {
    console.error("Failed to initialize database.");
    callback([]);
  }
}

export async function getQuotesByPdf(pdfUrl, callback) {
  const database = await waitForDb();
  if (database) {
    try {
      const transaction = database.transaction("quotes", "readonly");
      const store = transaction.objectStore("quotes");

      // Check if index exists
      if (store.indexNames.contains("pdfUrl")) {
        try {
          const index = store.index("pdfUrl");
          const request = index.getAll(pdfUrl);

          request.onsuccess = function(event) {
            callback(event.target.result || []);
          };

          request.onerror = function(event) {
            console.error("Index query failed, using fallback method:", event.target.error);
            fallbackGetQuotesByPdf(pdfUrl, callback);
          };
        } catch (indexError) {
          console.error("Index access failed, using fallback:", indexError);
          fallbackGetQuotesByPdf(pdfUrl, callback);
        }
      } else {
        // console.log("Index not found, using fallback method");
        fallbackGetQuotesByPdf(pdfUrl, callback);
      }
    } catch (error) {
      console.error("Database transaction error:", error);
      callback([]);
    }
  } else {
    console.error("Failed to initialize database.");
    callback([]);
  }
}

function fallbackGetQuotesByPdf(pdfUrl, callback) {
  // Fallback method: get all quotes and filter manually
  try {
    const transaction = db.transaction("quotes", "readonly");
    const store = transaction.objectStore("quotes");
    const request = store.getAll();

    request.onsuccess = function(event) {
      const allQuotes = event.target.result || [];
      const filteredQuotes = allQuotes.filter(quote => quote.pdfUrl === pdfUrl);
      // console.log(`Fallback: Found ${filteredQuotes.length} quotes for PDF: ${pdfUrl}`);
      callback(filteredQuotes);
    };

    request.onerror = function(event) {
      console.error("Fallback query also failed:", event.target.error);
      callback([]);
    };
  } catch (error) {
    console.error("Fallback method error:", error);
    callback([]);
  }
}

export async function addOrUpdateQuote(id, quote, pdfUrl = null, pdfName = null, pageNumber = null, callback) {
  const database = await waitForDb();
  if (database) {
    const transaction = database.transaction("quotes", "readwrite");
    const store = transaction.objectStore("quotes");

    const quoteData = {
      quote,
      pdfUrl: pdfUrl || '',
      pdfName: pdfName || (pdfUrl && pdfUrl !== '' ? new URL(pdfUrl).hostname : ''),
      timestamp: new Date().toISOString(),
      pageNumber: pageNumber || null
    };

    if (id) {
      quoteData.id = id;
      store.put(quoteData);
    } else {
      store.add(quoteData);
    }

    transaction.oncomplete = function() {
      // console.log("Quote saved successfully:", quoteData);
      if (callback) callback();
    };

    transaction.onerror = function(event) {
      console.error("Error saving quote:", event.target.error);
      if (callback) callback();
    };
  } else {
    console.error("Failed to initialize database.");
    if (callback) callback();
  }
}

export async function deleteQuote(id, callback) {
  const database = await waitForDb();
  if (database) {
    const transaction = database.transaction("quotes", "readwrite");
    const store = transaction.objectStore("quotes");

    store.delete(id).onsuccess = function() {
      callback();
    };
  } else {
    console.error("Failed to initialize database.");
  }
}

export async function getQuoteById(id, callback) {
  const database = await waitForDb();
  if (database) {
    try {
      const transaction = database.transaction("quotes", "readonly");
      const store = transaction.objectStore("quotes");
      const request = store.get(id);

      request.onsuccess = function(event) {
        callback(event.target.result);
      };

      request.onerror = function(event) {
        console.error("Error retrieving quote by ID:", event.target.error);
        callback(null);
      };
    } catch (error) {
      console.error("Database transaction error:", error);
      callback(null);
    }
  } else {
    console.error("Failed to initialize database.");
    callback(null);
  }
}

export async function getSettings(callback) {
  const database = await waitForDb();
  if (database) {
    const transaction = database.transaction("settings", "readonly");
    const store = transaction.objectStore("settings");
    const request = store.get("user_settings");

    request.onsuccess = function(event) {
      callback(event.target.result || { theme: "default", autoHide: true, volume: 50 });
    };
  } else {
    console.error("Failed to initialize database.");
  }
}

export async function updateSettings(settings, callback) {
  const database = await waitForDb();
  if (database) {
    const transaction = database.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");

    settings.id = "user_settings";
    store.put(settings);

    transaction.oncomplete = function() {
      callback();
    };
  } else {
    console.error("Failed to initialize database.");
  }
}
