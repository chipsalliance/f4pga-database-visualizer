import "./grid-view.scss";
import {Component} from "../component";
import {GridColumnHeader, GridCornerHeader, GridRowHeader} from "./grid-header";
import {GridTile} from "./grid-tile";
import {EqualSymbol} from "../../utils/operators";

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
    }

    setActiveCell(column, row, show=false) {
        const activeCell = ((column === undefined) || (row === undefined)) ? null : new Coordinate(column, row);
        this.update({_activeCell: activeCell});
        if (show && activeCell != null && this.element) {
            const tileElement = this._children.get(column + 1, row + 1).element;
            const scrollX = tileElement.offsetLeft - (this.element.offsetWidth - tileElement.offsetWidth) / 2;
            const scrollY = tileElement.offsetTop - (this.element.offsetHeight - tileElement.offsetHeight) / 2;
            this.element.scrollTo(scrollX, scrollY);
        }
    }

    // Must be called after the element is inserted into the DOM
    recalculateColumnWidth() {
        const oldColumnWidth = this._gridElement.style.getPropertyValue("--column-width");
        if (oldColumnWidth) {
            this._gridElement.style.removeProperty("--column-width");
        }
        // Find widest column width by checking each column header's width
        // FIXME: optimization: create one element with every word from every cell, one word per line, and measure its width
        let columnWidth = 0;
        for (let i = 1; i < this._children.width; i++) {
            const header = this._children.get(i, 0);
            columnWidth = Math.max(columnWidth, header.element.clientWidth);
        }
        if (columnWidth > 0) {
            this._gridElement.style.setProperty("--column-width", `${columnWidth}px`);
        }
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

                this._data.set(cell.column, cell.row, cell.dataId);
            }

            const previousDisplay = this._gridElement.style.display;
            const previousVisibility = this._gridElement.style.visibility;
            this._gridElement.style.display = "none";
            this._gridElement.style.visibility = "hidden";

            this._gridElement.style.setProperty("--cols", model.columnCount);
            this._gridElement.style.setProperty("--rows", model.rowCount);

            this._gridElement.innerHTML = "";
            this._children.forEach((child) => this._gridElement.appendChild(child.build()));

            this._gridElement.style.display = previousDisplay;
            this.recalculateColumnWidth();
            this._gridElement.style.visibility = previousVisibility;
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
