Deferred.define();
Deferred.prototype._fire = function (okng, value) {
	var next = "ok";
	try {
		value = this.callback[okng].call(this, value);
	} catch (e) {
		next  = "ng";
		if (Deferred.debug) console.error(e);
		value = e;
	}
	if (value instanceof Deferred) {
		value._next = this._next;
	} else {
		if (this._next) this._next._fire(next, value);
	}
	return this;
}

var p = function() {
	console.log(Array.prototype.slice.call(arguments, 0));
}

var is = function(a, b, mes) {
	equals(a.toString(), b.toString(), mes);
}

Deferred.test = function(name, t, count, wait) {
	var d = new Deferred();
	var search = location.search;
	var func = function() {
		setTimeout(function() {
			var setupDeferred = new Deferred(), teardownDeferred = new Deferred();
			var setup = Deferred.test.setup, teardown = Deferred.test.teardown;
			setupDeferred.next(function() {
				next(function() {
					var args = [name, function() {
						stop(wait || 3000);
						try {
							t(teardownDeferred);
						} catch(e) {
							ok(false, 'test error: ' + e.toString());
							teardownDeferred.call();
						}
					}];
					if (count) args.push(count)
					test.apply(test, args);
				});//, 0);
				return teardownDeferred;
			}).next(function() {
				teardown(d);
			});
			setup(setupDeferred);
		}, 0);
	}
	if (search.indexOf('?') == 0) {
		if (decodeURIComponent(search.substring(1)) != name) {
			setTimeout(function() {
				d.call();
			}, 0);
		} else {
			func();
		}
	} else {
		func();
	}
	return d;
};

// var i = 0;
Deferred.test.setup = function(d) {
//	console.log('setup' + (++i));
	d.call();
};

Deferred.test.teardown = function(d) {
	start(); // XXX
//	console.log('teardown' + i);
	d.call();
};

Deferred.prototype.method = function(name) {
	return d[name]();
};

Deferred.register('test', Deferred.test);

// http://javascript.g.hatena.ne.jp/edvakf/20091215/1260927366
if (!Deferred.prototype._) Deferred.prototype._ = function(obj) {
	var self = this;
	var klass = function() {};
	klass.prototype = obj;
	var delegate = new klass;
	for (var x in obj) if (typeof obj[x] === 'function') (function(x) {
		delegate[x] = function() {
			var args = Array.prototype.slice.call(arguments);
			return self.next(function() {
				return obj[x].apply(obj, args);
			});
		}
	})(x);
	return delegate;
};

Deferred.prototype.peek = function() {
	return this.next(function(r) {
		console.log(r)
		return r;
	})
}

j = JSON.stringify;
Deferred.debug = true;
var Database = Deferred.WebDatabase;
//Database.debugMessage = true;
var FullText = Database.FullText;

var Migemo = Deferred.Migemo;
var config = Migemo.createConfigJa(null, ['../src/dict/migemo-dict-ja','../src/dict/migemo-dict-ja-roman']);
Migemo.debug = true;

Deferred
.test('getRegExpStringFromWords', function(done) {
  var getRegExpStringFromWords = Migemo.getRegExpStringFromWords;
  equals(getRegExpStringFromWords(['a', 'ab', 'abc', 'abcd', 'ac', 'bc', 'cc']), 'a|a(?:[bc]|b(?:c|cd))|bc|cc');
  equals(getRegExpStringFromWords(['a', 'ab', 'abc', 'abcd', 'ac', 'bc', 'cc'], true), 'a(?:b(?:cd|c)|[bc])|bc|cc|a');
  var re = new RegExp( getRegExpStringFromWords(['a','ab','abc','acd','bcd']) );
  equals(re.toString(), '/a|a(?:b|bc|cd)|bcd/');
  equals(re.test('bcd'), true);
  var re = new RegExp( getRegExpStringFromWords(['!','.','@#','$%','$_']) );
  equals(re.test('a'), false);
  equals(re.test('$\\'), false);
  equals(re.test('$%'), true);
  equals(re.test('$_'), true);
  equals(re.test('.'), true);
  var re = new RegExp( getRegExpStringFromWords(['a','ab','abc','acd','bcd'],true) );
  equals(re.toString(), '/a(?:bc|cd|b)|bcd|a/');
  equals(re.test('bcd'), true);
  done.call();
}, 11)

