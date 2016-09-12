'use strict';

var tap = require('tap');

var negapi = require('../');

tap.test('MediaType#get', function (t) {
	t.test('returns null for non-existent parameters', function (t) {
		t.is(new negapi.MediaType('text', 'plain').get('format'), null);
		t.is(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('boundary'), null);
		t.end();
	});

	t.test('gets parameters by name', function (t) {
		t.is(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('format'), 'flowed');
		t.end();
	});

	t.test('gets parameters by name case-insensitively', function (t) {
		t.is(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('FORMAT'), 'flowed');
		t.is(new negapi.MediaType('text', 'plain', { FORMAT: 'flowed' }).get('format'), 'flowed');
		t.end();
	});

	t.test('returns lowercased values', function (t) {
		t.is(new negapi.MediaType('text', 'plain', { format: 'FLOWED' }).get('format'), 'flowed');
		t.end();
	});

	t.end();
});

tap.test('select', function (t) {
	var example = new negapi.MediaType('application', 'prs.example');
	var html = new negapi.MediaType('text', 'html');
	var json = new negapi.MediaType('application', 'json', { foo: '"foo"' });
	var ogg = new negapi.MediaType('audio', 'ogg');
	var svg = new negapi.MediaType('image', 'svg+xml');
	var text = new negapi.MediaType('text', 'plain', { format: 'flowed' });
	var otherFlowed = new negapi.MediaType('text', 'x-rich', { format: 'flowed' });
	var foo = new negapi.MediaType('text', 'x-foo', { a: 'a', c: 'c', b: 'b' });

	t.test('accepts exact matches', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, text]), 'text/plain;format=flowed'), text);
		t.end();
	});

	t.test('accepts exact type matches', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, text]), 'text/plain'), text);
		t.end();
	});

	t.test('accepts subtype wildcards', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, text]), 'text/*'), text);
		t.end();
	});

	t.test('accepts type wildcards', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), '*/*'), text);
		t.end();
	});

	t.test('accepts an empty header', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), ''), text);
		t.is(negapi.select(new negapi.MediaTypeSet([text]), ' '), text);
		t.end();
	});

	t.test('accepts a missing header', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), null), text);
		t.is(negapi.select(new negapi.MediaTypeSet([text]), undefined), text);
		t.end();
	});

	t.test('accepts quoted parameters', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, json]), 'application/json;foo="\\"foo\\""'), json);
		t.end();
	});

	t.test('returns null if no exact match exists', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), 'text/plain; format=other'), null);
		t.end();
	});

	t.test('returns null if no exact type match exists', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), 'text/html'), null);
		t.end();
	});

	t.test('returns null if no subtype wildcard match exists', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), 'audio/*'), null);
		t.end();
	});

	t.test('returns null if the only matches are explicitly rejected', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), 'text/plain;q=0'), null);
		t.end();
	});

	t.test('selects the most preferred server type when the client prefers types equally', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, json]), 'application/json, text/plain'), text);
		t.is(negapi.select(new negapi.MediaTypeSet([json, text]), 'application/json, text/plain'), json);
		t.end();
	});

	t.test('selects the most preferred client type', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, json]), 'application/json, text/plain;q=0.9'), json);
		t.is(negapi.select(new negapi.MediaTypeSet([text, json]), 'application/json;q=0.8, text/plain;q=0.9'), text);
		t.end();
	});

	t.test('selects a non-rejected client type', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, html]), 'text/*, text/plain;q=0'), html);
		t.end();
	});

	t.test('compares types case-insensitively', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, html]), 'TEXT/HTML'), html);
		t.end();
	});

	t.test('compares parameter names case-insensitively', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([html, text]), 'text/plain; FORMAT=flowed'), text);
		t.end();
	});

	t.test('compares parameter values case-insensitively', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([html, text]), 'text/plain; format=FLOWED'), text);
		t.end();
	});

	t.test('compares parameters order-independently', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, foo]), 'text/x-foo; a=a; b=b; c=c'), foo);
		t.is(negapi.select(new negapi.MediaTypeSet([text, foo]), 'text/x-foo; a=a; c=c; b=b'), foo);
		t.is(negapi.select(new negapi.MediaTypeSet([text, foo]), 'text/x-foo; c=c; b=b; a=a'), foo);
		t.end();
	});

	t.test('determines preference based on the most specific match', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, html]), 'text/*;q=0, text/html'), html);
		t.is(negapi.select(new negapi.MediaTypeSet([text, html]), 'text/*;q=0, text/html;q=0.001'), html);
		t.is(negapi.select(new negapi.MediaTypeSet([html, text]), 'text/*;q=0, text/plain;q=0.001, text/plain;format=flowed;q=0'), null);
		t.is(negapi.select(new negapi.MediaTypeSet([text, html]), 'text/html, text/*;q=0'), html);
		t.is(negapi.select(new negapi.MediaTypeSet([text, html]), 'text/html;q=0.001, text/*;q=0'), html);
		t.is(negapi.select(new negapi.MediaTypeSet([html, text]), 'text/plain;format=flowed;q=0, text/*;q=0, text/plain;q=0.001'), null);
		t.end();
	});

	t.test('treats parameters and types as equally specific', function (t) {
		// RFC 7231 doesn’t say how to determine whether one range is more specific than another; here’s a guess
		t.is(negapi.select(new negapi.MediaTypeSet([text, otherFlowed]), 'text/plain, text/*;format=flowed'), text);
		t.is(negapi.select(new negapi.MediaTypeSet([otherFlowed, text]), 'text/plain, text/*;format=flowed'), otherFlowed);
		t.end();
	});

	t.test('treats Accept parameters as separate from type parameters', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, json]), 'application/json;q=0.5;test=test'), json);
		t.is(negapi.select(new negapi.MediaTypeSet([text, json]), 'application/json;test=test;q=0.5'), null);
		t.end();
	});

	t.test('supports + characters in types', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, svg]), 'image/svg+xml'), svg);
		t.end();
	});

	t.test('supports . characters in types', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, example]), 'application/prs.example'), example);
		t.end();
	});

	t.test('treats malformed headers as empty', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text]), 'audio'), text);
		t.is(negapi.select(new negapi.MediaTypeSet([text]), '*/ogg'), text);
		t.is(negapi.select(new negapi.MediaTypeSet([text]), 'audio/ogg;valueless;q=0.5'), text);
		t.end();
	});

	t.test('is lenient with weights', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, json]), 'application/json;q=1.5'), json);
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, json]), 'application/json;q=one.five'), json);
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, json]), 'application/json;q=-1'), json);
		t.end();
	});

	t.test('is lenient with duplicate parameters with the same value', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, text]), 'text/plain;format=flowed;format=flowed'), text);
		t.end();
	});

	t.test('treats duplicate parameters with different values as invalid', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, text]), 'text/plain;format=flowed;format=other'), ogg);
		t.is(negapi.select(new negapi.MediaTypeSet([ogg, text]), 'text/plain;format=other;format=flowed'), ogg);
		t.end();
	});

	t.test('is lenient with badly-concatenated lists', function (t) {
		t.is(negapi.select(new negapi.MediaTypeSet([text, json]), 'application/json,,text/plain;q=0'), json);
		t.end();
	});

	t.test('requires available types to be a MediaTypeSet', function (t) {
		t.throws(function () {
			negapi.select([text], 'text/plain');
		}, TypeError);
		t.end();
	});

	t.test('requires header to be a string', function (t) {
		t.throws(function () {
			negapi.select(new negapi.MediaTypeSet([text]), 5);
		}, TypeError);
		t.end();
	});

	t.end();
});
