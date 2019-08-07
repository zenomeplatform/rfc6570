/* jshint node:true */

module.exports = UriTemplate


const isArray = Array.isArray;


const operatorOptions = {
    "": {
        prefix: "",
        seperator: ",",
        assignment: false,
        assignEmpty: false,
        encode: percentEncode
    },
    "+": {
        prefix: "",
        seperator: ",",
        assignment: false,
        assignEmpty: false,
        encode: encodeURI
    },
    "#": {
        prefix: "#",
        seperator: ",",
        assignment: false,
        assignEmpty: false,
        encode: encodeURI
    },
    ".": {
        prefix: ".",
        seperator: ".",
        assignment: false,
        assignEmpty: false,
        encode: percentEncode
    },
    "/": {
        prefix: "/",
        seperator: "/",
        assignment: false,
        assignEmpty: false,
        encode: encodeURIComponent
    },
    ";": {
        prefix: ";",
        seperator: ";",
        assignment: true,
        assignEmpty: false,
        encode: encodeURIComponent
    },
    "?": {
        prefix: "?",
        seperator: "&",
        assignment: true,
        assignEmpty: true,
        encode: encodeURIComponent
    },
    "&": {
        prefix: "&",
        seperator: "&",
        assignment: true,
        assignEmpty: true,
        encode: encodeURIComponent
    }
}

/* http://tools.ietf.org/html/rfc6570#section-2.3 */
function isUndefined(value) {
    if (value === null) return true;
    if (value === undefined) return true;
    if (Array.isArray(value) && value.length === 0) return true;

    return false;
}

function isDefined(value) {
    return !isUndefined(value);
}

const unreserved = "-._~";


function percentTransform(ch) {
    var charCode = ch.charCodeAt(0);

    if (charCode >= 0x30 && charCode <= 0x39) return ch;
    if (charCode >= 0x41 && charCode <= 0x5a) return ch;
    if (charCode >= 0x61 && charCode <= 0x7a) return ch;

    if (~unreserved.indexOf(ch)) return ch;

    return '%' + charCode.toString(16).toUpperCase();
}

function applyStringTransform(value, mapper) {
    return value.split("")
                .map(mapper)
                .join('');
}

/* http://tools.ietf.org/html/rfc3986#section-2.3 */
function percentEncode(value) {
    if (isUndefined(value)) return '';
    const string = value.toString()
    return applyStringTransform(
        string, percentTransform)
}

/**
 * The operator characters equals ("="), comma (","), exclamation ("!"),
 * at sign ("@"), and pipe ("|") are reserved for future extensions.
 */
function checkReserved(operator) {
    if (operator && ~'=,!@|'.indexOf(operator)) {
        throw new Error("operator '" + operator + "' is reserved for future extensions");
    }
    return operator
}

var reVariable = /^([\$_a-z][\$_a-z0-9]*)((?:\:[1-9][0-9]?[0-9]?[0-9]?)?)(\*?)$/i;

function variableMapper(variable) {
    var match = reVariable.exec(variable);
    return {
        name: match[1],
        maxLength: match[2] && parseInt(match[2].substring(1), 10),
        composite: !!match[3]
    };
}



/**
 *  http://tools.ietf.org/html/rfc6570#section-2.2
 *	expression    =  "{" [ operator ] variable-list "}"
 *	operator      =  op-level2 / op-level3 / op-reserve
 *	op-level2     =  "+" / "#"
 *	op-level3     =  "." / "/" / ";" / "?" / "&"
 *	op-reserve    =  "=" / "," / "!" / "@" / "|"
 */
