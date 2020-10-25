import {isNumber} from "lodash";

export const EqualSymbol = Symbol("Operators.isEqual");

/**
 * Compares two values or objects using object's equality operator implementation (if possible).
 *
 * Algorithm:
 * - If `a` is an Object and has `[EqualSymbol]` method: return result of `a[EqualSymbol](b)`
 * - If `b` is an Object and has `[EqualSymbol]` method: return result of `b[EqualSymbol](a)`
 * - Return result of SameValueZero comparison (`a === b` is true or both `a` and `b` are NaN)
 */
export function isEqual(a, b) {
    if ((a instanceof Object) && (a[EqualSymbol] instanceof Function))
        return a[EqualSymbol](b);
    if ((b instanceof Object) && (b[EqualSymbol] instanceof Function))
        return b[EqualSymbol](a);
    return ((a === b) || (isNumber(a) && isNumber(b) && isNaN(a) && isNaN(b)))
}
