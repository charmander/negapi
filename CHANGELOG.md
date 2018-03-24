## 3.0.0

- `MediaType.prototype.get(name)` now returns `undefined` for missing parameters to match up with `Map.prototype.get`

- `MediaType` and `MediaTypeSet` are now ES6 classes and have the associated restrictions (can’t be extended by non-classes, constructors can’t be called directly)

- Node 4 is no longer supported
