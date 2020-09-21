import "lodash";
import {Parser} from "expr-eval";

//------------------------------------------------------------------------------

class Null {
    valueOf() {
        return null;
    }
};

function jsonPath(obj) {
    var pathParts = [];
    while (obj._jsonParent !== undefined) {
        const key = obj._jsonKey;
        if (Array.isArray(obj._jsonParent)) {
            pathParts.push(`[${key}]`);
        } else {
            pathParts.push("." + (/^\w+$/.test(key) ? key : JSON.stringify(key)));
        }
        obj = obj._jsonParent;
    }
    if (obj._jsonFileName !== undefined)
        pathParts.push(`(${obj._jsonFileName})`);
    return pathParts.reverse().join('');
}

function jsonType(obj) {
    if (obj === undefined) return undefined;
    if (obj === null) return Null;
    if (obj.constructor === Null.prototype.constructor) return Null;
    if (obj.constructor === String.prototype.constructor) return String;
    if (obj.constructor === Number.prototype.constructor) return Number;
    if (obj.constructor === Array.prototype.constructor) return Array;
    if (obj.constructor === Boolean.prototype.constructor) return Boolean;
    if (obj.constructor === Object.prototype.constructor) return Object;
    throw new TypeError("Unknown JSON type");
}

function jsonTypeToString(type) {
    if (type === undefined) return "nothing";
    if (type === Null) return "Null";
    return type.name;
}

class InvalidTypeError extends Error {
    static buildMessage(obj, expected=null) {
        let msg = `${jsonPath(obj)}: invalid type: ${jsonTypeToString(jsonType(obj))}.`;
        if (expected) {
            const expectedStr = expected.map((t) => ((typeof t === "string") ? t : jsonTypeToString(t))).join(", ");
            msg += ` Expected: ${expectedStr}.`;
        }
        return msg;
    }

    static warning(obj, expected=null) {
        console.log(InvalidTypeError.buildMessage(obj, expected));
    }

    constructor(obj, expected=null) {
        super(InvalidTypeError.buildMessage(obj, expected))
    }
}

class InvalidDataError extends Error {
    static buildMessage(what, obj, expected=null, details="") {
        let msg = `${jsonPath(obj)}: invalid ${what}: ${JSON.stringify(obj)}.`;
        if (expected) {
            const expectedStr = expected.map((t) => ((typeof t === "string") ? t : jsonTypeToString(t))).join(", ");
            msg += ` Expected: ${expectedStr}.`;
        }
        if (details)
            msg += ` Details: ${details}.`;
        return msg;
    }

    static warning(what, obj, expected=null, details="") {
        console.log(InvalidDataError.buildMessage(what, obj, expected, details));
    }

    constructor(what, obj, expected=null, details="") {
        super(InvalidDataError.buildMessage(what, obj, expected, details))
    }
}

class MissingValueError extends Error {
    constructor(parentObj, expectedKey) {
        super(`${jsonPath(parentObj)}: missing value: ${JSON.stringify(expectedKey)}.`);
    }
}

//------------------------------------------------------------------------------

class Template {
    constructor(parsedTemplate) {
        // Template can be evaluated to types other than string when it
        // contains only one expression without any text.
        if ((parsedTemplate.length === 3) && !parsedTemplate[0] && !parsedTemplate[2]) {
            Object.defineProperty(this, "_parsedTemplate", {value: [parsedTemplate[1]]});
        } else {
            Object.defineProperty(this, "_parsedTemplate", {value: parsedTemplate});
        }
    }

    evaluate(values={}, errorHandlerCb) {
        if (this._parsedTemplate.length === 1) {
            try {
                return this._parsedTemplate[0].evaluate(values);
            } catch (e) {
                if (errorHandlerCb) {
                    errorHandlerCb(this._parsedTemplate[0], e);
                } else {
                    throw e;
                }
                return null;
            }
        } else {
            let result = ""
            for (let i = 0; i < this._parsedTemplate.length; i++) {
                // even indexes = text; odd = expressions
                if ((i & 1) === 0) {
                    result += this._parsedTemplate[i];
                } else {
                    try {
                        result += this._parsedTemplate[i].evaluate(values);
                    } catch (e) {
                        if (errorHandlerCb) {
                            errorHandlerCb(this._parsedTemplate[i], e);
                        } else {
                            throw e;
                        }
                        result += "?";
                    }
                }
            }
            return result;
        }
    }
}

