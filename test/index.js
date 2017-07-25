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

tap.test('MediaTypeSet#select', function (t) {
	var example = new negapi.MediaType('application', 'prs.example');
	var html = new negapi.MediaType('text', 'html');
	var json = new negapi.MediaType('application', 'json', { foo: '"foo"' });
	var ogg = new negapi.MediaType('audio', 'ogg');
	var svg = new negapi.MediaType('image', 'svg+xml');
	var text = new negapi.MediaType('text', 'plain', { format: 'flowed' });
	var otherFlowed = new negapi.MediaType('text', 'x-rich', { format: 'flowed' });
	var foo = new negapi.MediaType('text', 'x-foo', { a: 'a', c: 'c', b: 'b' });
	var separators = new negapi.MediaType('text', 'x-separators', { comma: 'a,b', semicolon: 'a;b' });

	t.test('accepts exact matches', function (t) {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed'), text);
		t.end();
	});

	t.test('accepts exact type matches', function (t) {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain'), text);
		t.end();
	});

	t.test('accepts subtype wildcards', function (t) {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/*'), text);
		t.end();
	});

	t.test('accepts type wildcards', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select('*/*'), text);
		t.end();
	});

	t.test('accepts an empty header', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select(''), text);
		t.is(new negapi.MediaTypeSet([text]).select(' '), text);
		t.end();
	});

	t.test('accepts a missing header', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select(null), text);
		t.is(new negapi.MediaTypeSet([text]).select(undefined), text);
		t.end();
	});

	t.test('accepts quoted parameters', function (t) {
		t.is(new negapi.MediaTypeSet([ogg, json]).select('application/json;foo="\\"foo\\""'), json);
		t.is(new negapi.MediaTypeSet([ogg, separators]).select('text/x-separators;comma="a,b"'), separators);
		t.is(new negapi.MediaTypeSet([ogg, separators]).select('text/x-separators;semicolon="a;b"'), separators);
		t.end();
	});

	t.test('returns null if no exact match exists', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select('text/plain; format=other'), null);
		t.is(new negapi.MediaTypeSet([ogg]).select('audio/ogg; codecs=opus'), null);
		t.end();
	});

	t.test('returns null if no exact type match exists', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select('text/html'), null);
		t.end();
	});

	t.test('returns null if no subtype wildcard match exists', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select('audio/*'), null);
		t.end();
	});

	t.test('returns null if the only matches are explicitly rejected', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select('text/plain;q=0'), null);
		t.end();
	});

	t.test('selects the most preferred server type when the client prefers types equally', function (t) {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json, text/plain'), text);
		t.is(new negapi.MediaTypeSet([json, text]).select('application/json, text/plain'), json);
		t.is(new negapi.MediaTypeSet([json, text, otherFlowed]).select('text/*'), text);
		t.is(new negapi.MediaTypeSet([json, otherFlowed, text]).select('text/*'), otherFlowed);
		t.end();
	});

	t.test('selects the most preferred client type', function (t) {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json, text/plain;q=0.9'), json);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;q=0.8, text/plain;q=0.9'), text);
		t.end();
	});

	t.test('selects a non-rejected client type', function (t) {
		t.is(new negapi.MediaTypeSet([text, html]).select('text/*, text/plain;q=0'), html);
		t.end();
	});

	t.test('compares types case-insensitively', function (t) {
		t.is(new negapi.MediaTypeSet([text, html]).select('TEXT/HTML'), html);
		t.end();
	});

	t.test('compares parameter names case-insensitively', function (t) {
		t.is(new negapi.MediaTypeSet([html, text]).select('text/plain; FORMAT=flowed'), text);
		t.end();
	});

	t.test('compares parameter values case-insensitively', function (t) {
		t.is(new negapi.MediaTypeSet([html, text]).select('text/plain; format=FLOWED'), text);
		t.end();
	});

	t.test('compares parameters order-independently', function (t) {
		t.is(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; a=a; b=b; c=c'), foo);
		t.is(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; a=a; c=c; b=b'), foo);
		t.is(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; c=c; b=b; a=a'), foo);
		t.end();
	});

	t.test('determines preference based on the most specific match', function (t) {
		t.is(new negapi.MediaTypeSet([text, html]).select('text/*;q=0, text/html'), html);
		t.is(new negapi.MediaTypeSet([text, html]).select('text/*;q=0, text/html;q=0.001'), html);
		t.is(new negapi.MediaTypeSet([html, text]).select('text/*;q=0, text/plain;q=0.001, text/plain;format=flowed;q=0'), null);
		t.is(new negapi.MediaTypeSet([text, html]).select('text/html, text/*;q=0'), html);
		t.is(new negapi.MediaTypeSet([text, html]).select('text/html;q=0.001, text/*;q=0'), html);
		t.is(new negapi.MediaTypeSet([html, text]).select('text/plain;format=flowed;q=0, text/*;q=0, text/plain;q=0.001'), null);
		t.end();
	});

	t.test('resolves specificity conflicts in favour of the server order', function (t) {
		// RFC 7231 doesn’t say what to do in this situation or how to determine specificity at all
		t.is(new negapi.MediaTypeSet([foo]).select('*/*;a=a;q=0, */*;b=b'), null);
		t.is(new negapi.MediaTypeSet([foo]).select('*/*;b=b, */*;a=a;q=0'), foo);
		t.end();
	});

	t.test('treats Accept parameters as separate from type parameters', function (t) {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;q=0.5;test=test'), json);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;test=test;q=0.5'), null);
		t.end();
	});

	t.test('supports + characters in types', function (t) {
		t.is(new negapi.MediaTypeSet([text, svg]).select('image/svg+xml'), svg);
		t.end();
	});

	t.test('supports . characters in types', function (t) {
		t.is(new negapi.MediaTypeSet([text, example]).select('application/prs.example'), example);
		t.end();
	});

	t.test('treats malformed headers as empty', function (t) {
		t.is(new negapi.MediaTypeSet([text]).select('audio'), text);
		t.is(new negapi.MediaTypeSet([text]).select('*/ogg'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless;q=0.5'), text);
		t.end();
	});

	t.test('is lenient with weights', function (t) {
		t.is(new negapi.MediaTypeSet([ogg, json]).select('application/json;q=1.5'), json);
		t.is(new negapi.MediaTypeSet([ogg, json]).select('application/json;q=one.five'), json);
		t.is(new negapi.MediaTypeSet([ogg, json]).select('application/json;q=-1'), json);
		t.end();
	});

	t.test('is lenient with duplicate parameters with the same value', function (t) {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed;format=flowed'), text);
		t.end();
	});

	t.test('treats duplicate parameters with different values as invalid', function (t) {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed;format=other'), ogg);
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=other;format=flowed'), ogg);
		t.end();
	});

	t.test('is lenient with badly-concatenated lists', function (t) {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json,,text/plain;q=0'), json);
		t.end();
	});

	t.test('requires header to be a string', function (t) {
		t.throws(function () {
			new negapi.MediaTypeSet([text]).select(5);
		}, TypeError);
		t.end();
	});

	t.end();
});
