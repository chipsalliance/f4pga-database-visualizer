import "./minimap.scss";
import {Component} from "./component";
import {Rect, Size} from "../utils/coordinate";
import {isNumber, isString} from "lodash";

// color-* from grid-view.scss
const TILE_COLORS = [
    "#757575", "#E53935", "#FB8C00", "#689F38", "#00ACC1", "#1565C0", "#5E35B1", "#F06292",
    "#9E9E9E", "#E57373", "#FBC02D", "#8BC34A", "#4DD0E1", "#039BE5", "#9575CD", "#F48FB1",
    "#424242", "#B71C1C", "#FF5722", "#2E7D32", "#00838F", "#283593", "#4A148C", "#D81B60",
];

export class Minimap extends Component {
    constructor(properties={size: new Size(0, 0), viewRect: new Rect(0, 0, 0, 0)}) {
        super(properties);
        this._properties = {
            size: null,
            viewRect: null,
            onIndicatorMoved: null,
        };
        this._canvasElement = null;
        this._viewAreaIndicator = null;
    }

    _buildElement() {
        const element = document.createElement("div");
        element.classList.add("minimap");
        element.classList.add("zero-size");

        const canvasElement = document.createElement("canvas");

        const viewAreaIndicator = document.createElement("div");
        viewAreaIndicator.classList.add("minimap__view-area-indicator");
        viewAreaIndicator.classList.add("zero-size");

        const mouseMove = (event) => {
            const canvasRect = canvasElement.getBoundingClientRect();
            const column = (event.clientX - canvasRect.x - this._startX) / 2;
            const row = (event.clientY - canvasRect.y - this._startY) / 2;
            if (this._properties.onIndicatorMoved) {
                this._properties.onIndicatorMoved(column, row);
            }
        };
        const mouseUp = (event) => {
            if (event.button === 0) {
                this._startX = null;
                this._startY = null;
                viewAreaIndicator.classList.toggle("dragging", false);

                document.removeEventListener("mouseup", mouseUp);
                document.removeEventListener("mousemove", mouseMove);
            }
        };
        viewAreaIndicator.addEventListener("mousedown", (event)=>{
            if (event.button === 0) {
                const indicatorRect = viewAreaIndicator.getBoundingClientRect();
                this._startX = event.clientX - indicatorRect.x;
                this._startY = event.clientY - indicatorRect.y;
                viewAreaIndicator.classList.toggle("dragging", true);

                document.addEventListener("mouseup", mouseUp);
                document.addEventListener("mousemove", mouseMove);
            }
        });

        element.appendChild(canvasElement);
        element.appendChild(viewAreaIndicator);
        this._canvasElement = canvasElement;
        this._viewAreaIndicator = viewAreaIndicator;

        return element;
    }

    drawCells(cells) {
        let ctx = this._canvasElement.getContext("2d");
        for (const cell of cells) {
            if (isNumber(cell.color)) {
                ctx.fillStyle = TILE_COLORS[cell.color % TILE_COLORS.length];
                ctx.fillRect(cell.x*2, cell.y*2, cell.width*2 - 0.5, cell.height*2 - 0.5);
            } else if (isString(cell.color)) {
                ctx.fillStyle = cell.color;
                ctx.fillRect(cell.x*2, cell.y*2, cell.width*2 - 0.5, cell.height*2 - 0.5);
            } else {
                ctx.clearRect(cell.x*2, cell.y*2, cell.width*2 - 0.5, cell.height*2 - 0.5)
            }
        }
    }

    _updateElement(properties, element) {
        if ("size" in properties) {
            const hasZeroSize = ((properties.size.width === 0) || (properties.size.height === 0));
            this.element.classList.toggle("zero-size", hasZeroSize);
            this._canvasElement.width = properties.size.width * 2;
            this._canvasElement.height = properties.size.height * 2;
        }
        if ("viewRect" in properties) {
            const hasZeroSize = ((properties.viewRect.width === 0) || (properties.viewRect.height === 0));
            this._viewAreaIndicator.classList.toggle("zero-size", hasZeroSize);
            if (!hasZeroSize) {
                // Rect coordinates and size are specified as a fraction (0.0-1.0) of the grid width and height
                this._viewAreaIndicator.style.setProperty("--x0", properties.viewRect.x);
                this._viewAreaIndicator.style.setProperty("--y0", properties.viewRect.y);
                this._viewAreaIndicator.style.setProperty("--x1", properties.viewRect.x + properties.viewRect.width);
                this._viewAreaIndicator.style.setProperty("--y1", properties.viewRect.y + properties.viewRect.height);
            }
        }
    }
};
