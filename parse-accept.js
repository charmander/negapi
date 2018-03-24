'use strict';

const MediaRange = require('./media-range');

const _isTokenChar = [];
const _isQuotedText = [];
const qvaluePattern = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

// "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
for (let i = 0; i < 127; i++) {
	_isTokenChar.push(/[!#$%&'*+\-.^_`|~0-9A-Za-z]/.test(String.fromCharCode(i)));
}

// qdtext = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text
// obs-text = %x80-FF
for (let i = 0; i < 256; i++) {
	_isQuotedText.push(/[\t\x20\x21\x23-\x5b\x5d-\x7e\x80-\xff]/.test(String.fromCharCode(i)));
}

const isTokenChar = c =>
	c < 127 && _isTokenChar[c];

const isOptionalWhitespace = c =>
	c === 32 || c === 9;

const isQuotedText = c =>
	c < 256 && _isQuotedText[c];

const isQuotedPair = c =>
	// HTAB / SP / VCHAR / obs-text
	(' ' <= c && c <= '\xff' && c !== '\x7f') || c === '\t';

const parseQvalue = value =>
	qvaluePattern.test(value) ?
		parseFloat(value) :
		null;

const parseAccept = header => {
	if (header === '') {
		return [];
	}

	const ranges = [];
	const l = header.length;
	let i = 0;
	let c = header.charCodeAt(0);

	readMediaRange: for (;;) {
		let type;
		let subtype;
		const parameters = new Map();
		let parameterCount = 0;
		let weight = 1;

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
			const typeStart = i;

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
				const subtypeStart = i;

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
			let mediaRangeParameters = true;

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

				const nameStart = i;

				while (++i < l && isTokenChar((c = header.charCodeAt(i)))) {}

				if (c !== 61) {  // =
					return null;
				}

				let name = header.substring(nameStart, i);
				let value;

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
						const quotedFragmentStart = i;

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
							let charString;

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
					const unquotedValueStart = i;

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

						if (parameters.has(name)) {
							return null;
						}

						parameters.set(name, value.toLowerCase());
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
};

module.exports = parseAccept;
