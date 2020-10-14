function log(...args) {
    console.log("[AppConfig]", ...args);
}

const AppConfig = {
    init: async function(reader) {
        if (this._initialized === undefined) {
            this._initialized = (async () => {
                let data = {};
                try {
                    data = await reader.get();
                    reader.dispose();
                } catch {}
                Object.defineProperty(this, "dataFilesList", {value: data.dataFilesList || []});
                Object.defineProperty(this, "_initialized", {value: this});
                Object.freeze(this);
                log("Config loaded");
                return(this);
            })();
        }
        return this._initialized;
    },
};

export default AppConfig;
