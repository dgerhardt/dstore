define([
	'dojo/_base/declare',
	'dojo/_base/array',
	'dojo/store/util/QueryResults'
	/*=====, "dstore/api/Store" =====*/
], function (declare, arrayUtil, QueryResults /*=====, Store =====*/) {
// module:
//		An adapter mixin that makes a dstore store object look like a legacy Dojo object store.

	function passthrough(data) {
		return data;
	}

	// No base class, but for purposes of documentation, the base class is dstore/api/Store
	var base = null;
	/*===== base = Store; =====*/

	var adapterPrototype = {

		// store:
		//		The dstore store that is wrapped as a Dojo object store
		store: null,

		constructor: function (store) {
			this.store = store;

			if (this.store.queryEngine) {
				var queryEngine = this.store.queryEngine;
				this.queryEngine = function (query, options) {
					options = options || {};

					var filter = queryEngine.filter(query);
					var sort = passthrough;
					var range = passthrough;

					if (queryEngine.sort && options.sort) {
						sort = queryEngine.sort(arrayUtil.map(options.sort, function (criteria) {
							return {
								property: criteria.attribute,
								descending: criteria.descending
							};
						}));
					}

					if (!isNaN(options.start) || !isNaN(options.count)) {
						range = queryEngine.range({
							start: options.start,
							end: (options.start || 0) + (isNaN(options.count) ? Infinity : options.count)
						});
					}

					return function (data) {
						return range(sort(filter(data)));
					};
				};
			}
		},

		query: function (query, options) {
			// summary:
			//		Queries the store for objects. This does not alter the store, but returns a
			//		set of data from the store.
			// query: String|Object|Function
			//		The query to use for retrieving objects from the store.
			// options: dstore/api/Store.QueryOptions
			//		The optional arguments to apply to the resultset.
			// returns: dstore/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			//
			// example:
			//		Given the following store:
			//
			//	...find all items where "prime" is true:
			//
			//	|	store.query({ prime: true }).forEach(function(object){
			//	|		// handle each object
			//	|	});
			var results = this.store.filter(query);

			if (options) {
				// Apply sorting
				var sort = options.sort;
				if (sort) {
					if (Object.prototype.toString.call(sort) === '[object Array]') {
						var sortOptions;
						while ((sortOptions = sort.pop())) {
							results = results.sort(sortOptions.attribute, sortOptions.descending);
						}
					} else {
						results = results.sort(sort);
					}
				}
				// Apply a range
				if ('start' in options) {
					var start = options.start || 0;
					var queryResults = results.fetchRange({
						start: start,
						end: options.count ? (start + options.count) : Infinity
					});
					queryResults.total = queryResults.totalLength;
					return new QueryResults(queryResults);
				}
 			}
 			var tracked;
			if (results.track) {
				// if it is trackable, always track, so that observe can
				// work properly.
				results = results.track();
				tracked = true;
			}
			var queryResults = new QueryResults(results.fetch());
			queryResults.observe = function (callback, includeObjectUpdates) {
				// translate observe to event listeners
				function convertUndefined(value) {
					if (value === undefined && tracked) {
						return -1;
					}
					return value;
				}
				var addHandle = results.on('add', function (event) {
					callback(event.target, -1, convertUndefined(event.index));
				});
				var updateHandle = results.on('update', function (event) {
					if (includeObjectUpdates || event.previousIndex !== event.index || !isFinite(event.index)) {
						callback(event.target, convertUndefined(event.previousIndex), convertUndefined(event.index));
					}
				});
				var removeHandle = results.on('remove', function (event) {
					callback(event.target, convertUndefined(event.previousIndex), -1);
				});
				var handle = {
					remove: function () {
						addHandle.remove();
						updateHandle.remove();
						removeHandle.remove();
					}
				};
				handle.cancel = handle.remove;
				return handle;
			};
			return queryResults;
		}
	};

	var delegatedMethods = [ 'get', 'put', 'add', 'remove', 'getIdentity' ];
	arrayUtil.forEach(delegatedMethods, function (methodName) {
		adapterPrototype[methodName] = function () {
			var store = this.store;
			return store[methodName].apply(store, arguments);
		};
	});

	return declare(base, adapterPrototype);
});
