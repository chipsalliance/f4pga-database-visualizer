import "./grid-view.scss";
import {Component} from "../component";

export class GridHeader extends Component {
    constructor(type, properties) {
        super(properties);
        console.assert([
            GridHeader.TYPE_COLUMN, GridHeader.TYPE_ROW, GridHeader.TYPE_CORNER
        ].includes(type));
        this._properties = {
            active: false,
            text: null,
        };
        this._type = type;
    }

    _buildElement() {
        const element = document.createElement("div");
        element.classList.add("grid-header", `grid-${this._type}-header`);
        return element;
    }

    _updateElement(properties, element) {
        let index = this._properties.index;
        if ("index" in properties) {
            index = this._properties.index;
            element.style.setProperty("--index", properties.index);
        }

        if ("text" in properties) {
            const text = (properties.text !== null) ? properties.text : index.toString();
            element.innerText = text;
        } else if ((this._properties.text === null) && ("index" in properties)) {
            element.innerText = index.toString();
        }

        if ("active" in properties) {
            if (properties.active === true) {
                element.classList.add("active");
            } else {
                element.classList.remove("active");
            }
        }
    }
};
Object.defineProperties(GridHeader, {
    TYPE_COLUMN: {value: "column"},
    TYPE_ROW:    {value: "row"},
    TYPE_CORNER: {value: "corner"},
});

export class GridColumnHeader extends GridHeader {
    constructor({index, text=null}) {
        super(GridHeader.TYPE_COLUMN, {index: index, text: text});
    }
}

export class GridRowHeader extends GridHeader {
    constructor({index, text=null}) {
        super(GridHeader.TYPE_ROW, {index: index, text: text});
    }
}

export class GridCornerHeader extends GridHeader {
    constructor() {
        super(GridHeader.TYPE_CORNER);
    }
}
