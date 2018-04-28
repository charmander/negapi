'use strict';

const assert = require('assert');
const describe = require('@charmander/test/describe')(module);

const negapi = require('./');

describe('MediaType#get', it => {
	it('returns undefined for non-existent parameters', () => {
		assert.strictEqual(new negapi.MediaType('text', 'plain').get('format'), undefined);
		assert.strictEqual(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('boundary'), undefined);
	});

	it('gets parameters by name', () => {
		assert.strictEqual(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('format'), 'flowed');
	});

	it('gets parameters by name case-insensitively', () => {
		assert.strictEqual(new negapi.MediaType('text', 'plain', { format: 'flowed' }).get('FORMAT'), 'flowed');
		assert.strictEqual(new negapi.MediaType('text', 'plain', { FORMAT: 'flowed' }).get('format'), 'flowed');
	});

	it('returns lowercased values', () => {
		assert.strictEqual(new negapi.MediaType('text', 'plain', { format: 'FLOWED' }).get('format'), 'flowed');
	});
});

describe('MediaTypeSet#select', it => {
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

	it('accepts exact matches', () => {
		assert.strictEqual(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed'), text);
	});

	it('accepts exact type matches', () => {
		assert.strictEqual(new negapi.MediaTypeSet([ogg, text]).select('text/plain'), text);
	});

	it('accepts subtype wildcards', () => {
		assert.strictEqual(new negapi.MediaTypeSet([ogg, text]).select('text/*'), text);
	});

	it('accepts type wildcards', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('*/*'), text);
	});

	it('accepts an empty header', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select(''), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select(' '), text);
	});

	it('accepts a missing header', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select(null), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select(undefined), text);
	});

	it('accepts quoted parameters', () => {
		assert.strictEqual(new negapi.MediaTypeSet([ogg, json]).select('application/json;foo="\\"foo\\""'), json);
		assert.strictEqual(new negapi.MediaTypeSet([ogg, separators]).select('text/x-separators;comma="a,b"'), separators);
		assert.strictEqual(new negapi.MediaTypeSet([ogg, separators]).select('text/x-separators;semicolon="a;b"'), separators);
		assert.strictEqual(new negapi.MediaTypeSet([ogg, otherQuoted]).select('text/x-other-quoted;spaces=" \t"'), otherQuoted);
		assert.strictEqual(new negapi.MediaTypeSet([ogg, otherQuoted]).select('text/x-other-quoted;spaces="\\ \\\t"'), otherQuoted);
		assert.strictEqual(new negapi.MediaTypeSet([ogg, otherQuoted]).select('text/x-other-quoted;spaces="  "'), null);
	});

	it('returns null if no exact match exists', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('text/plain; format=other'), null);
		assert.strictEqual(new negapi.MediaTypeSet([ogg]).select('audio/ogg; codecs=opus'), null);
	});

	it('returns null if no exact type match exists', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('text/html'), null);
	});

	it('returns null if no subtype wildcard match exists', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/*'), null);
	});

	it('returns null if the only matches are explicitly rejected', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('text/plain;q=0'), null);
	});

	it('selects the most preferred server type when the client prefers types equally', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json, text/plain'), text);
		assert.strictEqual(new negapi.MediaTypeSet([json, text]).select('application/json, text/plain'), json);
		assert.strictEqual(new negapi.MediaTypeSet([json, text, otherFlowed]).select('text/*'), text);
		assert.strictEqual(new negapi.MediaTypeSet([json, otherFlowed, text]).select('text/*'), otherFlowed);
	});

	it('selects the most preferred client type', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json, text/plain;q=0.9'), json);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;q=0.8, text/plain;q=0.9'), text);
	});

	it('selects a non-rejected client type', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, html]).select('text/*, text/plain;q=0'), html);
	});

	it('compares types case-insensitively', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, html]).select('TEXT/HTML'), html);
	});

	it('compares parameter names case-insensitively', () => {
		assert.strictEqual(new negapi.MediaTypeSet([html, text]).select('text/plain; FORMAT=flowed'), text);
	});

	it('compares parameter values case-insensitively', () => {
		assert.strictEqual(new negapi.MediaTypeSet([html, text]).select('text/plain; format=FLOWED'), text);
	});

	it('compares parameters order-independently', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; a=a ; b=b; c=c'), foo);
		assert.strictEqual(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; a=a ; c=c; b=b'), foo);
		assert.strictEqual(new negapi.MediaTypeSet([text, foo]).select('text/x-foo; c=c ; b=b; a=a'), foo);
	});

	it('determines preference based on the most specific match', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, html]).select('text/*;q=0, text/html'), html);
		assert.strictEqual(new negapi.MediaTypeSet([text, html]).select('text/*;q=0, text/html;q=0.001'), html);
		assert.strictEqual(new negapi.MediaTypeSet([html, text]).select('text/*;q=0, text/plain;q=0.001, text/plain;format=flowed;q=0'), null);
		assert.strictEqual(new negapi.MediaTypeSet([text, html]).select('text/html, text/*;q=0'), html);
		assert.strictEqual(new negapi.MediaTypeSet([text, html]).select('text/html;q=0.001, text/*;q=0'), html);
		assert.strictEqual(new negapi.MediaTypeSet([html, text]).select('text/plain;format=flowed;q=0, text/*;q=0, text/plain;q=0.001'), null);
	});

	it('resolves specificity conflicts in favour of the server order', () => {
		// RFC 7231 doesn’t say what to do in this situation or how to determine specificity at all
		assert.strictEqual(new negapi.MediaTypeSet([foo]).select('*/*;a=a;q=0, */*;b=b'), null);
		assert.strictEqual(new negapi.MediaTypeSet([foo]).select('*/*;b=b, */*;a=a;q=0'), foo);
	});

	it('treats Accept parameters as separate from type parameters', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;q=0.5;test=test'), json);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;test=test;q=0.5'), null);
	});

	it('supports + characters in types', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, svg]).select('image/svg+xml'), svg);
	});

	it('supports . characters in types', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, example]).select('application/prs.example'), example);
	});

	it('treats malformed headers as empty', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio//'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('*/ogg'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/ogg;'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/ogg;;'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless;q=0.5'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless='), text);
		assert.strictEqual(new negapi.MediaTypeSet([text]).select('audio/ogg;valueless=;q=0.5'), text);

		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;q=1.5'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;q=one.five'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;q=-1'), text);

		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;foo="'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;foo="foo'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\\'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\\"'), text);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\v'), text);

		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json audio/ogg'), text);
	});

	it('treats duplicate parameters as invalid', () => {
		assert.strictEqual(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed;format=flowed'), ogg);
		assert.strictEqual(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=flowed;format=other'), ogg);
		assert.strictEqual(new negapi.MediaTypeSet([ogg, text]).select('text/plain;format=other;format=flowed'), ogg);
	});

	it('is lenient with badly-concatenated lists', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json,,text/plain;q=0'), json);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json,'), json);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select(',application/json'), json);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select(','), text);
	});

	it('ignores trailing whitespace not removed by Node’s HTTP parser', () => {
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json '), json);
		assert.strictEqual(new negapi.MediaTypeSet([text, json]).select('application/json;foo="\\"foo\\"" '), json);
	});

	it('requires header to be a string', () => {
		assert.throws(() => {
			new negapi.MediaTypeSet([text]).select(5);
		}, /^TypeError: Accept header must be a string, null, or undefined$/);
	});

	it('detects when too many parameters are passed', () => {
		assert.throws(() => {
			const parameters = {};

			for (let i = 0; i < 32; i++) {
				parameters[i + 32] = String(i);
			}

			void new negapi.MediaTypeSet([
				new negapi.MediaType('text', 'plain', parameters),
			]);
		}, /^RangeError: Parameter count must be less than 32$/);
	});
});
