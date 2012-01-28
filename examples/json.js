var jsonParser = (function( Pars, run ){
	return Pars ?
		run( Pars ) :
		module.exports = run( require('../pars') );
})( this.Pars, function( P ) {

var S = P(/\s*/);
var COMMA = P( S, ",", S );

var escapes =  { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
var escapeRe = /\\(["\\\/bfnrt])|\\u([0-9a-fA-F]{4})/g;
var escapeRepl = function repl( a, b, c ) {
		return b ? escapes[ b ] : String.fromCharCode( parseInt( c, 16 ) );
	};

var STRING = P( '"', P(/\\(?:u[0-9a-fA-F]{4}|["\\\/bfnrt])|[^"\\]*/)('m'), '"' )
	.ret(function() {
		return this.m[0].replace( escapeRe, escapeRepl );
	});

var NUMBER = P(/\-?\d+(?:\.\d+)?(?:[eE][\+\-]?\d+)?/)
	.ret(function() {
		return +this[0];
	});

var literals = { 'true': true, 'false': false, 'null': null };
var LITERAL = P(/true|false|null/)
	.ret(function() {
		return literals[ this[0] ];
	});

var VALUE = P();

var ARRAY = P(
		//"[", S, [ VALUE(), P._n( S, ",", S, VALUE() ) ], S, "]"

		"[", S, [ VALUE().sepBy( COMMA ) ], S, "]"
	)
	.ctor( Array ); // clean Array, please

var PAIR = P(
		STRING('key'), S, ":", S, VALUE('value')
	);

var OBJECT = P(
		"{", S, [ PAIR().sepBy( COMMA ) ], S, "}"
	)
	.ret(function() {
		var obj = {};

		for ( var i = 0, l = this.length; i < l; ++i ) {
			obj[ this[i].key ] = this[i].value;
		}

		return obj;
	});

VALUE.def( ARRAY() | OBJECT() | STRING() | NUMBER() | LITERAL() ).ret(0);

return P( S, VALUE(), S, P.END ).ret(0)();

});