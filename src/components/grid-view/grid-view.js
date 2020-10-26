import "./grid-view.scss";
import {Component} from "../component";
import {GridColumnHeader, GridCornerHeader, GridRowHeader} from "./grid-header";
import {GridTile} from "./grid-tile";
import {EqualSymbol, isEqual} from "../../utils/operators";

class TasksSequenceRunner {
    constructor() {
        this.tasksList = [];
        this.cancelRequested = false;
        this.isRunning = false;
        this.taskController = {
            runner: this,
            get cancelRequested() { return (this.runner.cancelRequested || this.runner.tasksList[0].cancelled); }
        };
    }

    runNext() {
        function callback(self) {
            const task = self.tasksList[0];
            if (task === undefined) {
                // No more tasks
                self.isRunning = false;
                self.cancelRequested = false;
                return;
            }
            if (task.cancelled) {
                // Cancelled task, retry with next task
                self.tasksList.shift();
                return callback(self);
            }
            if (task.data) {
                const nextDataItem = task.data.next();
                if (nextDataItem.done) {
                    // No more data for this task, retry with next task
                    self.tasksList.shift();
                    return callback(self);
                }
                task.func(nextDataItem.value, self.taskController);
            } else {
                self.tasksList.shift();
                task.func(self.taskController);
            }
            if (self.cancelRequested) {
                self.isRunning = false;
                self.cancelRequested = false;
                return
            }
            setTimeout(callback, 0, self);
        };
        this.cancelRequested = false;
        setTimeout(callback, 0, this);
    }

    schedule(taskFunc, dataIterator) {
        if (dataIterator instanceof Array) {
            dataIterator = dataIterator.values();
        }
        const task = {
            func: taskFunc,
            data: dataIterator,
            cancelled: false,
        };
        this.tasksList.push(task);

        if (!this.isRunning) {
            this.isRunning = true;
            setTimeout(this.runNext.bind(this), 0);
        }

        return task;
    }

    cancel(task=null) {
        if (!this.isRunning) {
            return;
        }
        if (task) {
            task.cancelled = true;
        } else {
            this.cancelRequested = true;
            this.tasksList = [];
        }
    }
};

class Coordinate extends Array {
    constructor(x, y) {
        super(2);
        this.x = x;
        this.y = y;
    }

    get x() { return this[0]; };
    get y() { return this[1]; };
    set x(v) { this[0] = v; };
    set y(v) { this[1] = v; };

    [EqualSymbol](other) {
        return ((other instanceof Coordinate)
                && (other.x === this.x)
                && (other.y == this.y));
    };
}

// Generates all integer coordinates located inside a rectangle described by topLeft corner and bottomRight corner
function* rectGen(topLeft, bottomRight) {
    let tl = [Math.min(topLeft[0], bottomRight[0]), Math.min(topLeft[1], bottomRight[1])];
    let br = [Math.max(topLeft[0], bottomRight[0]), Math.max(topLeft[1], bottomRight[1])];
    for (let x = tl[0]; x <= br[0]; x++) {
        for (let y = tl[1]; y <= br[1]; y++) {
            yield new Coordinate(x, y);
        }
    }
}

function* multiGen(...generators) {
    for (const generator of generators) {
        yield* generator;
    }
}

class Array2D extends Array {
    constructor(width, height) {
        super();
        Object.defineProperties(this, {
            width:  {value: width},
            height: {value: height},
        });
    }

    get(x, y) { return this[y * this.width + x]; }
    set(x, y, value) { this[y * this.width + x] = value; }
};

export class GridModel {
    get columnCount() { throw ReferenceError("Not implemented"); }
    get rowCount() { throw ReferenceError("Not implemented"); }

    get columnHeaders() { throw ReferenceError("Not implemented"); }
    get rowHeaders() { throw ReferenceError("Not implemented"); }

    *iterCells() { throw ReferenceError("Not implemented"); }
};

export class GridView extends Component {
    constructor(properties) {
        super(properties);
        this._properties = {
            model: null,
            onActiveCellChanged: null,

            _activeCell: null,
        };
        this._children = null;
        this._data = null;
        this._gridElement = null;
        this._tasks = new TasksSequenceRunner();
        this._loadCellsTask = null;
        this._tilesOffset = null;
        this._tilesStride = null;

        this._viewportChangedTimeout = null;
        this._viewportTlTile = null;
        this._viewportBLTile = null;
    }

    setActiveCell(column, row, show=false) {
        const activeCell = ((column === undefined) || (row === undefined)) ? null : new Coordinate(column+1, row+1);
        if (show && activeCell != null && this.element) {
            this._tasks.schedule(this._loadCellsTaskFunc.bind(this), [[activeCell]])
            this._tasks.schedule((controller) => {
                const tileElement = this._children.get(column + 1, row + 1).element;
                const scrollX = tileElement.offsetLeft - (this.element.offsetWidth - tileElement.offsetWidth) / 2;
                const scrollY = tileElement.offsetTop - (this.element.offsetHeight - tileElement.offsetHeight) / 2;
                this.element.scrollTo(scrollX, scrollY);
            });
        }
        this._tasks.schedule((controller) => {
            this.update({_activeCell: activeCell});
        });
    }

