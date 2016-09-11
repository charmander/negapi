'use strict';

var sort = require('./sort');

function isNull(x) {
	return x === null;
}

function hasNonOptionalWhitespace(s) {
	return /[^\t ]/.test(s);
}

function getName(parameter) {
	return parameter.name;
}

function getSpecificity(range) {
	return range.specificity;
}

function mergeSortedSet(a, b) {
	var result = [];
	var ai = 0;
	var bi = 0;
	var ac = a[0];
	var bc = b[0];

	while (ai < a.length && bi < b.length) {
		if (ac < bc) {
			result.push(ac);
			ac = a[++ai];
		} else if (ac > bc) {
			result.push(bc);
			bc = b[++bi];
		} else {
			result.push(ac);
			ac = a[++ai];
			bc = b[++bi];
		}
	}

	while (ai < a.length) {
		result.push(a[ai]);
		ai++;
	}

	while (bi < b.length) {
		result.push(b[bi]);
		bi++;
	}

	return result;
}

function Parameter(name, value) {
	this.name = name.toLowerCase();
	this.value = value.toLowerCase();
}

function MediaType(type, subtype, parameters) {
	var parameterList = [];
	var parameterMap = Object.create(null);

	for (var name in parameters) {
		var parameter = new Parameter(name, parameters[name]);

		parameterList.push(parameter);
		parameterMap[parameter.name] = parameter.value;
	}

	Object.defineProperty(this, 'type', {
		configurable: true,
		value: type.toLowerCase(),
	});

	Object.defineProperty(this, 'subtype', {
		configurable: true,
		value: subtype.toLowerCase(),
	});

	Object.defineProperty(this, 'parameters', {
		configurable: true,
		value: parameterList,
	});

	Object.defineProperty(this, '_parameterMap', {
		configurable: true,
		value: parameterMap,
	});
}

Object.defineProperty(MediaType.prototype, 'get', {
	configurable: true,
	writable: true,
	value: function (name) {
		var value = this._parameterMap[name.toLowerCase()];

		return value === undefined ?
			null :
			value;
	},
});

function MediaRange(type, subtype, parameters, weight) {
	this.type = type.toLowerCase();
	this.subtype = subtype.toLowerCase();
	this.parameters = parameters;
	this.weight = weight;
}

Object.defineProperty(MediaRange.prototype, 'specificity', {
	configurable: true,
	get: function () {
		var typeSpecificity =
			this.subtype !== '*' ? 2 :
			this.type !== '*' ? 1 :
			0;

		return typeSpecificity + this.parameters.length;
	},
});

function MediaTypeSet(types) {
	this._ranges = Object.create(null);
	this._sortedParameterNames = [];
	this._parameterNames = new Set();
	this.types = [];
	types.forEach(this.append, this);
}

Object.defineProperty(MediaTypeSet.prototype, 'append', {
	configurable: true,
	writable: true,
	value: function (mediaType) {
		var type = mediaType.type;
		var subtype = mediaType.subtype;
		var parameters = sort.byUnique(mediaType.parameters, getName);
		var ranges = this._ranges;

		if (parameters.length >= 32) {
			throw new RangeError('Parameter count must be less than 32');
		}

		var subsetCount = 1 << parameters.length;

		for (var s = 0; s < 3; s++) {
			for (var i = 0; i < subsetCount; i++) {
				var key = type + '\0' + subtype;

				for (var b = 0; b < parameters.length; b++) {
					if (i & (1 << b)) {
						var parameter = parameters[b];
						key += '\0' + parameter.name + '\0' + parameter.value;
					}
				}

				if (key in ranges) {
					ranges[key].push(mediaType);
				} else {
					ranges[key] = [mediaType];
				}
			}

			if (s === 0) {
				subtype = '*';
			} else if (s === 1) {
				type = '*';
			}
		}

		var parameterNames = parameters.map(getName);

		this.types.push(mediaType);
		this._sortedParameterNames = mergeSortedSet(
			this._sortedParameterNames,
			parameterNames
		);

		parameterNames.forEach(this._parameterNames.add, this._parameterNames);
	},
});