.test('expandQuery', function(done) {
  var expandQuery = config.expandQuery;

  equals( j(expandQuery('a')), j([['a','あ']]));
  equals( j(expandQuery('ata')), j([["ata","あた"]]));
  equals( j(expandQuery('ata asa')), j([["ata","あた"], ["asa","あさ"]]));
    // maybe split at symbols in the future
  equals( j(expandQuery('ata.asa')), j([["ata.asa"]]));
  equals( j(expandQuery('atta')), j([['atta','あった']]));
  equals( j(expandQuery('attorney')), j([['attorney']]));
  equals( j(expandQuery('att')), j([["att", "あった", "あっち", "あっつ", "あって", "あっと"]]));
  equals( j(expandQuery('at')), j([["at", "あた", "あち", "あつ", "あて", "あと", "あった", "あっち", "あっつ", "あって", "あっと"]]));
  equals( j(expandQuery('ats')), j([["ats","あつ"]]));
  equals( j(expandQuery('ax')), j([["ax", "あっ", "あぁ", "あぃ", "あぅ", "あぇ", "あぉ", "あゃ", "あゅ", "あょ"]]));
  equals( j(expandQuery('t')), j([["t", "た", "ち", "つ", "て", "と", "った", "っち", "っつ", "って", "っと"]]));
  done.call();
})

.test('initialize', function(done) {
  var t = new Date;
  return Migemo.initialize(config)
    .next(function() {ok(true, 'migemo database created. Took '+ Math.floor((new Date - t)/1000) + ' sec.');})
    .next(function() {done.call()});
}, 1, 150*1000)

.test('getCompletion', function(done) {
  return Migemo.getCompletion('shougi')
    .next(function(res) { ok(true, 'query : "shougi", results : ' + j(res)) })

    ._(Migemo).getCompletion('shougi kaisetu')
    .next(function(res) { ok(true, 'query : "shougi kaisetu", results : ' + j(res)) })

    ._(Migemo).getCompletion('a')  // exact match for one letter
    .next(function(res) { ok(true, 'query : "a", results : ' + j(res)) })

    ._(Migemo).getCompletion('attorney')
    .next(function(res) { ok(true, 'query : "attorney", results : ' + j(res)) })

    ._(Migemo).getCompletion('bukkum')
    .next(function(res) { ok(true, 'query : "bukkum", results : ' + j(res)) })

    ._(Migemo).getCompletion('TaBeruna kiken')
    .next(function(res) { ok(true, 'query : "TaBeruna kiken", results : ' + j(res)) })

    .error(function(e) { ok(false, e.toString()) })
    .next(function() { done.call(); })
})

.test('getRegExpString', function(done) {
  return Migemo.getRegExpString('shougi')
    .next(function(res) { ok(true, 'query : "shougi", results : ' + j(res)) })

    ._(Migemo).getRegExpString('shougi kaisetu')
    .next(function(res) { ok(true, 'query : "shougi kaisetu", results : ' + j(res)) })

    ._(Migemo).getCompletion('su~pa~')
    .next(function(res) { ok(true, 'query : "su~pa~", results : ' + j(res)) })

    ._(Migemo).getRegExpString('attorney')
    .next(function(res) { ok(true, 'query : "attorney", results : ' + j(res)) })

    ._(Migemo).getRegExpString('run like the wind')
    .next(function(res) { ok(true, 'query : "run like the wind", results : ' + j(res)) })

    ._(Migemo).getRegExpString('bukkuma-ku')
    .next(function(res) { ok(true, 'query : "bukkuma-ku", results : ' + j(res)) })

    ._(Migemo).getRegExpString('bukkum')
    .next(function(res) { ok(true, 'query : "bukkum", results : ' + j(res)) })

    ._(Migemo).getRegExpString('sai hatumei')
    .next(function(res) { ok(true, 'query : "sai hatumei", results : ' + j(res)) })

    ._(Migemo).getRegExpString('sai ')
    .next(function(res) { ok(true, 'query : "sai ", results : ' + j(res)) })

    .error(function(e) { ok(false, e.toString()) })
    .next(function() { done.call(); })
})

.test('finished', function(d) {
	ok(true, 'finished!!!');
	d.call();
}, 1, 60*000)  // allow 60 seconds

.error(function(e) {
	console.log('error' + e.toString());
	throw(e);
});

