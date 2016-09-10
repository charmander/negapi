'use strict';

function comparePropertiesReverse(a, b) {
	var ap = a[0];
	var bp = b[0];

	return (
		ap < bp ? 1 :
		ap > bp ? -1 :
		0
	);
}

function comparePropertiesUnique(a, b) {
	return a[0] < b[0] ? -1 : 1;
}

function getItem(pair) {
	return pair[1];
}

function sortByComparing(comparison) {
	return function (array, property) {
		return array
			.map(function (item) {
				return [property(item), item];
			})
			.sort(comparison)
			.map(getItem);
	};
}

exports.byReverse = sortByComparing(comparePropertiesReverse);
exports.byUnique = sortByComparing(comparePropertiesUnique);
