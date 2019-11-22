'use strict';

const parseAccept = require('./parse-accept');

const getName = parameter =>
	parameter.name;

const byUniqueName = (a, b) =>
	a.name < b.name ? -1 : 1;

const byReverseSpecificity = (a, b) =>
	b.specificity - a.specificity;

const mergeSortedSet = (a, b) => {
	const result = [];
	let ai = 0;
	let bi = 0;
	let ac = a[0];
	let bc = b[0];

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
};

class MediaType {
	constructor(type, subtype, parameters) {
		const parameterList = [];
		const parameterMap = new Map();

		for (const name in parameters) {
			const parameter = {
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

	get(name) {
		return this._parameterMap.get(name.toLowerCase());
	}
}

class MediaTypeSet {
	constructor(types) {
		this._ranges = new Map();
		this._sortedParameterNames = [];
		this._parameterNames = new Set();
		this.types = [];
		types.forEach(this.append, this);
	}

	append(mediaType) {
		let {type, subtype} = mediaType;
		const parameters = mediaType.parameters.slice().sort(byUniqueName);
		const ranges = this._ranges;

		if (parameters.length >= 31) {
			throw new RangeError('Parameter count must be less than 31');
		}

		const subsetCount = 1 << parameters.length;

		for (let s = 0; s < 3; s++) {
			for (let i = 0; i < subsetCount; i++) {
				let key = type + '\0' + subtype;

				for (let b = 0; b < parameters.length; b++) {
					if (i & (1 << b)) {
						const parameter = parameters[b];
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

		const parameterNames = parameters.map(getName);

		this.types.push(mediaType);
		this._sortedParameterNames = mergeSortedSet(
			this._sortedParameterNames,
			parameterNames
		);

		parameterNames.forEach(parameterName => {
			this._parameterNames.add(parameterName);
		});
	}

	matches(range) {
		const setParameterNameList = this._sortedParameterNames;

		if (range.parameterCount > setParameterNameList.length) {
			return [];
		}

		const parameters = range.parameters;
		const setParameterNames = this._parameterNames;

		for (const rangeName of parameters.keys()) {
			if (!setParameterNames.has(rangeName)) {
				return [];
			}
		}

		let key = range.type + '\0' + range.subtype;

		for (let i = 0; i < setParameterNameList.length; i++) {
			const setName = setParameterNameList[i];

			if (parameters.has(setName)) {
				key += '\0' + setName + '\0' + parameters.get(setName);
			}
		}

		return this._ranges.get(key) || [];
	}

	select(accept) {
		const types = this.types;

		if (accept == null) {
			return types[0];
		}

		if (typeof accept !== 'string') {
			throw new TypeError('Accept header must be a string, null, or undefined');
		}

		const ranges = parseAccept(accept);

		if (ranges === null || ranges.length === 0) {
			return types[0];
		}

		ranges.sort(byReverseSpecificity);

		const weights = new Map();

		for (let i = 0; i < ranges.length; i++) {
			const range = ranges[i];
			const matches = this.matches(range);

			for (let j = 0; j < matches.length; j++) {
				const match = matches[j];

				if (!weights.has(match)) {
					weights.set(match, range.weight);
				}
			}
		}

		let best = null;
		let bestWeight = 0;

		for (let i = 0; i < types.length; i++) {
			const type = types[i];
			const weight = weights.get(type);

			if (weight > bestWeight) {
				best = type;
				bestWeight = weight;
			}
		}

		return best;
	}
}

module.exports = {
	MediaType,
	MediaTypeSet,
};
