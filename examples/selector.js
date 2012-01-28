var selectorParser = (function(){

var P = Pars,
	_n = P._n,
	rBackslash = /\\/g;

var S = P(/\s*/);

var NAME = P( /(?:[\w\u00c0-\uFFFF\-]|\\.)+/ )
	.ret(function() {
		return this[0].replace( rBackslash, "" );
	});

var INT = P(/0|[1-9][0-9]*/)
	.ret(function() {
		return +this[0];
	});


var STRING = P(
		P(/"((?:\\.|[^"])*)"/)('m') |
		P(/'((?:\\.|[^'])*)'/)('m')
	)
	.ret(function() {
		return this.m[1].replace( rBackslash, "" );
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


var SELECTOR = P();
SELECTOR.def(
		S, [ P(/[>+~]/)('rel') ], S,
		SIMPLE_SELECTOR('left'),
		[ SELECTOR('selector') ]
	)
	.ret(function() {
		this.left.relative = this.rel ? this.rel[0] : '';

		if ( this.selector )
			this.selector.left = this.left;

		return this.selector || this.left;
	});

var SELECTORS = P(
		SELECTOR(), _n( S, ",", S, SELECTOR() )
	)
	.ctor( Array );


return P( S, SELECTORS(), P.END ).ret(0)();
})();
