import "./grid-view.scss";
import {Component} from "../component";
import {GridColumnHeader, GridCornerHeader, GridRowHeader} from "./grid-header";
import {GridTile} from "./grid-tile";
import {isEqual} from "../../utils/operators";
import {Coordinate, Size, Rect} from "../../utils/coordinate";
import {Minimap} from "../minimap";

const EXTRA_TILES_MARGIN = 4;

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
        this._tilesOffset = {x:0, y:0};
        this._tilesStride = {x:0, y:0};

        this._viewportChangedTimeout = null;
        this._viewportTlTile = null;
        this._viewportBrTile = null;

        this._tilesToRemove = []

        this._minimap = new Minimap({onIndicatorMoved: this._minimapIndicatorMoved.bind(this)});
    }

    _minimapIndicatorMoved(column, row) {
        const x = column * this._tilesStride.x - this._tilesOffset.x;
        const y = row * this._tilesStride.y - this._tilesOffset.y;
        this.element.scrollTo(x, y);
    }

    setActiveCell(column, row, show=false) {
        const activeCell = ((column === undefined) || (row === undefined)) ? null : new Coordinate(column, row);
        this._tasks.schedule((controller) => {
            this.update({_activeCell: activeCell});
        });
        if (show && activeCell != null && this.element) {
            this._tasks.schedule((controller) => {
                const x = column * this._tilesStride.x - this.element.offsetWidth/2  + this._tilesOffset.x;
                const y = row    * this._tilesStride.y - this.element.offsetHeight/2 + this._tilesOffset.y;
                this.element.scrollTo(x, y);
            });
        }
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

    _viewportGeometryChanged() {
        if (!this.element) {
            return;
        }
        const x = this.element.scrollLeft;
        const y = this.element.scrollTop;
        const w = this.element.clientWidth;
        const h = this.element.clientHeight;

        let tl = this._tileAtPoint(x, y);
        let br = this._tileAtPoint(x+w, y+h);

        let viewRect = new Rect();
        const gridBr = new Coordinate((this._gridCellsData.width-1), (this._gridCellsData.height-1));

        viewRect.x = x / ((gridBr.x + 1) * this._tilesStride.x);
        viewRect.width = w / ((gridBr.x + 1) * this._tilesStride.x);
        viewRect.y = y / ((gridBr.y + 1) * this._tilesStride.y);
        viewRect.height = h / ((gridBr.y + 1) * this._tilesStride.y);

        this._minimap.update({viewRect: viewRect});

        if (tl && br) {
            tl.x = Math.max(tl.x - EXTRA_TILES_MARGIN, 0);
            tl.y = Math.max(tl.y - EXTRA_TILES_MARGIN, 0);
            br.x = Math.min(br.x + EXTRA_TILES_MARGIN, gridBr.x);
            br.y = Math.min(br.y + EXTRA_TILES_MARGIN, gridBr.y);
        } else {
            tl = new Coordinate(0, 0);
            br = new Coordinate(gridBr.x, gridBr.y);
        }

        let currentView = new Array2D(br.x - tl.x + 1, br.y - tl.y + 1);
        for (let i = this._tileComponents.used.length - 1; i >= 0; i--) {
            let x, y;
            try {
                x = this._tileComponents.used[i].column;
                y = this._tileComponents.used[i].row;
            } catch(e) {
                throw (e);
            }
            if ((x >= tl.x) && (x <= br.x) && (y >= tl.y) && (y <= br.y)) {
                currentView.set(x - tl.x, y - tl.y, this._tileComponents.used[i]);
            } else {
                let itm = this._tileComponents.used.splice(i, 1)[0];
                this._tileComponents.free.push(itm);
            }
        }

        for (let x = 0; x < currentView.width; x++) {
            for (let y = 0; y < currentView.height; y++) {
                if (!currentView.get(x, y)) {
                    const cellData = this._gridCellsData.get(tl.x + x, tl.y + y);
                    if (!cellData) {
                        continue
                    }
                    const tile = this._tileComponents.free.shift();
                    tile.update({
                        text:   cellData.text,
                        title:  cellData.title,
                        color:  cellData.color,
                        column: cellData.column,
                        row:    cellData.row,
                        width:  cellData.width,
                        height: cellData.height,
                        active: !!(cellData.active),
                    })
                    if (!tile.element) {
                        this._gridElement.appendChild(tile.build());
                    }
                    this._tileComponents.used.push(tile);
                }
            }
        }
    }

    _onWindowResized(event) {
        if (this._viewportChangedTimeout !== null) {
            clearTimeout(this._viewportChangedTimeout);
        }

        let maxLoadedColumnCount = 1;
        let maxLoadedRowCount = 1;
        if (this._tilesStride.x) {
            const w = this.element.clientWidth;
            maxLoadedColumnCount = Math.ceil(w / this._tilesStride.x) + 1 + 2*EXTRA_TILES_MARGIN;
        }
        if (this._tilesStride.y) {
            const h = this.element.clientHeight;
            maxLoadedRowCount = Math.ceil(h / this._tilesStride.y) + 1 + 2*EXTRA_TILES_MARGIN;
        }
        this._tileComponents.setCapacity(maxLoadedColumnCount * maxLoadedRowCount);

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

        window.addEventListener("resize", (event) => this._onWindowResized(event), {passive: true});
        element.addEventListener("scroll", (event) => this._onScroll(event), {passive: true});

        const gridElement = document.createElement("div");
        gridElement.classList.add("grid-view__grid");

        element.appendChild(gridElement);
        element.appendChild(this._minimap.build());
        this._gridElement = gridElement;

        return element;
    }

    _updateElement(properties, element) {
        const oldProperties = this._properties;
        if ("model" in properties) {
            const model = properties.model;
            this._gridCellsData = new Array2D(model.columnCount, model.rowCount)

            this._minimap.update({size: new Size(model.columnCount, model.rowCount)});

            this._columnHeaderComponents = [];
            this._rowHeaderComponents = [];
            const createDefaultTile = () => {
                return new GridTile({
                    onClick: (tile, event) => { this.setActiveCell(tile.column, tile.row); },
                });
            };
            this._tileComponents = {
                used: [],
                free: [],

                capacity: function() {
                    return this.used.length + this.free.length;
                },

                setCapacity: function(newCapacity) {
                    const MAX_OVERCAPACITY = 50;
                    const sizeDiff = newCapacity - this.capacity();
                    if (sizeDiff > 0) {
                        for (let i = 0; i < newCapacity; i++) {
                            this.free.push(createDefaultTile());
                        }
                    } else if (sizeDiff < -MAX_OVERCAPACITY) {
                        const removeCount = Math.min(-sizeDiff, this.free.length);
                        for (let i = 0; i < removeCount; i++) {
                            const index = this.free.length - i - 1;
                            if (this.free[index] && this.free[index].element) {
                                this.free[index].element.remove();
                            }
                        }
                        this.free.length -= removeCount;
                    }
                }
            };

            // Iterate and process cell data from model

            const words = new Set();
            const texts = new Set();
            for (const cell of model.iterCells()) {
                this._gridCellsData.set(cell.column, cell.row, cell)

                this._minimap.drawCells([{
                    x: cell.column, y: cell.row,
                    width: cell.width, height: cell.height,
                    color: cell.color
                }]);

                // Assume all digits have equal width
                const sizeMeasurementText = cell.text.replaceAll(/[1-9]/g, '0');
                sizeMeasurementText.split(" ").forEach((v) => words.add(v));
                texts.add(sizeMeasurementText);
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
            measuringTile.element.remove();

            // Configure and clear grid element

            {
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
            }

            // Create components for headers

            const columnHeaders = model.columnHeaders;
            for (let i = 0; i < model.columnCount; i++) {
                this._columnHeaderComponents.push(new GridColumnHeader({index: i, text: columnHeaders[i]}));
                // this._children.set(i+1, 0, new GridColumnHeader({index: i, text: columnHeaders[i]}));
            }
            const rowHeaders = model.rowHeaders;
            for (let i = 0; i < model.rowCount; i++) {
                this._rowHeaderComponents.push(new GridRowHeader({index: i, text: rowHeaders[i]}));
                // this._children.set(0, i+1, new GridRowHeader({index: i, text: rowHeaders[i]}));
            }

            // Schedule header components rendering

            this._tasks.schedule(() => {
                const fragment = document.createDocumentFragment();
                const cornerHeader = new GridCornerHeader();
                fragment.appendChild(cornerHeader.build());
                for (const header of this._columnHeaderComponents) {
                    fragment.appendChild(header.build());
                }
                for (const header of this._rowHeaderComponents) {
                    fragment.appendChild(header.build());
                }
                this._gridElement.appendChild(fragment);
            });

            // Schedule cell offset and stride calculation

            this._tasks.schedule(() => {
                const offset = {x: 0, y: 0};
                const stride = {x: 0, y: 0};

                if (this._columnHeaderComponents.length > 0) {
                    const header0 = this._columnHeaderComponents[0].element;
                    offset.x = header0.offsetLeft;
                    if (this._columnHeaderComponents.length > 1) {
                        const header1 = this._columnHeaderComponents[1].element;
                        stride.x = header1.offsetLeft - offset.x;
                    }
                }

                if (this._rowHeaderComponents.length > 0) {
                    const header0 = this._rowHeaderComponents[0].element;
                    offset.y = header0.offsetTop;
                    if (this._rowHeaderComponents.length > 1) {
                        const header1 = this._rowHeaderComponents[1].element;
                        stride.y = header1.offsetTop - offset.y;
                    }
                }

                this._tilesOffset = offset;
                this._tilesStride = stride;
            });

            // Schedule view init

            this._tasks.schedule(() => {
                this._onWindowResized();
                this._onScroll();
            });
        }
        if ("_activeCell" in properties) {
            const activeCell = properties._activeCell;
            const oldActiveCell = oldProperties._activeCell;
            const setActive = (coord, active) => {
                if (coord === null) {
                    return;
                }
                const data = this._gridCellsData.get(coord.x, coord.y)
                if (!data) {
                    return;
                }
                data.active = active;
                const tile = this._tileComponents.used.find((o) => (o && o.column == coord.x && o.row == coord.y));
                const columnHeader = this._columnHeaderComponents[coord.x];
                const rowHeader = this._rowHeaderComponents[coord.y];
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
                    const dataId = this._gridCellsData.get(activeCell.x, activeCell.y).dataId;
                    onActiveCellChanged(dataId, activeCell.x, activeCell.y);
                } else {
                    onActiveCellChanged(null, null, null);
                }
            }
        }
    }
};