class TemplateParser {
    constructor() {
        Object.defineProperty(this, "_parser", {
            value: new Parser({
                allowMemberAccess: false,
                operators: {}
            })
        });
        // TODO: limit available functions, operators
        this.consts = this._parser.consts;

        this._parser.functions.replace = function (input, ...searchReplacementPairs) {
            let result = input.toString();
            for (let i = 0; i < searchReplacementPairs.length-1; i+=2) {
                const search = RegExp(searchReplacementPairs[i].toString(), "g");
                const replacement = searchReplacementPairs[i+1].toString();
                result = result.replaceAll(search, replacement);
            }
            return result;
        }
        this._parser.functions.get = function (obj, key, defaultValue=undefined) {
            if (Object.keys(obj).includes(key))
                return obj[key]
            return defaultValue;
        }
    }

    parse(template, errorHandlerCb) {
        const splitRe = RegExp(/({{|}})|{([^}]*)}/);
        // This creates array with following triples:
        // * text (might be empty string)
        // * character escape string (e.g. "{{") or undefined
        // * expression or undefined
        // and one more text item at the end of an array
        const split = template.split(splitRe);
        let result = [];
        let str = "";
        let i;
        for (i = 0; i < split.length - 1; i += 3) {
            const [text, esc, expr] = split.slice(i, i+3);
            str += text;
            if (esc)
                str += esc[1];
            if (expr) {
                try {
                    let parsedExpr = this._parser.parse(expr);
                    result.push(str);
                    result.push(parsedExpr);
                    str = "";
                } catch(e) {
                    if (errorHandlerCb) {
                        errorHandlerCb(template, expr, e);
                    } else {
                        throw e;
                    }
                    str += "?";
                }
            }
        }
        str += split[i]
        result.push(str);

        return new Template(result);
    }
}

//------------------------------------------------------------------------------

function defaultWarningCallback(...args) {
    console.warn(...args);
}

function processDescription(value, warningCallback=defaultWarningCallback) {
    const processIfString = (v, out) => {
        if (matchType(v, {is: String})) {
            out.push(v.valueOf());
            return true;
        }
    }
    const processIfObject = (v, out) => {
        if (matchType(v, {is: Object})) {
            Object.entries(v).forEach(([k, v])=>{
                if (matchType(v, {is: String, Number})) {
                    out.push({key: k, value: v.toString()});
                } else if (matchType(v, {is: Array})) {
                    let list = [];
                    v.forEach((v) => {
                        if (matchType(v, {is: [String, Number]})) {
                            list.push(v.toString());
                        } else {
                            this.warningCallback(v, "Invalid value.");
                        }
                    });
                    out.push({key: k, value: list});
                } else {
                    this.warningCallback(v, "Invalid value.");
                }
            });
            return true;
        }
    }
    const processIfArray = (v, out) => {
        if (matchType(v, {is: Array})) {
            v.forEach((v) => {
                processIfString(v, out) ||
                processIfObject(v, out) ||
                this.warningCallback(v, "Invalid value.");
            });
            return true;
        }
    }

    let result = [];
    processIfString(value, result) ||
    processIfObject(value, result) ||
    processIfArray(value, result) ||
    this.warningCallback(value, "Invalid value.");

    return result;
}

function recursiveValueOf(obj) {
    switch (jsonType(obj)) {
    case Array: {
            let result = Array(obj.length);
            for (let i = 0; i < result.length; i++) {
                result[i] = recursiveValueOf(obj[i]);
            }
            return result
        }
    case Object: {
            let result = {};
            for (const [k, v] of Object.entries(obj)) {
                result[k] = recursiveValueOf(v);
            }
            return result
        }
    default:
        return obj.valueOf();
    }
}


