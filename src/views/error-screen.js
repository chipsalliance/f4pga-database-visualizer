require("./overlay.scss");

export default class ErrorScreen {
    constructor({title=undefined, message, type="unknown"}) {
        this.title = title;
        this.message = message;
        this.type = type;
    }

    show() {
        const body = document.getElementsByTagName("body")[0];
        if (this.title)
            document.title = this.title;
        body.innerHTML = `
            <div class="overlay type-${this.type}">
                <h1>Oops...</h1>
                <p>${this.message}</p>
            </div>
        `;
        body.classList.add("overlay-visible");
    }
}
