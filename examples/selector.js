var selectorParser = (function(){

var P = Pars,
	_n = P._n,
	_seq = P._seq,
	rBackslash = /\\/g;

var S = P(/\s*/);
var SPACE = P(/\s+/);

var NAME = P( /(?:[\w\u00c0-\uFFFF\-]|\\.)+/ ).alias('name')
	.ret(function() {
		return this[0].replace( rBackslash, "" );
	});

var INT = P(/0|[1-9][0-9]*/).alias('integer')
	.ret(function() {
		return +this[0];
	});

var STRING = P(
		P._seq( "'", P(/(?:\\.|[^'])*/)('m'), "'" ) |
		P._seq( '"', P(/(?:\\.|[^"])*/)('m'), '"' )
	)
	.ret(function() {
		return this.m[0].replace( rBackslash, "" );
	});

var ATTR_VALUE = P( NAME() | STRING() ).ret(0);

var ATTR = P(
		"[", S, NAME("name"),
		[ S, P(/.?=/).ret(0)("operator"), S, ATTR_VALUE("value") ],
		S, "]"
	)
	.ctor( Object );

var SIMPLE_SELECTOR = P();

var PSEUDO_ARG = P( INT() | STRING() | SIMPLE_SELECTOR() ).ret(0);

var PSEUDO = P(
		":", NAME('name'),
		[ "(", S, [ PSEUDO_ARG('argument') ], S, ")" ]
	)
	.ctor( Object );

SIMPLE_SELECTOR.def(
		[ NAME('tag') ],
		[ "#", NAME('id') ],
		_n( ".", NAME('classes[]') ),
		_n( ATTR('attrs[]') | PSEUDO('pseudos[]') ),
		P.notFirst
	)
	.ctor( Object );


var RELATIVE = P(/[>+~]/).ret(0).alias('relative operator');

var SELECTOR = P();
SELECTOR.def(
		SIMPLE_SELECTOR('left'),
		[ _seq(S, RELATIVE('rel'), S) | SPACE, SELECTOR('selector') ]
	)
	.ret(function() {
		if ( this.selector ) {
			this.selector.rel = this.rel || " ";
			this.selector.left = this.left;
			return this.selector;
		}

		return this.left;
	});

var SELECTORS = P(
		SELECTOR(), S, _n( ",", S, SELECTOR() )
	)
	.ctor( Array );


return P( S, SELECTORS(), S, P.END ).ret(0)();
})();
