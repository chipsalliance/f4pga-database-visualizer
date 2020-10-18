import {isEqual} from "../utils/operators";

export class Component {
    // Methods for subclass to implement

    _buildElement() { throw new Error("Method must be implemented in a subclass."); }
    _updateElement(changedProperties, element) {}

    // Public API

    constructor(properties={}) {
        this._element = null;
        this._properties = {};
        this._initialProperties = properties;
    }

    get element() { return this._element; }

    build() {
        console.assert(this._element === null);
        this._element = this._buildElement();
        this.update(this._initialProperties);
        delete this._initialProperties;
        return this._element;
    }

    update(properties={}) {
        let changedProperties = {};
        if (this.element) {
            for (const [property, value] of Object.entries(properties)) {
                const oldValue = this._properties[property];
                if ((value !== undefined) && !isEqual(value, oldValue)) {
                    changedProperties[property] = value;
                }
            }
            this._updateElement(changedProperties, this._element);
        } else {
            changedProperties = properties;
        }
        for (const [property, value] of Object.entries(changedProperties)) {
            this._properties[property] = value;
        }
    }
}