class GridCells {
    constructor(grid, {warningCallback=defaultWarningCallback}={}) {
        Object.defineProperties(this, {
            grid: {value: grid},
            warningCallback: {value: warningCallback},
            dataInitialized: {value: false, writable: true},
        });
    }

    async initData() {
        if (this.data !== undefined)
            return this.data instanceof Promise ? this.data : undefined;
        this.data = new Promise(async (resolve, reject) => {
            let data = {};
            try {
                const cells = await this.grid.reader.get("cells", false);
                if (!matchType(cells, {is: Object})) {
                    throw new Error("Invalid or missing value. Cells must be an object");
                }
                const view = this.grid.reader.getView("cells");

                function deepCopyValueOf(value) {
                    if (value instanceof Array) {
                        return value.map((v)=>deepCopyValueOf(v));
                    } else if (value instanceof Object) {
                        return Object.fromEntries(Object.entries(value).map(([k, v])=>([k, deepCopyValueOf(v)])));
                    } else if ((value === null) || (value === undefined)) {
                        return value;
                    } else {
                        return value.valueOf();
                    }
                }

                // Data is usually large and can reside in a file loaded on demand. Let it load in the background.
                const cellsData = view.get("data").then((cellsData)=>{
                    if (matchType(cellsData, {is: Array})) {
                        const cellsDataCopy = [];
                        cellsData.forEach((cell, index)=>{
                            if (matchType(cell, {is: Array})) {
                                cellsDataCopy.push(deepCopyValueOf(cell))
                            } else {
                                this.warningCallback(`cells.data[${index}]: invalid value.`)
                            }
                        });
                        return cellsDataCopy;
                    } else {
                        throw new Error(`data: Invalid value. Expected array.`);
                    }
                }).catch((e)=>{throw e});

                let fieldOrder = await view.get("fieldOrder");
                if (matchType(fieldOrder, {is: Array})) {
                    fieldOrder = fieldOrder.map((field, index) => {
                        if (matchType(field, {is: String}))
                            return field.valueOf();
                        throw new Error(`fieldOrder[${index}]: Invalid value. Expected string.`);
                    });
                    data.fieldOrder = fieldOrder;
                } else {
                    throw new Error(`fieldOrder: Invalid value. Expected array.`);
                }

                let fieldTemplates = await view.get("fieldTemplates");
                if (matchType(fieldTemplates, {is: Object})) {
                    const errorHandler = function(template, expr, e) {
                        this.warningCallback(`Invalid expression "${expr}" in template "${template}". Details: ${e}`);
                    };
                    const parsedFieldTemplates = {};
                    Object.entries(fieldTemplates).forEach(([field, template]) => {
                        if (matchType(template, {is: String}))
                            parsedFieldTemplates[field] = this.grid.templateParser.parse(template, errorHandler);
                        else
                            throw new Error(`fieldTemplates.${field}: Invalid value. Expected string.`);
                    });
                    data.fieldTemplates = parsedFieldTemplates;
                } else if (fieldTemplates !== undefined) {
                    throw new Error(`fieldTemplates: Invalid value. Expected object.`);
                }

                // Get custom constants/LUTs for use in templates
                // Note: all constants names are turned into upper case
                let templateConsts = await view.get("templateConsts");
                if (matchType(templateConsts, {is: Object})) {
                    data.templateConsts = Object.fromEntries(Object.entries(templateConsts).map(([k, v])=>([k.toUpperCase(), deepCopyValueOf(v)])));
                } else if (templateConsts !== undefined) {
                    throw new Error(`templateConsts: Invalid value. Expected object.`);
                }

                data.data = await cellsData;

                this.data = data;
                this.dataInitialized = true;
                view.dispose();
                resolve();
            } catch (e) {
                this.dataInitialized = false;
                delete this.data;
                reject(e);
            }
        }).catch((e)=>{throw e});
        return this.data instanceof Promise ? this.data : undefined;
    }