    // Returns (column, row) of a tile located at grid's pixel coordinates (x, y)
    _tileAtPoint(x, y) {
        if (this._tilesOffset !== null) {
            let column = Math.floor((x - this._tilesOffset.x) / this._tilesStride.x);
            let row = Math.floor((y - this._tilesOffset.y) / this._tilesStride.y);
            return new Coordinate(column, row);
        } else {
            return null;
        }
    }

    _loadCellsTaskFunc(coordinates, controller) {
        const fragment = document.createDocumentFragment();
        for (const [column, row] of coordinates) {
            if (controller.cancelRequested) {
                break;
            }
            const child = this._children.get(column, row);
            if (!child.element) {
                fragment.appendChild(child.build());
            }
        }
        this._gridElement.appendChild(fragment);
    }

    // Loads tiles located at coordinates from coordIterator
    _loadCells(coordIterator) {
        if (this._loadCellsTask !== null) {
            this._tasks.cancel(this._loadCellsTask);
        }
        this._loadCellsTask = this._tasks.schedule(this._loadCellsTaskFunc.bind(this), [coordIterator])
    }

    _viewportGeometryChanged() {
        if (!this.element) {
            return;
        }
        const x = this.element.scrollLeft;
        const y = this.element.scrollTop;
        const w = this.element.clientWidth;
        const h = this.element.clientHeight;

        const EXTRA_TILES_MARGIN = 8;

        let tl = this._tileAtPoint(x, y);
        let br = this._tileAtPoint(x+w, y+h);
        if (tl && br) {
            tl.x = Math.max(tl.x - EXTRA_TILES_MARGIN, 0) + 1;
            tl.y = Math.max(tl.y - EXTRA_TILES_MARGIN, 0) + 1;
            br.x = Math.min(br.x + EXTRA_TILES_MARGIN, this._children.width-2) + 1;
            br.y = Math.min(br.y + EXTRA_TILES_MARGIN, this._children.height-2) + 1;
        } else {
            tl = new Coordinate(1, 1);
            br = new Coordinate(this._children.width-1, this._children.height-1);
        }

        if (!isEqual(tl, this._viewportTlTile) || !isEqual(br, this._viewportBrTile)) {
            this._loadCells(rectGen(tl, br));

            const oldTl = this._viewportTlTile;
            const oldBr = this._viewportBrTile;

            // Remove invisible elements
            if (oldTl && oldBr) {
                this._tasks.schedule(() => {
                    // Above new
                    for (let y = oldTl.y; y <= Math.min(tl.y-1, oldBr.y); y++) {
                        for (let x = oldTl.x; x <= oldBr.x; x++) {
                            this._children.get(x, y).disposeElement();
                        }
                    }
                    // Below new
                    for (let y = Math.max(br.y+1, oldTl.y); y <= oldBr.y; y++) {
                        for (let x = oldTl.x; x <= oldBr.x; x++) {
                            this._children.get(x, y).disposeElement();
                        }
                    }
                    for (let y = Math.max(tl.y, oldTl.y); y <= Math.min(oldBr.y, br.y); y++) {
                        // Left of new
                        for (let x = oldTl.x; x <= Math.min(tl.x-1, oldBr.x); x++) {
                            this._children.get(x, y).disposeElement();
                        }
                        // Right of new
                        for (let x = Math.max(br.x+1, oldTl.x); x <= oldBr.x; x++) {
                            this._children.get(x, y).disposeElement();
                        }
                    }
                });
            }

            this._viewportTlTile = tl;
            this._viewportBrTile = br;
        }
    }

    _onWindowResized(event) {
        if (this._viewportChangedTimeout !== null) {
            clearTimeout(this._viewportChangedTimeout);
        }
        this._viewportChangedTimeout = setTimeout(()=>this._viewportGeometryChanged(), 0);
    }

    _onScroll(event) {
        if (this._viewportChangedTimeout !== null) {
            clearTimeout(this._viewportChangedTimeout);
        }
        this._viewportChangedTimeout = setTimeout(()=>this._viewportGeometryChanged(), 0);
    }

    _buildElement() {
        const element = document.createElement("div");
        element.classList.add("grid-view");

        window.addEventListener("resize", (event) => this._onWindowResized(event));
        element.addEventListener("scroll", (event) => this._onScroll(event));

        const gridElement = document.createElement("div");
        gridElement.classList.add("grid-view__grid");

        element.appendChild(gridElement);
        this._gridElement = gridElement;

        return element;
    }

