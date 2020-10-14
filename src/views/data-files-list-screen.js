import MaterialTextField from "../components/material-textfield";
import {MDCTextFieldIcon} from '@material/textfield/icon';
import {elementFromHtml} from "../utils/element-from-html";

require("./overlay.scss");

export default class DataFilesListScreen {
    constructor({title=undefined, dataFilesList=[]}={}) {
        this.title = title;
        this.dataFilesList = dataFilesList;
    }

    async show() {
        return new Promise((resolve) => {
            const body = document.getElementsByTagName("body")[0];
            if (this.title)
                document.title = this.title;

            const overlay = elementFromHtml(`<div class="overlay data-files-list-screen"><h1>${this.title || ""}</h1></div>`);
            const textField = new MaterialTextField({label: "Data file URL"});
            const confirmUrlButton = elementFromHtml(`<i class="material-icons mdc-text-field__icon mdc-text-field__icon--trailing" tabindex="0" role="button">arrow_forward</i>`);
            new MDCTextFieldIcon(confirmUrlButton);
            const confirmUrl = () => {
                const url = textField.inputElement.value;
                if (url)
                    resolve(url);
            };
            confirmUrlButton.addEventListener("click", (event) => {confirmUrl()});
            confirmUrlButton.addEventListener("keydown", (event) => {if (event.keyCode === 13) confirmUrl()});
            textField.inputElement.addEventListener("keydown", (event) => {if (event.keyCode === 13) confirmUrl()});
            textField.inputElement.insertAdjacentElement("afterend", confirmUrlButton);
            overlay.appendChild(textField.element);
            if (this.dataFilesList.length > 0) {
                const ul = document.createElement("ul");
                const clickHandler = (event) => {
                    {resolve(event.target.getAttribute("data-url"))}
                };
                this.dataFilesList.forEach((item) => {
                    const li = document.createElement("li");
                    li.innerText = item["name"];
                    li.setAttribute("data-url", item["url"]);
                    li.addEventListener("click", clickHandler);
                    ul.appendChild(li);
                });
                overlay.appendChild(ul);
            }

            body.innerHTML = "";
            body.classList.add("overlay-visible");
            body.appendChild(overlay);
        });
    }
}
