import {EqualSymbol} from "./operators";

export class Coordinate extends Array {
    constructor(x, y) {
        super(2);
        this.x = x;
        this.y = y;
    }

    get x() { return this[0]; };
    get y() { return this[1]; };
    set x(v) { this[0] = v; };
    set y(v) { this[1] = v; };

    [EqualSymbol](other) {
        return ((other instanceof Coordinate)
                && (other.x === this.x)
                && (other.y == this.y));
    };
}

export class Size extends Array {
    constructor(width=0, height=0) {
        super(2);
        this.width = width;
        this.height = height;
    }

    get width() { return this[0]; };
    get height() { return this[1]; };
    set width(v) { this[0] = v; };
    set height(v) { this[1] = v; };

    [EqualSymbol](other) {
        return ((other instanceof Coordinate)
                && (other.width === this.width)
                && (other.height == this.height));
    };
}

export class Rect extends Array {
    constructor(x=0, y=0, width=0, height) {
        super(4);
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get x() { return this[0]; };
    get y() { return this[1]; };
    get width() { return this[2]; };
    get height() { return this[3]; };
    set x(v) { this[0] = v; };
    set y(v) { this[1] = v; };
    set width(v) { this[2] = v; };
    set height(v) { this[3] = v; };

    [EqualSymbol](other) {
        return ((other instanceof Rect) && this.every((v, i) => (other[i] === v)));
    };
}
