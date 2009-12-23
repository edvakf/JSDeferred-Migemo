// JSDeferred-Migemo
// Version : 0.1.0
// License : The MIT License <http://www.opensource.org/licenses/mit-license.php>
//   Copyright (c) 2009 Atsushi TAKAYAMA (taka.atsushi (a) gmail.com)
// Depends on :
//   jsdeferred.js <http://github.com/cho45/jsdeferred>
//   jsdeferred-webdatabase <http://github.com/hotchpotch/jsdeferred-webdatabase>
// Thanks to :
//   The original Migemo in Ruby (GNU GPL) <http://0xcc.net/migemo/>
//   JavaScript/Migemo (no license specified) <http://oldriver.org/jsmigemo/>

// This library was got some ideas from the JS/Migemo, but
// most of the code was written from scratch by the author.

// Example usage:
//   var Migemo = Deferred.Migemo;
//   var config = Migemo.createOptionsJa();
//   Migemo.initialize(config)
//   .next(function() {
//     return Migemo.getRegExpString('shinkansen');
//   })
//   .next(function(str) {
//     var regexp = new RegExp(str, 'g');
//     return someText.match(regexp);
//   })

(function() {
  if (!window.Deferred || !window.Deferred.WebDatabase) return;
  var Deferred = window.Deferred;

  // Deferred delegation utility
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

  /*
   * define Deferred.Migemo.*
   */
  Deferred.Migemo = {
    initialize : initialize,
    getCompletion : getCompletion,
    getRegExpString : getRegExpString,
    getRegExpStringFromWords : getRegExpStringFromWords,
    initialized : false,
  };

  function initialize(config) {
    if (!config) config = {};
    var locale = config.locale || localStorage['MIGEMO_LOCALE'] || 'NONE';
    var dictionaryPath = config.dictionaryPath || 'dict/migemo-dict';
    if (config.expandQuery) expandQuery = config.expandQuery;
    if (config.expandResult) expandResult = config.expandResult;

    // if database is already created
    if ( localStorage['MIGEMO_LOCALE'] == locale ) {
      return Deferred.wait(0);
    } else {
      return openDictionaryFile( dictionaryPath )
        .next(function(text) {
          return createDatabase(text);
        }).next(function() {
          localStorage['MIGEMO_LOCALE'] = locale;
        });
    }
  };

  /*
  *  Database interactions
  */
  var Database = Deferred.WebDatabase;
  var Model = Database.Model;
  var db = new Database('Migemo', {estimatedSize: 100*1024*1024});
  var Dictionary = Model({ 
    table :  'dictionary', 
    primaryKeys : ['id'],
    fields : {
      id         : 'id',
      word       : 'TEXT COLLATE NOCASE',
      first      : 'TEXT(1) NOT NULL COLLATE NOCASE', // first letter of word
      completion : 'TEXT NOT NULL'
    }
  }, db);

  function sqlLikeEscape(s){
    return (s+'').replace(/&/g,'&#38;').replace(/%/g,'&#37;').replace(/_/g,'&#95;');
  };

  function createDatabase(text) {
    return Dictionary.dropTable()
      ._(Dictionary).createTable()
      .next(function() {
        var lines = text.split(/\s*\n/);
        var i=0, line;
        var t = new Date;
        return Deferred.loop(Math.floor(lines.length/10000), function() {
          return Dictionary._db.transaction(function() {
            while (line = lines[i++]) {
              if (/^;;/.test(line) || /^\s*$/.test(line)) continue;
              var s = line.split(/\s+/);
              var word = s.shift();
              var first = word.charAt(0);
              var completions = s;
              completions.forEach(function(completion) {
                new Dictionary({word: sqlLikeEscape(word), first: first, completion: completion}).save();
              });
              if (i % 10000 == 0) {
                //console.log(i + ' items stored. Time : ' + Math.floor((new Date-t)/100)/10 + ' s');
                break;
              }
            }
          });
        });
      })
      ._(Dictionary).execute(['DROP INDEX IF EXISTS first_i;'])
      ._(Dictionary).execute(['CREATE INDEX first_i ON dictionary (first);'])
  };

  // load dictionary file
  function openDictionaryFile(path) {
    var d = new Deferred;
    var xhr = new XMLHttpRequest;
    xhr.open('GET', path, true);
    xhr.onload = function() { d.call(xhr.responseText) };
    xhr.onerror = function() { d.fail('XHR failed.') };
    xhr.send();
    return d;
  };

  function lookupWords(word) {
    var first = word.charAt(0);
    var t = new Date;
    return Dictionary
      .find({
        fields: ['completion'], 
        where: ['first = ? AND word LIKE ?', [first, sqlLikeEscape(word) + '%'] ]
      })
      .next(function(results) {
        //console.log(results.length + ' results for for '+word+', took '+ (new Date - t) +' ms.');
        return results.map(function(result) {return result.completion;});
      });
  };

  /*
   * Migemo.getCompletion(query) => pass completion list to next Deferred as 2D array of strings
   *   (completion list for each segment)
   */
  function getCompletion(query) {
    var t = new Date;
    if (query == '') return Deferred.next(function() {return [];});

    // expanding query means something like
    // query : 'ata asa' => expanded : [["ata","あた"], ["atta","あった"]]
    var expanded = expandQuery(query);
    
    return Deferred.parallel( 
      expanded.map(function(group) {
        return Deferred.parallel(
          group.map(function(q) {return lookupWords(q);})
        )
          // from the above example
          // ["ata","あた"] => results: [ [], ['私','頭','辺り','当り','新しい',...] ]
          // ["atta","あった"] => results : [ ['attack', 'attach'], ['あった'] ]
        .next(function(results) { 
          results = concat(results).concat(concat(expanded));
          results = results.map(expandResult);
          // what expandResult does is: 'attack' => ['attack', 'attacked', 'attacking', 'attacker'] 
          // or 'あった' => ['あった', 'アッタ']
          results = concat(results);
          return unique(results);
        })
      })
    ); //.next(function(res) {console.log(new Date - t); return res;});
  };

  function concat(ary) {
    return Array.prototype.concat.apply([], ary);
  }
  function unique(ary) {
    return ary.filter(function(a, i) {return ary.indexOf(a) == i});
  }

  // below functions are intended to be overridden by the locale
  function expandQuery(query) {return [query];};
  function expandResult(result) {return [result];};

  /*
   * Migemo.getRegExpString(words, longestMatch) 
   *   => returns a RegExp-compilable string
   * if longestMatch is true, the compiled RegExp will match the longest part
   */
  function getRegExpString(query, longestMatch) {
    if (query == '') return Deferred.next(function() {return '';});

    return getCompletion(query)
      .next(function(lists) {
        return lists.map(function(completions) {
          return getRegExpStringFromWords(completions, longestMatch);
        }).join('\s*');
      });
  };

  function getRegExpStringFromWords(words, longestMatch) {
    if (!words.length) return '';
    if (words.length == 1) return regexpEscape(words[0]);

    var singleChars = [];
    var longerChars = {};
    words.forEach(function(word) {
      if (!word.length) return;
      if (word.length == 1) return singleChars.push(word);
      var head = word[0];
      var tail = word.slice(1);
      if (longerChars[head]) {
        longerChars[head].push(tail);
      } else {
        longerChars[head] = [tail];
      }
    });

    var regexpLonger = [];
    for (var x in longerChars) {
      var tails = longerChars[x];
      if (tails.length === 1) {
        regexpLonger.push( regexpEscape(x + tails) );
      } else { // tails.length > 1
        regexpLonger.push(
          regexpEscape(x) +   // recursion here! 
            '(?:' + getRegExpStringFromWords(tails, longestMatch) + ')'
        );
      }
    }

    var single = (singleChars.length == 1) ? regexpEscape(singleChars[0]) 
                         : '[' + singleChars.map(regexpEscape).join('') + ']';
    var longer = regexpLonger.join('|');
    var str;
    if (!singleChars.length) {
      str = longer;
    } else if (!regexpLonger.length) {
      str = single;
    } else if (longestMatch) {
      str = longer + '|' + single;
    } else {
      str = single + '|' + longer;
    }

    return str
  };

  // RegExp.escape
  function regexpEscape(s) {
    return (s+'').replace(/[\u0000-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u00a0]/g,'\\$&');
  };

})();