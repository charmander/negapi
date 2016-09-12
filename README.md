# negapi

[![Build status][ci image]][ci]

negapi helps with content negotiation by selecting the most appropriate media type for a response based on a request’s Accept header.

Constructing a media type set takes **exponential space and time** on the highest number of parameters for a type. That number is typically 0, but if something significantly larger is required, this module may not be a good choice. Matching an Accept header against the set takes O(*n* log *n* + *kn*) time, where *n* is the number of ranges in the header and *k* is the number of distinct parameter names in the type set.


## Usage

```javascript
const negapi = require('negapi');

const types = new negapi.MediaTypeSet([
	new negapi.MediaType('text', 'plain', { format: 'flowed' }),
	new negapi.MediaType('application', 'json'),
	new negapi.MediaType('image', 'png'),
]);

const image = negapi.select(types, 'image/*, */*;q=0.5');
console.log(image.subtype);  // png

const text = negapi.select(types, 'text/plain');
console.log(text.get('format'));  // flowed

const none = negapi.select(types, '*/*;q=0');
console.log(none);  // null
```


## API

### `new MediaType(type, subtype, [parameters])`

Creates a media type with the given type (string), subtype (string), and parameters (object with parameters as properties). In `text/plain; format=flowed`, the `type` is `'text'`, the `subtype` is `'plain'`, and the `parameters` are `{ format: 'flowed' }`.

#### `MediaType#type`

The type, as a string.

#### `MediaType#subtype`

The subtype, as a string.

#### `MediaType#get(name)`

Gets the lowercase value of a parameter by name, or `null` if the parameter doesn’t exist. The name is case-insensitive.

### `new MediaTypeSet(types)`

Creates a set of media types. `types` is an array of `MediaType`s ordered by descending preference.

### `select(typeSet, accept)`

Selects the most client-preferred `MediaType` from the `MediaTypeSet` `typeSet`, or `null` if no type is acceptable.


  [ci]: https://travis-ci.org/charmander/negapi
  [ci image]: https://api.travis-ci.org/charmander/negapi.svg
