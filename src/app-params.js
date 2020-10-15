function log(...args) {
    console.log("[AppParams]", ...args);
}

const AppParams = {}

AppParams.appName = "SymbiFlow Database Visualizer";

const params = new URLSearchParams(window.location.search);

const databaseFileStr = params.get("dbfile");
AppParams.databaseFile = databaseFileStr ? new URL(databaseFileStr, window.location) : null;

AppParams.gridId = params.get("grid") || "";

for (const [k, v] of Object.entries(AppParams)) {
    log(`${k}: ${v}`);
    Object.defineProperty(AppParams, k, {configurable: false, writable: false, enumerable: false});
}
Object.freeze(AppParams);

export default AppParams;
