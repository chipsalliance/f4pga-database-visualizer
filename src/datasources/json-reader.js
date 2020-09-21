function splitPath(path) {
    if (typeof path == "string") {
        const keyRe = RegExp(/(?:^|\.)(?:(\w+)|("(?:[^"\\]|\\.)*"))|\[(\d+)\]/g);
        const segments = path.matchAll(keyRe);
        let result = [];
        for (const segment of segments) {
            if (segment[1] != undefined) result.push(segment[1]);
            else if (segment[2] != undefined) result.push(JSON.parse(segment[2]));
            else if (segment[3] != undefined) result.push(parseInt(segment[3]));
        }
        return result;
    }
    return path;
}

function stringifyPath(path) {
    path = splitPath(path);
    let result = "";
    for (const segment of path) {
        if (typeof segment == "number") {
            result += `[${segment}]`;
        } else if (segment instanceof Array) {
            // Special case for file name, see JsonReaderTrace
            result += `(${segment[0]})`;
        } else {
            const wordCharactersOnlyRe = RegExp(/^\w+$/);
            result += "." + (wordCharactersOnlyRe.test(segment) ? segment : JSON.stringify(segment));
        }
    }
    return result;
}


class ReaderInterface {
    async get(path=[], recursive=true) {}
    getView(path=[]) {}
    async dispose(path=[]) {}
}
Object.defineProperties(ReaderInterface, {
    DISPOSED:   {value: Symbol("ReaderInterface.DISPOSED")},
})

class JsonReaderView extends ReaderInterface {
    constructor(jsonReader, path) {
        super();
        Object.defineProperties(this, {
            jsonReader: {value: jsonReader},
            path:       {value: splitPath(path)},
        });
    }
    async get(path=[], recursive=true) {
        path = this.path.concat(splitPath(path));
        return this.jsonReader.get(path)
    }

    getView(path=[]) {
        path = this.path.concat(splitPath(path));
        return new JsonReaderView(this.jsonReader, path);
    }

    async dispose(path=[]) {
        path = this.path.concat(splitPath(path));
        return this.jsonReader.dispose(path)
    }
}

export class JsonReader extends ReaderInterface {
    constructor(url, {readFile}) {
        super();
        Object.defineProperties(this, {
            url:             {value: url},
            readFile:        {value: readFile},
            json:            {value: this, writable: true},
            loadJsonPromise: {value: null, writable: true},
        })
    }

    async _loadJson() {
        const fetchAndParseJsonData = async () => {
            const data = await this.readFile(this.url);

            this.json = JSON.parse(data, (key, value) => {
                const IMPORT_DIRECTIVE_KEY = "@import";
                if (value instanceof Object && !(value instanceof Array) && IMPORT_DIRECTIVE_KEY in value) {
                    const url = new URL(value[IMPORT_DIRECTIVE_KEY], this.url);
                    return new JsonReader(url, {readFile: this.readFile});
                }
                return value;
            });
        }
        // Fetch and parse only once
        if(this.loadJsonPromise == null) {
            this.loadJsonPromise = fetchAndParseJsonData();
        }
        await this.loadJsonPromise;
    }

    /**
     * Returns specified value or subtree. Data will be fetched if needed.
     */
    async get(path=[], recursive=true) {
        path = splitPath(path);
        if(this.json == this) {
            await this._loadJson();
        }
        let result = this.json;
        for (const segment of path) {
            if (!(result instanceof Object))
                throw Error(`${stringifyPath(path)}: object does not exists.`);
            if (result[segment] instanceof ReaderInterface)
                result[segment] = await result[segment].get([], false);
            result = result[segment];
        }
        if (recursive) {
            let pending = [];
            const visit = (node) => {
                if (node instanceof Object) {
                    for (const key of Object.keys(node)) {
                        if (node[key] instanceof ReaderInterface) {
                            pending.push(node[key].get([], true).then((v) => {node[key] = v}));
                        } else {
                            visit(node[key]);
                        }
                    }
                }
            }
            visit(result);
            await Promise.all(pending);
        }
        return result;
    }

    getView(path=[]) {
        path = splitPath(path);
        return new JsonReaderView(this, path);
    }

    /**
     * Dispose object at specified path.
     */
    async dispose(path=[]) {
        path = splitPath(path);
        let container = this;
        let key = "json";
        for (let i = 0; i < path.length; i++) {
            container = container[key];
            key = path[i];
            if (container === ReaderInterface.DISPOSED) {
                console.log(`${stringifyPath(path)}: object ancestor (${stringifyPath(path.slice(0, i))}) already disposed.`);
                return;
            }
            if (container instanceof JsonReader) {
                return;
            }
            if (!(container instanceof Object) || !(key in container)) {
                console.warn(`${stringifyPath(path)}: ${stringifyPath(path.slice(0, i))} does not contain key ${stringifyPath(key)}.`);
                return;
            }
        }
        if (container[key] === ReaderInterface.DISPOSED) {
            console.log(`${stringifyPath(path)}: object already disposed`);
            return;
        }
        container[key] = ReaderInterface.DISPOSED;
    }
}