    getByIdSync(index) {
        if (!this.dataInitialized) {
            throw new Error("initData() not called or not finished yet.");
        }
        if (index < this.data.data.length && index >= 0) {
            const entry = this.data.data[index];
            const cell = {};
            this.data.fieldOrder.forEach((field, i) => {
                cell[field] = entry[i];
            });
            if (this.data.fieldTemplates) {
                for (const [field, template] of Object.entries(this.data.fieldTemplates)) {
                    cell[field] = template.evaluate({id: index, ...cell, ...this.data.templateConsts});
                }
            }
            if (cell.description)
                cell.description = processDescription(cell.description);
            return cell;
        } else {
            return null;
        }
    }

    *[Symbol.iterator]() {
        if (!this.dataInitialized) {
            throw new Error("initData() not called or not finished yet.");
        }
        for (let i = 0; i < this.data.data.length; i++) {
            yield this.getByIdSync(i);
        }
    }

    async getById(index) {
        if (!this.dataInitialized) {
            await this.initData();
        }
        return this.getByIdSync(index)
    }

    async *[Symbol.asyncIterator]() {
        if (!this.dataInitialized) {
            await this.initData();
        }
        for (let i = 0; i < this.data.data.length; i++) {
            yield this.getByIdSync(i);
        }
    }
}

class Range {
    constructor(first, last=undefined) {
        if (last === undefined) {
            last = first;
            first = 0;
        }
        Object.defineProperties(this, {
            first: {value: first},
            last:  {value: last},
        });
    }

    get length() {
        return Math.abs(this.last - this.first) + 1;
    }

    get(i) {
        return this.first < this.last ? this.first + i : this.first - i;
    }

    indexOf(v) {
        return this.first < this.last ? v - this.first : this.first - v;
    }

    *[Symbol.iterator]() {
        for (let i = 0; i < this.length; i++) {
            yield this.get(i);
        }
    }
}

class Grid {
    constructor(reader, database, {warningCallback=defaultWarningCallback}={}) {
        Object.defineProperties(this, {
            reader: {value: reader},
            database: {value: database},
            warningCallback: {value: warningCallback},
            templateParser: {value: new TemplateParser()},
            data: {writable: true, value: {}},
        });
    }

    // PUBLIC

    async getName() { return this._cachedGetter({path: "name", defaultResult: null, func: (value) => {
        if (matchType(value, {is: String})) {
            return value.valueOf();
        }
        this.warningCallback(value, "Invalid value.");
        return null;
    }})}

    async getColumnsRange() {
        return this._getRange("colsRange");
    }

    async getRowsRange() {
        return this._getRange("rowsRange");
    }

    async getColumnHeaders() {
        const range = await this.getColumnsRange();
        return this._getHeaders("colHeaders", range, "col", "x");
    }

    async getRowHeaders() {
        const range = await this.getRowsRange();
        return this._getHeaders("rowHeaders", range, "row", "y");
    }

    async getCells() {
        const path = "cells";
        if (_.has(this.data, path)) {
            return _.get(this.data, path);
        }
        _.set(this.data, path, new Promise(async (resolve, reject) => {
            try {
                await this._loadParserConstants();
                const view = this.reader.getView(path);
                // Check if path exists
                await view.get([], false);
                const result = new GridCells(this);
                _.set(this.data, path, result);
                resolve(result);
            } catch (e) {
                _.unset(this.data, path);
                reject(e)
            }
        }));
        return _.get(this.data, path);
    }

    // PRIVATE

    async _loadParserConstants() {
        if (!("firstCol" in this.templateParser.consts)) {
            const columnsRange = await this.getColumnsRange();
            const rowsRange = await this.getRowsRange();
            this.templateParser.consts["firstCol"] = columnsRange.first;
            this.templateParser.consts["lastCol"]  = columnsRange.last;
            this.templateParser.consts["colsNum"]  = columnsRange.length;
            this.templateParser.consts["firstRow"] = rowsRange.first;
            this.templateParser.consts["lastRow"]  = rowsRange.last;
            this.templateParser.consts["rowsNum"]  = rowsRange.length;
        }
    }

