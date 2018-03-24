'use strict';

const tap = require('tap');

const negapi = require('../');

tap.test('MediaType#get', t => {
	t.test('returns undefined for non-existent parameters', t => {
		t.is(new negapi.MediaType('text', 'plain').get('format'), undefined);
		t.is(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('boundary'), undefined);
		t.end();
	});

	t.test('gets parameters by name', t => {
		t.is(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('format'), 'flowed');
		t.end();
	});

	t.test('gets parameters by name case-insensitively', t => {
		t.is(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('FORMAT'), 'flowed');
		t.is(new negapi.MediaType('text', 'plain', { FORMAT: 'flowed' }).get('format'), 'flowed');
		t.end();
	});

	t.test('returns lowercased values', t => {
		t.is(new negapi.MediaType('text', 'plain', { format: 'FLOWED' }).get('format'), 'flowed');
		t.end();
	});

	t.end();
});

tap.test('MediaTypeSet#select', t => {
	const example = new negapi.MediaType('application', 'prs.example');
	const html = new negapi.MediaType('text', 'html');
	const json = new negapi.MediaType('application', 'json', { foo: '"foo"' });
	const ogg = new negapi.MediaType('audio', 'ogg');
	const svg = new negapi.MediaType('image', 'svg+xml');
	const text = new negapi.MediaType('text', 'plain', { format: 'flowed' });
	const otherFlowed = new negapi.MediaType('text', 'x-rich', { format: 'flowed' });
	const foo = new negapi.MediaType('text', 'x-foo', { a: 'a', c: 'c', b: 'b' });
	const separators = new negapi.MediaType('text', 'x-separators', { comma: 'a,b', semicolon: 'a;b' });
	const otherQuoted = new negapi.MediaType('text', 'x-other-quoted', { spaces: ' \t' });

	t.test('accepts exact matches', t => {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed'), text);
		t.end();
	});

	t.test('accepts exact type matches', t => {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain'), text);
		t.end();
	});

	t.test('accepts subtype wildcards', t => {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/*'), text);
		t.end();
	});

	t.test('accepts type wildcards', t => {
		t.is(new negapi.MediaTypeSet([text]).select('*/*'), text);
		t.end();
	});

	t.test('accepts an empty header', t => {
		t.is(new negapi.MediaTypeSet([text]).select(''), text);
		t.is(new negapi.MediaTypeSet([text]).select(' '), text);
		t.end();
	});

	t.test('accepts a missing header', t => {
		t.is(new negapi.MediaTypeSet([text]).select(null), text);
		t.is(new negapi.MediaTypeSet([text]).select(undefined), text);
		t.end();
	});

	t.test('accepts quoted parameters', t => {
		t.is(new negapi.MediaTypeSet([ogg, json]).select('application/json;foo="\\"foo\\""'), json);
		t.is(new negapi.MediaTypeSet([ogg, separators]).select('text/x-separators;comma="a,b"'), separators);
		t.is(new negapi.MediaTypeSet([ogg, separators]).select('text/x-separators;semicolon="a;b"'), separators);
		t.is(new negapi.MediaTypeSet([ogg, otherQuoted]).select('text/x-other-quoted;spaces=" \t"'), otherQuoted);
		t.is(new negapi.MediaTypeSet([ogg, otherQuoted]).select('text/x-other-quoted;spaces="\\ \\\t"'), otherQuoted);
		t.is(new negapi.MediaTypeSet([ogg, otherQuoted]).select('text/x-other-quoted;spaces="  "'), null);
		t.end();
	});

	t.test('returns null if no exact match exists', t => {
		t.is(new negapi.MediaTypeSet([text]).select('text/plain; format=other'), null);
		t.is(new negapi.MediaTypeSet([ogg]).select('audio/ogg; codecs=opus'), null);
		t.end();
	});

	t.test('returns null if no exact type match exists', t => {
		t.is(new negapi.MediaTypeSet([text]).select('text/html'), null);
		t.end();
	});

	t.test('returns null if no subtype wildcard match exists', t => {
		t.is(new negapi.MediaTypeSet([text]).select('audio/*'), null);
		t.end();
	});

	t.test('returns null if the only matches are explicitly rejected', t => {
		t.is(new negapi.MediaTypeSet([text]).select('text/plain;q=0'), null);
		t.end();
	});

	t.test('selects the most preferred server type when the client prefers types equally', t => {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json, text/plain'), text);
		t.is(new negapi.MediaTypeSet([json, text]).select('application/json, text/plain'), json);
		t.is(new negapi.MediaTypeSet([json, text, otherFlowed]).select('text/*'), text);
		t.is(new negapi.MediaTypeSet([json, otherFlowed, text]).select('text/*'), otherFlowed);
		t.end();
	});

	t.test('selects the most preferred client type', t => {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json, text/plain;q=0.9'), json);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;q=0.8, text/plain;q=0.9'), text);
		t.end();
	});

	t.test('selects a non-rejected client type', t => {
		t.is(new negapi.MediaTypeSet([text, html]).select('text/*, text/plain;q=0'), html);
		t.end();
	});

	t.test('compares types case-insensitively', t => {
		t.is(new negapi.MediaTypeSet([text, html]).select('TEXT/HTML'), html);
		t.end();
	});

	t.test('compares parameter names case-insensitively', t => {
		t.is(new negapi.MediaTypeSet([html, text]).select('text/plain; FORMAT=flowed'), text);
		t.end();
	});

	t.test('compares parameter values case-insensitively', t => {
		t.is(new negapi.MediaTypeSet([html, text]).select('text/plain; format=FLOWED'), text);
		t.end();
	});

	t.test('compares parameters order-independently', t => {
		t.is(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; a=a ; b=b; c=c'), foo);
		t.is(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; a=a ; c=c; b=b'), foo);
		t.is(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; c=c ; b=b; a=a'), foo);
		t.end();
	});

	t.test('determines preference based on the most specific match', t => {
		t.is(new negapi.MediaTypeSet([text, html]).select('text/*;q=0, text/html'), html);
		t.is(new negapi.MediaTypeSet([text, html]).select('text/*;q=0, text/html;q=0.001'), html);
		t.is(new negapi.MediaTypeSet([html, text]).select('text/*;q=0, text/plain;q=0.001, text/plain;format=flowed;q=0'), null);
		t.is(new negapi.MediaTypeSet([text, html]).select('text/html, text/*;q=0'), html);
		t.is(new negapi.MediaTypeSet([text, html]).select('text/html;q=0.001, text/*;q=0'), html);
		t.is(new negapi.MediaTypeSet([html, text]).select('text/plain;format=flowed;q=0, text/*;q=0, text/plain;q=0.001'), null);
		t.end();
	});

	t.test('resolves specificity conflicts in favour of the server order', t => {
		// RFC 7231 doesn’t say what to do in this situation or how to determine specificity at all
		t.is(new negapi.MediaTypeSet([foo]).select('*/*;a=a;q=0, */*;b=b'), null);
		t.is(new negapi.MediaTypeSet([foo]).select('*/*;b=b, */*;a=a;q=0'), foo);
		t.end();
	});

	t.test('treats Accept parameters as separate from type parameters', t => {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;q=0.5;test=test'), json);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;test=test;q=0.5'), null);
		t.end();
	});

	t.test('supports + characters in types', t => {
		t.is(new negapi.MediaTypeSet([text, svg]).select('image/svg+xml'), svg);
		t.end();
	});

	t.test('supports . characters in types', t => {
		t.is(new negapi.MediaTypeSet([text, example]).select('application/prs.example'), example);
		t.end();
	});

	t.test('treats malformed headers as empty', t => {
		t.is(new negapi.MediaTypeSet([text]).select('audio'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio//'), text);
		t.is(new negapi.MediaTypeSet([text]).select('*/ogg'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/ogg;'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/ogg;;'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless;q=0.5'), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless='), text);
		t.is(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless=;q=0.5'), text);

		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;q=1.5'), text);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;q=one.five'), text);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;q=-1'), text);

		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;foo="'), text);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;foo="foo'), text);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\\'), text);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\\"'), text);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\v'), text);

		t.is(new negapi.MediaTypeSet([text, json]).select('application/json audio/ogg'), text);

		t.end();
	});

	t.test('treats duplicate parameters as invalid', t => {
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed;format=flowed'), ogg);
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed;format=other'), ogg);
		t.is(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=other;format=flowed'), ogg);
		t.end();
	});

	t.test('is lenient with badly-concatenated lists', t => {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json,,text/plain;q=0'), json);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json,'), json);
		t.is(new negapi.MediaTypeSet([text, json]).select(',application/json'), json);
		t.is(new negapi.MediaTypeSet([text, json]).select(','), text);
		t.end();
	});

	t.test('ignores trailing whitespace not removed by Node’s HTTP parser', t => {
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json '), json);
		t.is(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\\"foo\\"" '), json);
		t.end();
	});

	t.test('requires header to be a string', t => {
		t.throws(() => {
			new negapi.MediaTypeSet([text]).select(5);
		}, TypeError);
		t.end();
	});

	t.test('detects when too many parameters are passed', t => {
		t.throws(() => {
			const parameters = {};

			for (let i = 0; i < 32; i++) {
				parameters[i + 32] = String(i);
			}

			void new negapi.MediaTypeSet([
				new negapi.MediaType('text', 'plain', parameters),
			]);
		}, {constructor: RangeError, message: 'Parameter count must be less than 32'});
		t.end();
	});

	t.end();
});
