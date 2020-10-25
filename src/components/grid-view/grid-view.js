import "./grid-view.scss";
import {Component} from "../component";
import {GridColumnHeader, GridCornerHeader, GridRowHeader} from "./grid-header";
import {GridTile} from "./grid-tile";
import {EqualSymbol} from "../../utils/operators";

class TasksSequenceRunner {
    constructor() {
        this.tasksList = [];
        this.cancelRequested = false;
        this.isRunning = false;
    }

    runNext() {
        function callback(self) {
            const task = self.tasksList[0];
            if (task === undefined) {
                self.isRunning = false;
                self.cancelRequested = false;
                return;
            }
            if (task.data) {
                const nextDataItem = task.data.next();
                if (nextDataItem.done) {
                    // No more data for this task, retry with next task
                    self.tasksList.shift();
                    return callback(self);
                }
                task.func(nextDataItem.value, self);
            } else {
                task.func(self);
            }
            setTimeout(callback, 0, self);
        };
        setTimeout(callback, 0, this);
    }

    scheduleTasks(taskFunc, dataIterator) {
        if (dataIterator instanceof Array) {
            dataIterator = dataIterator.values();
        }
        const task = {
            func: taskFunc,
            data: dataIterator,
        };
        this.tasksList.push(task);

        if (!this.isRunning) {
            this.isRunning = true;
            setTimeout(this.runNext.bind(this), 0);
        }
    }

    cancel() {
        this.cancelRequested = true;
        this.tasksList = [];
    }
}

class Coordinate {
    constructor(column, row) {
        this.column = column;
        this.row = row;
    }

    [EqualSymbol](other) {
        return ((other instanceof Coordinate)
                && (other.column === this.column)
                && (other.row == this.row));
    };
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
    }

    setActiveCell(column, row, show=false) {
        this._tasks.scheduleTasks((runner) => {
            const activeCell = ((column === undefined) || (row === undefined)) ? null : new Coordinate(column, row);
            this.update({_activeCell: activeCell});
            if (show && activeCell != null && this.element) {
                const tileElement = this._children.get(column + 1, row + 1).element;
                const scrollX = tileElement.offsetLeft - (this.element.offsetWidth - tileElement.offsetWidth) / 2;
                const scrollY = tileElement.offsetTop - (this.element.offsetHeight - tileElement.offsetHeight) / 2;
                this.element.scrollTo(scrollX, scrollY);
            }
        });
    }

    _buildElement() {
        const element = document.createElement("div");
        element.classList.add("grid-view");

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

            // Schedule cells generation

            function* rectGen(a, b) {
                let tl = [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
                let br = [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
                for (let x = tl[0]; x <= br[0]; x++) {
                    for (let y = tl[1]; y <= br[1]; y++) {
                        yield [x, y];
                    }
                }
            }

            function* multiGen(...generators) {
                for (const generator of generators) {
                    yield* generator;
                }
            }

            const showChunk = (coordinates, runner) => {
                const fragment = document.createDocumentFragment();
                for (const [column, row] of coordinates) {
                    if (runner.cancelRequested) {
                        break;
                    }
                    const child = this._children.get(column, row);
                    if (!child.element) {
                        fragment.appendChild(child.build());
                    }
                }
                this._gridElement.appendChild(fragment);
            }

            // Headers

            this._tasks.scheduleTasks(showChunk, [multiGen(
                rectGen([0, 0], [this._children.width-1, 0]),
                rectGen([0, 1], [0, this._children.height-1]),
            )]);

            // Tiles

            function *gridChunkGenerator(columnCount, rowCount) {
                const CHUNK_SIZE = 16;
                for (let row = 1; row < rowCount; row+=CHUNK_SIZE) {
                    for (let column = 1; column < columnCount; column+=CHUNK_SIZE) {
                        const lastColumn = Math.min(column+CHUNK_SIZE-1, columnCount-1);
                        const lastRow = Math.min(row+CHUNK_SIZE-1, rowCount-1);
                        yield rectGen([column, row], [lastColumn, lastRow]);
                    }
                }
            }
            this._tasks.scheduleTasks(showChunk, gridChunkGenerator(this._children.width, this._children.height));
        }
        if ("_activeCell" in properties) {
            const activeCell = properties._activeCell;
            const oldActiveCell = oldProperties._activeCell;
            const setActive = (coord, active) => {
                if (coord === null) {
                    return;
                }
                const tile = this._children.get(coord.column + 1, coord.row + 1);
                const columnHeader = this._children.get(coord.column + 1, 0);
                const rowHeader = this._children.get(0, coord.row + 1);
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
                    const dataId = this._data.get(activeCell.column, activeCell.row);
                    onActiveCellChanged(dataId, activeCell.column, activeCell.row);
                } else {
                    onActiveCellChanged(null, null, null);
                }
            }
        }
    }
};