    async _cachedGetter({path, recursive=true, defaultResult=undefined, func}) {
        if (_.has(this.data, path))
            return _.get(this.data, path);
        _.set(this.data, path, new Promise(async (resolve, reject) => {
            try {
                const value = await this.reader.get(path);
                const result = ((value === undefined) && (defaultResult !== undefined))
                        ? defaultResult
                        : await func(value);
                if (value !== undefined) {
                    this.reader.dispose(path);
                }
                _.set(this.data, path, result);
                resolve(result);
            } catch (e) {
                _.unset(this.data, path);
                reject(e);
            }
        }));
        return _.get(this.data, path);
    }

    async _getRange(path) { return this._cachedGetter({path: path, func: (value) => {
        const processIfNumber = (v, out) => {
            if (matchType(v, {is: Number})) {
                out.push(v.valueOf());
                return true;
            }
        }
        const processIfArray = (v, out) => {
            if (matchType(v, {is: Array})) {
                if (!processIfNumber(v[0], out)) {
                    throw new Error(v[0], "Invalid value.");
                }
                if (!(matchType(v[1], {is: undefined}) || processIfNumber(v[1], out))) {
                    this.warningCallback(v[1], "Invalid value.");
                }
                if (v.length > 2) {
                    this.warningCallback(v, "Too much values in an array. Expected 1 or 2.");
                }
                return true;
            }
        }

        let result = [];
        if (!(processIfNumber(value, result) || processIfArray(value, result))) {
            throw new Error("Invalid or missing value.");
        }

        return new Range(...result);
    }})}

    async _getHeaders(path, range, relIndexVarName, indexVarName) { return this._cachedGetter({path: path, defaultResult: null, func: async (value) => {
        const processIfString = async (v, out) => {
            if (matchType(v, {is: String})) {
                await this._loadParserConstants();
                const errorHandler = function(template, expr, e) {
                    this.warningCallback(`Invalid expression "${expr}" in template "${template}". Details: ${e}`);
                };
                const template = this.templateParser.parse(v, errorHandler);
                let evalErrorHandler = function(expr, e) {
                    this.warningCallback(`Invalid expression "${expr}". Details: ${e}`);
                    // Report only once
                    evalErrorHandler = function(expr, e) {};
                }
                for (let i = 0; i < range.length; i++) {
                    out.push(template.evaluate({[relIndexVarName]: range.get(i), [indexVarName]: i}, evalErrorHandler));
                }
                return true;
            }
        }
        const processIfArray = (v, out) => {
            if (matchType(v, {is: Array})) {
                if (v.length > range.length) {
                    this.warningCallback(`${path}: Invalid array length (${v.length} > ${range.length}).`);
                } else if (v.length < range.length) {
                    throw new Error(`${path}: Invalid array length (${v.length} < ${range.length}).`);
                } else {
                    for (const header of v) {
                        if (matchType(header, {is: [String, Number]})) {
                            out.push(header.toString());
                        } else {
                            out.length = 0; // Clear array
                            this.warningCallback(header, "Invalid value.");
                            break;
                        }
                    }
                }
                return true;
            }
        }

        let result = [];
        await processIfString(value, result) ||
        processIfArray(value, result) ||
        this.warningCallback(value, "Invalid value.");

        return result ? result : null;
    }})}
}

function matchType(v, {is=[], not=[], checkInheritance=false}) {
    is = is instanceof Array ? is : [is];
    not = not instanceof Array ? not : [not];
    const vType = (
        (v === undefined) ? undefined :
        (v === null) ? null :
        v.constructor // gives a class even for primitive types
    );

    return (
        (is.includes(vType) && !(not.includes(vType)))
        || (checkInheritance
                && (is.some((t) => ((t instanceof Function) && (v instanceof t))))
                && !(not.every((t) => !((t instanceof Function) || (v instanceof t)))))
    );
}

export class Database {
    constructor(reader, {warningCallback=defaultWarningCallback}={}) {
        Object.defineProperties(this, {
            reader: {value: reader},
            warningCallback: {value: warningCallback},
            gridListLoaded: {writable: true, value: false},
            data: {writable: true, value: {
                grids: {}
            }},
        });
    }

    // PUBLIC

    async getName() { return this._cachedGetter({path: "name", defaultResult: "", func: (value) => {
        const processIfString = (v, out) => {
            if (matchType(v, {is: String})) {
                out[0] = v;
                return true;
            }
        }

        let result = [""];
        processIfString(value, result) ||
        this.warningCallback(v, "Invalid value.");

        return result[0];
    }})}

