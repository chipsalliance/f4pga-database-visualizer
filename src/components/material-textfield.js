require("./material-textfield.scss");

import "lodash";
import {MDCTextField} from '@material/textfield';
import {elementFromHtml} from "../utils/element-from-html";

let nextId = 0;

export default class MaterialTextField {
    constructor({label}) {
        this.label = label;
        this._createElements();
    }

    _createElements() {
        const id = nextId++;
        this._element = elementFromHtml(`
            <label class="mdc-text-field mdc-text-field--outlined">
                <input type="text" class="mdc-text-field__input" aria-labelledby="material-textfield-${id}-label">
                <span class="mdc-notched-outline">
                    <span class="mdc-notched-outline__leading"></span>
                    <span class="mdc-notched-outline__notch">
                    <span class="mdc-floating-label" id="material-textfield-${id}-label">${_.escape(this.label)}</span>
                    </span>
                    <span class="mdc-notched-outline__trailing"></span>
                </span>
            </label>
        `);
        this._mdc = new MDCTextField(this._element);
    }

    destroy() {
        this._mdc.destroy();
        this._mdc = undefined;
        this._element = undefined;
    }

    get element() {
        return this._element;
    }

    get inputElement() {
        return this._element.getElementsByTagName("input")[0]
    }
}
