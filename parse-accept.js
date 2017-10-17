'use strict';

var MediaRange = require('./media-range');

var _isTokenChar = [];
var _isQuotedText = [];
var qvaluePattern = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

(function () {
	var i;

	// "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
	for (i = 0; i < 127; i++) {
		_isTokenChar.push(/[!#$%&'*+\-.^_`|~0-9A-Za-z]/.test(String.fromCharCode(i)));
	}

	// qdtext = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text
	// obs-text = %x80-FF
	for (i = 0; i < 256; i++) {
		_isQuotedText.push(/[\t\x20\x21\x23-\x5b\x5d-\x7e\x80-\xff]/.test(String.fromCharCode(i)));
	}
})();

function isTokenChar(c) {
	return c < 127 && _isTokenChar[c];
}

function isOptionalWhitespace(c) {
	return c === 32 || c === 9;
}

function isQuotedText(c) {
	return c < 256 && _isQuotedText[c];
}

function isQuotedPair(c) {
	// HTAB / SP / VCHAR / obs-text
	return (' ' <= c && c <= '\xff' && c !== '\x7f') || c === '\t';
}

function parseQvalue(value) {
	return qvaluePattern.test(value) ?
		parseFloat(value) :
		null;
}

function parseAccept(header) {
	if (header === '') {
		return [];
	}

	var i = 0;
	var ranges = [];
	var l = header.length;
	var c = header.charCodeAt(0);

	readMediaRange: for (;;) {
		var type;
		var subtype;
		var parameters = Object.create(null);
		var parameterCount = 0;
		var weight = 1;

		// Skip commas as necessary to satisfy RFC 7230
		// “For compatibility with legacy list rules, a recipient MUST parse and ignore a reasonable number of empty list elements”
		if (c === 44) {  // ,
			do {
				if (++i === l) {
					break readMediaRange;
				}

				c = header.charCodeAt(i);
			} while (c === 44 || isOptionalWhitespace(c));  // ,
		}

		// Parse a media-range
		if (c === 42) {  // *
			if (header.substr(i + 1, 2) !== '/*') {
				return null;
			}

			type = subtype = '*';
			i += 3;
		} else if (isTokenChar(c)) {
			// Parse a type
			var typeStart = i;

			while (++i < l && isTokenChar((c = header.charCodeAt(i)))) {}

			if (c !== 47) {  // /
				return null;
			}

			type = header.substring(typeStart, i);

			if (++i === l) {
				return null;
			}

			c = header.charCodeAt(i);

			if (c === 42) {  // *
				subtype = '*';
				i++;
			} else if (isTokenChar(c)) {
				// Parse a subtype
				var subtypeStart = i;

				while (++i < l && isTokenChar(header.charCodeAt(i))) {}

				subtype = header.substring(subtypeStart, i);
			} else {
				return null;
			}
		} else {
			return null;
		}

		if (i === l) {
			ranges.push(new MediaRange(type, subtype, parameters, parameterCount, weight));
			break;
		}

		c = header.charCodeAt(i);

		// Skip optional whitespace
		while (isOptionalWhitespace(c)) {
			if (++i === l) {
				// Node doesn’t ignore trailing whitespace in headers
				ranges.push(new MediaRange(type, subtype, parameters, parameterCount, weight));
				break readMediaRange;
			}

			c = header.charCodeAt(i);
		}

		if (c === 59) {  // ;
			var mediaRangeParameters = true;

			do {
				// Skip optional whitespace
				do {
					if (++i === l) {
						return null;
					}
				} while (isOptionalWhitespace((c = header.charCodeAt(i))));

				// Read parameter name
				if (!isTokenChar(c)) {
					return null;
				}

				var nameStart = i;

				while (++i < l && isTokenChar((c = header.charCodeAt(i)))) {}

				if (c !== 61) {  // =
					return null;
				}

				var name = header.substring(nameStart, i);
				var value;

				if (++i === l) {
					return null;
				}

				c = header.charCodeAt(i);

				if (c === 34) {  // "
					// Parse a quoted value
					if (++i === l) {
						return null;
					}

					value = '';

					for (;;) {
						var quotedFragmentStart = i;

						while (isQuotedText((c = header.charCodeAt(i)))) {
							if (++i === l) {
								return null;
							}
						}

						if (c === 34) {  // "
							value += header.substring(quotedFragmentStart, i);
							i++;
							break;
						} else if (c === 92) {  // \
							value += header.substring(quotedFragmentStart, i);
							var charString;

							if (++i === l || !isQuotedPair((charString = header.charAt(i)))) {
								return null;
							}

							value += charString;

							if (++i === l) {
								return null;
							}
						} else {
							return null;
						}
					}
				} else if (isTokenChar(c)) {
					// Parse an unquoted value
					var unquotedValueStart = i;

					while (++i < l && isTokenChar((c = header.charCodeAt(i)))) {}

					value = header.substring(unquotedValueStart, i);
				} else {
					return null;
				}

				if (mediaRangeParameters) {
					if (name === 'q' || name === 'Q') {
						mediaRangeParameters = false;

						weight = parseQvalue(value);

						if (weight === null) {
							return null;
						}
					} else {
						name = name.toLowerCase();

						if (name in parameters) {
							return null;
						}

						parameters[name] = value.toLowerCase();
						parameterCount++;
					}
				}

				if (i === l) {
					ranges.push(new MediaRange(type, subtype, parameters, parameterCount, weight));
					break readMediaRange;
				}

				c = header.charCodeAt(i);

				// Skip optional whitespace
				while (isOptionalWhitespace(c)) {
					if (++i === l) {
						ranges.push(new MediaRange(type, subtype, parameters, parameterCount, weight));
						break readMediaRange;
					}

					c = header.charCodeAt(i);
				}
			} while (c === 59);
		}

		if (c !== 44) {  // ,
			return null;
		}

		ranges.push(new MediaRange(type, subtype, parameters, parameterCount, weight));

		// Skip optional whitespace
		do {
			if (++i === l) {
				break readMediaRange;
			}
		} while (isOptionalWhitespace((c = header.charCodeAt(i))));
	}

	return ranges;
}

module.exports = parseAccept;