    async getVersion() { return this._cachedGetter({path: "version", defaultResult: null, func: (value) => {
        const processIfStringOrNumber = (v, out) => {
            if (matchType(v, {is: [String, Number]})) {
                out[0] = v.toString();
                return true;
            }
        }

        let result = [null];
        processIfStringOrNumber(value, result) ||
        this.warningCallback(v, "Invalid value.");

        return result[0];
    }})}

    async getBuildDate() { return this._cachedGetter({path: "buildDate", defaultResult: null, func: (value) => {
        const processIfStringOrNumber = (v, out) => {
            if (matchType(v, {is: [String, Number]})) {
                let date = new Date(v);
                if (isFinite(date))
                    out[0] = date;
                else
                    this.warningCallback(v, "Invalid date. Expected UNIX timestamp (number) or date in ISO 8601 format (string).");
                return true;
            }
        }

        let result = [null];
        processIfStringOrNumber(value, result) ||
        this.warningCallback(v, "Invalid value.");

        return result[0];
    }})}

    async getBuildSources() { return this._cachedGetter({path: "buildSources", defaultResult: [], func: (value) => {
        const processIfString = (v, out) => {
            if (matchType(v, {is: String})) {
                out.push({text: v, url: null});
                return true;
            }
        }
        const processIfObject = (v, out) => {
            const processPair = ([k, v], out) => {
                if (matchType(v, {is: [String, null]}))
                    out.push({text: k, url: v?v.valueOf():null});
                else
                    this.warningCallback(v, "Invalid value.");
            }
            if (matchType(v, {is: Object})) {
                Object.entries(v).forEach((v)=>processPair(v, out));
                return true;
            }
        }
        const processIfArray = (v, out) => {
            if (matchType(v, {is: Array})) {
                v.forEach((v) => {
                    processIfString(v, out) ||
                    processIfObject(v, out);
                });
                return true;
            }
        }

        let result = [];
        processIfString(value, result) ||
        processIfObject(value, result) ||
        processIfArray(value, result) ||
        this.warningCallback(value, "Invalid value.");

        return result;
    }})}

    async getDescription() { return this._cachedGetter({path: "description", defaultResult: null, func: (value) => {
        return processDescription(value, this.warningCallback);
    }})}

    async getGridsList() {
        // TODO: use promise guard like in cachedgetter
        if (!this.gridListLoaded) {
            const path = "grids";
            const value = await this.reader.get(path, false);

            if (matchType(value, {is: Object})) {
                Object.keys(value).forEach((k)=>{
                    if (!(k in this.data.grids))
                        this.data.grids[k] = undefined;
                });
                this.gridListLoaded = true;
            } else {
                throw new Error(`${path}: Invalid or missing value`);
            }
        }
        return Object.keys(this.data.grids);
    }

    async getGrid(gridId=Database.DEFAULT_GRID_ID) {
        const path = ["grids", gridId];
        // TODO: use promise guard like in cachedgetter
        if (this.data.grids[gridId] === undefined) {
            const value = await this.reader.get(path, false);

            if (matchType(value, {is: Object})) {
                this.data.grids[gridId] = new Grid(this.reader.getView(path), this);
            } else {
                throw new Error(`${path}: Invalid or missing value`);
            }
        }
        return this.data.grids[gridId];
    }

    // PRIVATE

    async _cachedGetter({path, recursive=true, defaultResult=undefined, func}) {
        if (path in this.data)
            return this.data[path];
        this.data[path] = new Promise(async (resolve, reject) => {
            try {
                const value = await this.reader.get(path);
                const result = ((value === undefined) && (defaultResult !== undefined))
                        ? defaultResult
                        : func(value);
                if (value !== undefined) {
                    this.reader.dispose(path);
                }
                this.data[path] = result;
                resolve(result);
            } catch (e) {
                delete this.data[path];
                reject(e);
            }
        });
        return this.data[path];
    }
}
Object.defineProperties(Database, {
    DEFAULT_GRID_ID: {value: ""}
});