Object.defineProperty(MediaTypeSet.prototype, 'matches', {
	configurable: true,
	writable: true,
	value: function (range) {
		if (range.parameters.length >= 32) {
			return [];
		}

		var parameters = range.parameters;
		var parameterMap = Object.create(null);
		var parameterNames = this._parameterNames;
		var i;

		for (i = 0; i < parameters.length; i++) {
			var parameter = parameters[i];

			if (!parameterNames.has(parameter.name)) {
				return [];
			}

			parameterMap[parameter.name] = parameter.value;
		}

		var sortedParameterNames = this._sortedParameterNames;
		var key = range.type + '\0' + range.subtype;

		for (i = 0; i < sortedParameterNames.length; i++) {
			var parameterName = sortedParameterNames[i];

			if (parameterName in parameterMap) {
				key += '\0' + parameterName + '\0' + parameterMap[parameterName];
			}
		}

		return this._ranges[key] || [];
	},
});

function parseTypeParameter(typeParameter) {
	var match = typeParameter.match(/^[\t ]*([!#$%&'*+\-.^_`|~0-9A-Za-z]+)=(?:([!#$%&'*+\-.^_`|~0-9A-Za-z]+)|"((?:[\t !\x23-\x5b\x5d-\x7e]|\\[\t -~])*)")[\t ]*$/);

	if (match === null) {
		return null;
	}

	var name = match[1];
	var value = match[2];

	if (value === undefined) {
		value = match[3].replace(/\\(.)/g, '$1');
	}

	return new Parameter(name, value);
}

function parseAcceptRange(range) {
	var parts = range.split(';');
	var match = parts[0].match(/^[\t ]*(\*(?=\/\*)|[!#$%&'+\-.^_`|~0-9A-Za-z]+)\/(\*|[!#$%&'+\-.^_`|~0-9A-Za-z]+)[\t ]*$/);

	if (match === null) {
		return null;
	}

	var type = match[1].toLowerCase();
	var subtype = match[2].toLowerCase();
	var parameters = [];
	var parameterMap = Object.create(null);
	var weight = 1;

	for (var i = 1; i < parts.length; i++) {
		var parameter = parseTypeParameter(parts[i]);

		if (parameter === null) {
			return null;
		}

		if (parameter.name === 'q') {
			weight = parseFloat(parameter.value);

			if (!(weight >= 0 && weight <= 1)) {
				weight = 1;
			}

			break;
		}

		if (parameter.name in parameterMap) {
			if (parameterMap[parameter.name] !== parameter.value) {
				return null;
			}
		} else {
			parameters.push(parameter);
			parameterMap[parameter.name] = parameter.value;
		}
	}

	return new MediaRange(type, subtype, parameters, weight);
}

function parseAccept(accept) {
	var ranges = accept.split(',')
		.filter(hasNonOptionalWhitespace)
		.map(parseAcceptRange);

	return ranges.length === 0 || ranges.some(isNull) ?
		null :
		ranges;
}

function select(typeSet, accept) {
	if (!(typeSet instanceof MediaTypeSet)) {
		throw new TypeError('Types must be instance of MediaTypeSet');
	}

	var types = typeSet.types;

	if (accept == null || accept === '') {
		return types[0];
	}

	if (typeof accept !== 'string') {
		throw new TypeError('Accept header must be a string, null, or undefined');
	}

	var i;
	var ranges = parseAccept(accept);

	if (ranges === null) {
		return types[0];
	}

	ranges = sort.byReverse(ranges, getSpecificity);

	var weights = new Map();

	for (i = 0; i < ranges.length; i++) {
		var range = ranges[i];
		var matches = typeSet.matches(range);

		for (var j = 0; j < matches.length; j++) {
			var match = matches[j];

			if (!weights.has(match)) {
				weights.set(match, range.weight);
			}
		}
	}

	var best = null;
	var bestWeight = 0;

	for (i = 0; i < types.length; i++) {
		var type = types[i];
		var weight = weights.get(type);

		if (weight > bestWeight) {
			best = type;
			bestWeight = weight;
		}
	}

	return best;
}

exports.MediaType = MediaType;
exports.MediaTypeSet = MediaTypeSet;
exports.select = select;
