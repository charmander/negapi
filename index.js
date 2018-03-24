'use strict';

var parseAccept = require('./parse-accept');

function getName(parameter) {
	return parameter.name;
}

function byUniqueName(a, b) {
	return a.name < b.name ? -1 : 1;
}

function byReverseSpecificity(a, b) {
	return b.specificity - a.specificity;
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

function MediaType(type, subtype, parameters) {
	var parameterList = [];
	var parameterMap = new Map();

	for (var name in parameters) {
		var parameter = {
			name: name.toLowerCase(),
			value: parameters[name].toLowerCase(),
		};

		parameterList.push(parameter);
		parameterMap.set(parameter.name, parameter.value);
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
		var value = this._parameterMap.get(name.toLowerCase());

		return value === undefined ?
			null :
			value;
	},
});

function MediaTypeSet(types) {
	this._ranges = new Map();
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
		var parameters = mediaType.parameters.slice().sort(byUniqueName);
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

				if (ranges.has(key)) {
					ranges.get(key).push(mediaType);
				} else {
					ranges.set(key, [mediaType]);
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
			this.add(parameterName);
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

		for (const rangeName of parameters.keys()) {
			if (!setParameterNames.has(rangeName)) {
				return [];
			}
		}

		var key = range.type + '\0' + range.subtype;

		for (var i = 0; i < setParameterNameList.length; i++) {
			var setName = setParameterNameList[i];

			if (parameters.has(setName)) {
				key += '\0' + setName + '\0' + parameters.get(setName);
			}
		}

		return this._ranges.get(key) || [];
	},
});

Object.defineProperty(MediaTypeSet.prototype, 'select', {
	configurable: true,
	writable: true,
	value: function (accept) {
		var types = this.types;

		if (accept == null) {
			return types[0];
		}

		if (typeof accept !== 'string') {
			throw new TypeError('Accept header must be a string, null, or undefined');
		}

		var ranges = parseAccept(accept);

		if (ranges === null || ranges.length === 0) {
			return types[0];
		}

		ranges.sort(byReverseSpecificity);

		var weights = new Map();
		var i;

		for (i = 0; i < ranges.length; i++) {
			var range = ranges[i];
			var matches = this.matches(range);

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
	},
});

exports.MediaType = MediaType;
exports.MediaTypeSet = MediaTypeSet;
