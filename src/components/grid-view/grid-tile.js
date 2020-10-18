import "./grid-view.scss";
import {Component} from "../component";
import {isFinite} from "lodash";
import {findMostContrastingColor, findNearestPaletteColor, firstColorWithContrast} from "../../utils/colors";

// Number of available .grid-tile.color-* styles
const TILE_COLORS_NUM = 24;

const tileColorCache = {};

function updateStyleProperty(element, property, value) {
    if ((value === undefined) || (value === null)) {
        element.style.removeProperty(property)
    } else {
        element.style.setProperty(property, `${value}`)
    }
}

export class GridTile extends Component {
    constructor(properties) {
        super(properties);
        this._properties = {
            text:    null,
            title:   null,
            color:   null,
            row:     null,
            column:  null,
            width:   1,
            height:  1,
            dataId:  null, // TODO: remove
            active:  false,
            onClick: null,
        };
        this._colorIndex = null;
    }

    get column() { return this._properties.column; }
    get row() { return this._properties.row; }

    _onClick(event) {
        if (this._properties.onClick !== null) {
            this._properties.onClick(this, event)
        }
    }

    _buildElement() {
        const element = document.createElement("div");
        element.classList.add("grid-tile");
        element.addEventListener("click", this._onClick.bind(this));
        return element;
    }
    _updateElement(properties, element) {
        for (const [property, value] of Object.entries(properties)) {
            switch(property) {
                case "text": element.innerText = value || ""; break;
                case "title": element.title = value || ""; break;
                case "color":
                    if (this._colorIndex !== null) {
                        element.classList.remove(`color-${this._colorIndex}`);
                    }
                    if (value === null) {
                        element.style.removeProperty("--bg")
                        element.style.removeProperty("--fg")
                    } else if (isFinite(value)) {
                        this._colorIndex = value % TILE_COLORS_NUM;
                        element.classList.add(`color-${this._colorIndex}`);
                    } else {
                        this._colorIndex = null;
                        if (!(value in tileColorCache)) {
                            const bg = findNearestPaletteColor(value);
                            let fg = firstColorWithContrast(bg, ["#000", "#fff"], 7);
                            if (fg === undefined) {
                                fg = findMostContrastingColor(bg, ["#000", "#fff"]);
                            }
                            tileColorCache[value] = [bg, fg];
                        }
                        const [bg, fg] = tileColorCache[value];
                        element.style.setProperty("--bg", bg)
                        element.style.setProperty("--fg", fg)
                    }
                    break;
                case "row":    updateStyleProperty(element, "--row",    value); break;
                case "column": updateStyleProperty(element, "--column", value); break;
                case "width":  updateStyleProperty(element, "--width",  value); break;
                case "height": updateStyleProperty(element, "--height", value); break;
                case "dataId": element.setAttribute("data-id", value.toString()); break;
                case "active": element.classList.toggle("active", !!value); break;
                case "onClick": break;
            }
        }
    }
};