function preprocessTemplate(template) {
    const reTemplate = /\{([\+#\.\/;\?&=\,!@\|]?)([A-Za-z0-9_\,\.\:\*]+?)\}/g;

    const pieces = [];
    const glues = [];

    let offset = 0;
    let match;

    while (match = reTemplate.exec(template)) {
        const prefix = template.substring(offset, match.index)
        glues.push(prefix);
        const operator  = checkReserved(match[1]);
        const variables = match[2].split(',').map(variableMapper);
        pieces.push({ operator, variables });
        offset = match.index + match[0].length;
    }

    glues.push(template.substring(offset));

    return { pieces, glues }
}

function getSegmentsOffsets(str, glues) {
    var offset = 0;
    var offsets = [];

    for (let i = 0, length = glues.length; i < length; i++) {
        const glue = glues[i];

        if (i === length - 1 && glue === '') {
            offsets.push(str.length);
            break;
        }

        const index = str.indexOf(glue, offset);
        if (index === -1) throw new Error(null)

        offsets.push(index);
        offset = index + glue.length;
    }

    return offsets
}


function getValuePart(str, pieceIndex, glues, offsets) {
    const offsetBegin = offsets[pieceIndex] + glues[pieceIndex].length;
    const offsetEnd = offsets[pieceIndex + 1];
    const value = str.substring(offsetBegin, offsetEnd);

    return value;
}


function startsWithConsume(string, prefix) {
    if (!string.startsWith(prefix)) throw new Error(null)
    return string.slice(prefix.length)
}

class UriTemplateClass {

    constructor(template) {
        this.data = preprocessTemplate(template)
    }
    

    parse() {
        try {
            return parse.apply(this, arguments);
        } catch (error) {
            return false;
        }
    }

    stringify()  {
        try {
            return stringify.apply(this, arguments);
        } catch (error) {
            return false;
        }
    }
}

class Router {

    constructor() {
        this.routes = [];
    }

    add(template, handler) {
        const compiled = new UriTemplateClass(template)
        this.routes.push({ template: compiled, handler }); //
    }

    handle(url) {
        return this.routes.some(function (route) {
            var data = route.template.parse(url);
            return data && route.handler(data) !== false;
        });
    }

}

function UriTemplate(template) {
    this.data = preprocessTemplate(template)
    this.parse = function() {
        try {
            return parse.apply(this, arguments);
        } catch (error) {
            return false;
        }
    }
    this.stringify = stringify;
}


UriTemplate.UriTemplateClass = UriTemplateClass


function parse (str) {
    const { pieces, glues } = this.data;
    const data = {},  offsets = getSegmentsOffsets(str, glues)

    pieces.forEach(function ({ operator, variables }, pieceIndex) {
        const { prefix, seperator, assignment, assignEmpty } = operatorOptions[operator];

        let value = getValuePart(str, pieceIndex, glues, offsets)
        if (value.length === 0) return true;

        value = startsWithConsume(value, prefix);
        const values = value.split(seperator);

        for (let variableIndex in variables) {
            let variable = variables[variableIndex];
            let value    = values   [variableIndex];
            if (value === undefined) break;

            if (assignment) {
                value = startsWithConsume(value, variable.name)
                if (value.length === 0 && assignEmpty) throw new Error(null)
                if (value.length > 0) {
                    value = startsWithConsume(value, "=")
                }
            }
            data[variable.name] = decodeURIComponent(value);
        }
    })

    return data;
}



function stringify(data = {}) {
    const { pieces, glues } = this.data;
    var str = glues[0];

    function processPart(piece, pieceIndex) {
        const operator = piece.operator
        const variables = piece.variables;
        var o = operatorOptions[operator];

        const parts = variables.map(procVariable).filter(isDefined);

        function procVariable ({ name, composite, maxLength }) {
            var value = data[name];
            if (!isArray(value)) value = [value];
            value = value.filter(isDefined);
            if (isUndefined(value)) return null;

            if (!composite) return processValue(value.map(mapper).join(','), name, o)

            return value.map(function (value) {
                if (typeof value !== 'object') {
                    value = processVal(value, maxLength, o.encode)
                    return processValue(value, name, o);
                }
                const mapper = ([key, val]) => key + '=' + processVal(val, maxLength, o.encode);
                return Object.entries(value).map(mapper).join(o.seperator);
            }).join(o.seperator);
            

            function mapper(value) {
                if (typeof value !== 'object') return processVal(value, maxLength, o.encode);
                const mapper = ([key, val]) => key + ',' + processVal(val, maxLength, o.encode);
                return Object.entries(value).map(mapper).join(',');
            }
            
        }

        if (isDefined(parts)) {
            str += o.prefix + parts.join(o.seperator);
        }
        str += glues[pieceIndex + 1];
    }
    pieces.forEach(processPart)
    return str;
};

Object.assign(UriTemplate, {UriTemplate, UriTemplateClass, Router})


function processVal(value, maxLength, encode) {
    if (maxLength) value = value.substring(0, maxLength);
    return encode(value);
}

function processValue(value, name, options) {
    if (!options.assignment) return value
    if (value) return name + '=' + value;
    if (options.assignEmpty) return name + '='
    return name
}