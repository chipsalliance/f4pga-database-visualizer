export class XHRError extends Error {
    constructor(req) {
        super(`${req.status}: ${req.statusText}`);
        this.name = "XHRError";
        this.status = req.status;
        this.statusText = req.statusText;
    }
}

export async function readFileXHR(url) {
    function request(url) {
        return new Promise((resolve, reject) => {
            let req = new XMLHttpRequest();
            req.overrideMimeType("application/json");
            req.open('GET', url, true);
            req.onload = function() {
                if (req.status === 0 || (req.status >= 200 && req.status < 400)) {
                    resolve(req.responseText);
                } else {
                    reject(new XHRError(req));
                }
            }
            req.onerror = function () { reject(new XHRError(req)); }
            req.send(null);
        });
    }
    return request(url);
}
