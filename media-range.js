'use strict';

function MediaRange(type, subtype, parameters, parameterCount, weight) {
	var typeSpecificity =
		subtype !== '*' ? 2 :
		type !== '*' ? 1 :
		0;

	this.type = type.toLowerCase();
	this.subtype = subtype.toLowerCase();
	this.parameters = parameters;
	this.parameterCount = parameterCount;
	this.weight = weight;
	this.specificity = typeSpecificity + parameterCount;
}

module.exports = MediaRange;