    _updateElement(properties, element) {
        const oldProperties = this._properties;
        if ("model" in properties) {
            const model = properties.model;
            this._children = new Array2D(model.columnCount + 1, model.rowCount + 1);
            this._data = new Array2D(model.columnCount, model.rowCount);

            this._children.set(0, 0, new GridCornerHeader());

            const columnHeaders = model.columnHeaders;
            for (let i = 0; i < model.columnCount; i++) {
                this._children.set(i+1, 0, new GridColumnHeader({index: i, text: columnHeaders[i]}));
            }
            const rowHeaders = model.rowHeaders;
            for (let i = 0; i < model.rowCount; i++) {
                this._children.set(0, i+1, new GridRowHeader({index: i, text: rowHeaders[i]}));
            }

            const words = new Set();
            const texts = new Set();
            for (const cell of model.iterCells()) {
                const x = cell.column + 1;
                const y = cell.row + 1;
                this._children.set(x, y, new GridTile({
                    text:   cell.text,
                    title:  cell.title,
                    color:  cell.color,
                    column: cell.column,
                    row:    cell.row,
                    width:  cell.width || 1,
                    height: cell.height || 1,

                    active: false,
                    onClick: (tile, event) => { this.setActiveCell(tile.column, tile.row); },
                }));

                // Assume all digits have equal width
                const sizeMeasurementText = cell.text.replaceAll(/[1-9]/g, '0');
                sizeMeasurementText.split(" ").forEach((v) => words.add(v));
                texts.add(sizeMeasurementText);

                this._data.set(cell.column, cell.row, cell.dataId);
            }

            // Calculate tile size

            const measuringTile = new GridTile({text: [...words].join("\n")});
            measuringTile.build();
            measuringTile.element.style.position = "absolute";
            measuringTile.element.style.left = "-99999px";
            measuringTile.element.style.top = "-99999px";
            measuringTile.element.style.visibility = "hidden";
            this._gridElement.appendChild(measuringTile.element);

            const tileWidth = measuringTile.element.clientWidth;

            measuringTile.element.style.width = `${tileWidth}px`;

            let tileHeight = 0;
            for (const text of texts) {
                measuringTile.update({text: text});
                tileHeight = Math.max(tileHeight, measuringTile.element.clientHeight);
            }

            // Reconfigure and clear grid element

            const previousDisplay = this._gridElement.style.display;
            const previousVisibility = this._gridElement.style.visibility;
            this._gridElement.style.display = "none";
            this._gridElement.style.visibility = "hidden";

            this._gridElement.style.setProperty("--column-width", `${tileWidth}px`);
            this._gridElement.style.setProperty("--row-height", `${tileHeight}px`);

            this._gridElement.style.setProperty("--columns", model.columnCount);
            this._gridElement.style.setProperty("--rows", model.rowCount);

            this._gridElement.innerHTML = "";

            this._gridElement.style.display = previousDisplay;
            this._gridElement.style.visibility = previousVisibility;

            // Show Headers

            this._tasks.schedule(this._loadCellsTaskFunc.bind(this), [multiGen(
                rectGen([0, 0], [this._children.width-1, 0]),
                rectGen([0, 1], [0, this._children.height-1]),
            )]);

            // Calculate cell offset and stride

            const calculateGridGeometry = () => {
                if ((this._children.width >= 3) && (this._children.height >= 3)) {
                    const columnHeader0 = this._children.get(1, 0).element;
                    const rowHeader0 = this._children.get(0, 1).element;
                    const offset = {
                        x: columnHeader0.offsetLeft,
                        y: rowHeader0.offsetTop,
                    };

                    const columnHeader1 = this._children.get(2, 0).element;
                    const rowHeader1 = this._children.get(0, 2).element;
                    const stride = {
                        x: columnHeader1.offsetLeft - offset.x,
                        y: rowHeader1.offsetTop - offset.y,
                    };

                    this._tilesOffset = offset;
                    this._tilesStride = stride;
                } else {
                    this._tilesOffset = null;
                    this._tilesStride = null;
                }
            };
            this._tasks.schedule(calculateGridGeometry);

            // Force view refresh

            this._tasks.schedule(()=>{this._viewportGeometryChanged()});
        }
        if ("_activeCell" in properties) {
            const activeCell = properties._activeCell;
            const oldActiveCell = oldProperties._activeCell;
            const setActive = (coord, active) => {
                if (coord === null) {
                    return;
                }
                const tile = this._children.get(coord.x, coord.y);
                const columnHeader = this._children.get(coord.x, 0);
                const rowHeader = this._children.get(0, coord.y);
                if (tile) {
                    tile.update({active: active});
                }
                columnHeader.update({active: active});
                rowHeader.update({active: active});
            }
            setActive(oldActiveCell, false);
            setActive(activeCell, true);

            const onActiveCellChanged = ("onActiveCellChanged" in properties) ? properties.onActiveCellChanged : oldProperties.onActiveCellChanged;
            if (onActiveCellChanged !== null) {
                if (activeCell !== null) {
                    const dataId = this._data.get(activeCell.x-1, activeCell.y-1);
                    onActiveCellChanged(dataId, activeCell.x-1, activeCell.y-1);
                } else {
                    onActiveCellChanged(null, null, null);
                }
            }
        }
    }
};
