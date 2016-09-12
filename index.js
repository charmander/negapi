'use strict';

var sort = require('./sort');

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

function MediaRange(type, subtype, parameters, parameterCount, weight) {
	this.type = type.toLowerCase();
	this.subtype = subtype.toLowerCase();
	this.parameters = parameters;
	this.parameterCount = parameterCount;
	this.weight = weight;
}

Object.defineProperty(MediaRange.prototype, 'specificity', {
	configurable: true,
	get: function () {
		var typeSpecificity =
			this.subtype !== '*' ? 2 :
			this.type !== '*' ? 1 :
			0;

		return typeSpecificity + this.parameterCount;
	},
});

function MediaTypeSet(types) {
	this._ranges = Object.create(null);
	this._sortedParameterNames = [];
	this._parameterNames = Object.create(null);
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

		parameterNames.forEach(function (parameterName) {
			this[parameterName] = true;
		}, this._parameterNames);
	},
});

Object.defineProperty(MediaTypeSet.prototype, 'matches', {
	configurable: true,
	writable: true,
	value: function (range) {
		var setParameterNameList = this._sortedParameterNames;

		if (range.parameterCount > setParameterNameList.length) {
			return [];
		}

		var parameters = range.parameters;
		var setParameterNames = this._parameterNames;

		for (var rangeName in parameters) {
			if (!(rangeName in setParameterNames)) {
				return [];
			}
		}

		var key = range.type + '\0' + range.subtype;

		for (var i = 0; i < setParameterNameList.length; i++) {
			var setName = setParameterNameList[i];

			if (setName in parameters) {
				key += '\0' + setName + '\0' + parameters[setName];
			}
		}

		return this._ranges[key] || [];
	},
});

function parseTypeParameter(typeParameter) {
	var match = /^[\t ]*([!#$%&'*+\-.^_`|~0-9A-Za-z]+)=(?:([!#$%&'*+\-.^_`|~0-9A-Za-z]+)|"((?:[\t !\x23-\x5b\x5d-\x7e]|\\[\t -~])*)")[\t ]*$/.exec(typeParameter);

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
	var match = /^[\t ]*(\*(?=\/\*)|[!#$%&'+\-.^_`|~0-9A-Za-z]+)\/(\*|[!#$%&'+\-.^_`|~0-9A-Za-z]+)[\t ]*$/.exec(parts[0]);

	if (match === null) {
		return null;
	}

	var type = match[1].toLowerCase();
	var subtype = match[2].toLowerCase();
	var parameters = Object.create(null);
	var parameterCount = 0;
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

		if (parameter.name in parameters) {
			if (parameters[parameter.name] !== parameter.value) {
				return null;
			}
		} else {
			parameters[parameter.name] = parameter.value;
			parameterCount++;
		}
	}

	return new MediaRange(type, subtype, parameters, parameterCount, weight);
}

function parseAccept(accept) {
	var parts = accept.split(',');
	var ranges = [];

	for (var i = 0; i < parts.length; i++) {
		var part = parts[i];
		var range = parseAcceptRange(part);

		if (range === null) {
			if (hasNonOptionalWhitespace(part)) {
				return null;
			}
		} else {
			ranges.push(range);
		}
	}

	return ranges.length === 0 ?
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
