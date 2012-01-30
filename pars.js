// Pars, yet another parser combinator library
// Robert Katić <robert.katic@gmail.com>
// MIT X Licensed

var Pars = (function( run ){
	return typeof module != 'undefined' && module.exports ?
		module.exports = run() : run();
})(function(){

	var R_REF = -1,
		R_SEQUENCE = 1,
		R_ANY = 2,
		R_STRING = 3,
		R_REGEXP = 4,
		R_FUNCTION = 5,
		R_CHAR = 6,
		R_BOOL = 7,
		toStr = ({}).toString,
		or_queue = [],
		or_num = 1,
		undefined,
		F = function() {},
		DEF_FLAGS = RegExp.prototype.sticky === undefined ? "g" : "gy",
		rname = /^(.*?)(\[\])?$/,
		rescape = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
		escapeMap = {
			'\b': '\\b',
			'\t': '\\t',
			'\n': '\\n',
			'\f': '\\f',
			'\r': '\\r',
			'"' : '\\"',
			'\\': '\\\\'
		},
		valueOf;

	function quote( s ) {
		rescape.lastIndex = 0;
		return '"' + ( rescape.test( s ) ? s.replace( rescape, escapeChar ) : s ) + '"';
	}

	function escapeChar( c ) {
		return escapeMap[ c ] || '\\u' + ( '0000' + c.charCodeAt(0).toString(16) ).slice(-4);
	}

	function getClass( obj ) {
		return obj == null ? ( '' + obj ) : toStr.call( obj ).slice( 8, -1 );
	}

	function clone( p ) {
		F.prototype = p;
		return new F();
	}

	function getOrs( num ) {
		var ret = [], keep = [],
			i, len, r;

		for ( i = 0, len = or_queue.length; i < len; ++i ) {
			r = or_queue[i];

			if ( num & r.n ) {
				ret.push( r.v );

			} else {
				keep.push( r );
			}
		}

		or_queue = keep;

		if ( or_queue.length == 0 ) {
			or_num = 1;
		}

		return ret;
	}

	function Rule( w, p ) {
		this.what = w ? w : p.what;
		this.param = w ? p : p.param;
		this.optional = w ? false : p.optional;
		this.repeat = w ? false : p.repeat;
		this.ch = w ? NaN : p.ch;

		if ( w == R_CHAR || w == R_STRING ) {
			this.ch = p.charCodeAt(0);

		} else if ( w == R_SEQUENCE && p[0] && !p[0].optional ) {
			this.ch = p[0].ch;
		}

		this.data = w ? null : p.data;
		this.name = w ? '' : p.name;
		this.out = w ? 0 : p.out; // 0 -> no, 1 -> yes, 2 -> collect
	}

	Rule.prototype.transcribe = function( r ) {
		if ( this.what != R_REF ) {
			throw new Error("not a ref");
		}

		Rule.call( this, 0, r );
		return this;
	};

	Rule.prototype.sub = function() {
		return this.what == R_REF ? clone( this ) : new Rule( 0, this );
	};

	Rule.prototype.valueOf = valueOf = function() {
		var n = or_num;
		or_num <<= 1;
		or_queue.push({ n: n, v: this });
		return n;
	};

	Rule.prototype.scan = function( str, pos ) {
		var what, param, p, m, d, more, optional, repeat, max, i, l,
			stack = [], fails = [], out = [],
			state = this,
			expose = true;

		max = pos = pos || 0;

		for (;;) {
			if ( state ) {
				what = state.what;
				param = state.param;
				optional = repeat || state.optional;
				repeat = false;
				m = null;

				if ( what == 1 || what == 2 ) {
					if ( state.ch >= 0 && state.ch !== str.charCodeAt(pos) ) {
						state = param[0];
						p = -1;

					} else {
						d && stack.push( d );
						d = {
							w: what,
							a: param,
							i: 1,
							n: 0,
							// prevs
							p: pos,
							l: out.length,
							o: optional,
							x: expose,
							s: state
						};

						if ( expose ) {
							if ( state.out ) {
								out.push( null );

							} else if ( state.data ) {
								expose = false;
							}
						}

						// get first in group
						state = param[ 0 ];

						// empty group?
						if ( !state ) {
							p = what == 1 ? pos : -1;
						}

						continue;
					}

				} else if ( what == 7 ) { // R_BOOL
					p = param ? pos : -1;

				} else if ( what == 6 ) { // R_CHAR
					p = str.charCodeAt( pos ) === state.ch ?
						pos + 1 :
						-1;

				} else if ( what == 3 ) { // R_STRING
					for ( p = pos, i = 0, l = param.length; i < l; ++p, ++i ) {
						if ( str.charCodeAt(p) !== param.charCodeAt(i) ) {
							p = -1;
							break;
						}
					}

				} else if ( what == 4 ) { // R_REGEXP
					param.lastIndex = pos;
					m = param.exec( str );
					p = m && m.index == pos ?
						pos + m[0].length :
						-1;

				} else if ( what == 5 ) { // R_FUNCTION
					p = param.call( state.data, str, pos, d && d.n );

				} else {
					throw new Error("invalid state");
				}

				if ( ~p ) {
					if ( expose && state.out ) {
						if ( !m ) {
							m = {
								input: str,
								index: pos
							}
						}

						m._state_ = state;
						m.lastIndex = p;

						out.push( m );
					}

					pos = p;

					repeat = state.repeat;

				} else {
					if ( pos > max ) {
						max = pos;
						fails = [ state ];

					} else if ( pos == max ) {
						fails.push( state );
					}
				}

			// no state -> end of the group
			} else {
				expose = d.x;
				state = d.s;

				if ( ~p && d.n ) {
					if ( expose && state.out ) {
						m = [];
						m._starts_ = true;
						m._state_ = state;
						m.input = str;
						m.index = d.p;
						m.lastIndex = pos;

						out[ d.l ] = m;
						out.push( null );
					}

					repeat = state.repeat;

				} else {
					pos = d.p;
					out.length = d.l;
					optional = d.o;
					p = -1;
				}

				d = stack.pop();
			}

			if ( repeat ) {
				if ( d ) ++d.n;
				continue;
			}

			if ( !d ) {
				if ( ~p || optional ) {
					out.process = P.proc;
					return out;
				}

				throw error( str, max, fails );
			}

			if ( ~p ) {
				more = d.w == 1;
				++d.n;

			} else {
				more = optional || d.w == 2;

				if ( optional ) {
					p = pos;
				}
			}

			state = more ? d.a[ d.i++ ] : null;
		}
	};

	Rule.prototype.parse = function( input, pos ) {
		var r = this.scan( input, pos );
		return P.proc.apply( r, r.slice.call(arguments, 2) );
	};

	function error( input, index, states ) {
		var left = input.substring( 0, index ),
			lines = left.replace(/\r\n|[\v\f\r\x85\u2028\u2029]/g, '\n').split('\n'),
			line = lines.length,
			column = ( lines[ line - 1 ] || '' ).length + 1,
			actual = input.charAt( index ),
			expectedArray = [], expectedMap = {},
			expected, i, len, state, msg;

		actual = actual ? quote( actual ) : '<end of input>';

		for ( i = 0, len = states.length; i < len; ++i ) {
			state = states[i];

			if ( state.data && state.data._alias_ ) {
				expected = '<' + state.data._alias_ + '>';

			} else if ( state.what == R_CHAR  || state.what == R_STRING ) {
				expected = quote( state.param );

			} else {
				i = 0;
				break;
			}

			expectedMap[ expected ] = 1;
		}

		if ( i ) {
			for ( expected in expectedMap ) {
				if ( expectedMap.hasOwnProperty( expected ) ) {
					expectedArray.push( expected );
				}
			}

			expected = expectedArray.sort().pop();

			if ( expectedArray.length ) {
				expected = expectedArray.join(', ') + ' or ' + expected;
			}

			msg = 'Expected ' + expected + ' but ' + actual + ' found.';

		} else {
			msg = 'Unexpected ' + actual + '.';
		}

		return new SyntaxError( msg, line, column );
	}

	function SyntaxError( message, line, column ) {
		this.name = 'SyntaxError';
		this.message = message;
		this.line = line;
		this.column = column;
	}

	SyntaxError.prototype.toString = function() {
		return this.name + ': ' + this.message;
	};

	function toState( x ) {
		var cls, what;

		if ( x && x.toState ) {
			return x.toState();
		}

		cls = getClass( x );

		if ( cls == 'Boolean' ) {
			what = R_BOOL;

		} else if ( cls == 'String' ) {
			what = x.length === 1 ? R_CHAR : R_STRING;

		} else if ( cls == 'RegExp' ) {
			what = R_REGEXP;
			x = new RegExp( x.source,
				DEF_FLAGS +
				( x.ignoreCase ? "i" : "" ) +
				( x.multiline ? "m" : "" ) );

		} else if ( cls == 'Function' ) {
			what = R_FUNCTION;

		} else {
			if ( cls == 'Number' ) {
				x = argsToState( getOrs( x ), R_ANY );

			} else if ( cls == 'Array' ) {
				x = argsToState( x );
				x.optional = true;
			}

			return x;
		}

		return new Rule( what, x );
	}

	function argsToState( args, defWhat ) {
		var a;

		if ( args.length == 1 ) {
			a = toState( args[0] );
			return a === args[0] ? a.sub() : a;

		} else {
			a = [];

			for ( var i = 0, l = args.length; i < l; ++i ) {
				a[i] = toState( args[i] );
			}

			return new Rule( defWhat || R_SEQUENCE, a );
		}
	}

	function wrap( rule ) {
		if ( rule.out ) {
			rule = new Rule( R_SEQUENCE, [ rule ] );
		}

		var w = function( q ) {
			var m = rname.exec( q == null ? '' : q );
			return w.toState( m[1], m[2] ? 2 : 1 );
		};

		w.valueOf = valueOf;

		w.toState = function( name, out ) {
			var s = rule.sub();
			s.name = name || '';
			s.out = out || 0;
			s.data = w;
			return s;
		};

		w.def = function() {
			var s = argsToState( arguments );
			rule.transcribe( s );
			return w;
		};

		w.alias = function( str ) {
			w._alias_ = str;
			return w;
		};

		w.ctor = function( ctor ) {
			w._ctor_ = ctor;
			return w;
		};

		w.start = function( func ) {
			w._start_ = func;
			return w;
		};

		w.ret = function( x ) {
			if ( getClass( x ) == 'Function' ) {
				w._get_ = x;

			} else {
				var m = rname.exec( x == null ? '' : x ),
					name = m[1];

				w._prop_ = name;

				w._get_ = m[2] ?
					function() { return this[ name ] || []; } :
					null;
			}

			return w;
		};

		return w;
	}

	var P = function() {
		return wrap( arguments.length ?
			argsToState( arguments ) :
			new Rule( R_REF, null ) );
	};

	P.seq = function() {
		return wrap( argsToState( arguments, R_SEQUENCE ) );
	};

	P.any = function() {
		return wrap( argsToState( arguments, R_ANY ) );
	}

	P._seq = function() {
		return argsToState( arguments, R_SEQUENCE );
	};

	P._any = function() {
		return argsToState( arguments, R_ANY );
	};

	P._repeat = function() {
		var s = argsToState( arguments );
		s.repeat = true;
		return s;
	};

	P._n = function() {
		var s = argsToState( arguments );
		s.repeat = true;
		s.optional = true;
		return s;
	};

	P.proc = function() {
		var a = this, args = arguments,
			stack = [],
			i = 0, len = a.length,
			m, s, g, d, val, name;

		for ( ; i < len; ++i ) {
			m = a[i];

			if ( m ) {
				s = m._state_;
				d = s.data;

				if ( m._starts_ ) {
					m = d._ctor_ ? new d._ctor_() : m;

					stack.push( m, s, g );

					g = m;

					if ( d._start_ ) {
						d._start_.apply( m, args );
					}

					continue;
				}

			} else {
				g = stack.pop();
				s = stack.pop();
				m = stack.pop();
				d = s.data;
			}

			val = !d ? m :
				d._get_ ? d._get_.apply( m, args ) :
				d._prop_ ? m[ d._prop_ ] :
				m;

			name = s.name;

			if ( g ) {
				if ( name ) {
					if ( s.out > 1 ) {
						if ( !g[ name ] ) {
							g[ name ] = [ val ];
						} else {
							g[ name ].push( val );
						}
					} else {
						g[ name ] = val;
					}
				} else {
					g.push( val );
				}
			} else {
				break;
			}
		}

		return val;
	};

	P.END = P(function( str, pos ) {
		return str.charCodeAt( pos ) >= 0 ? -1 : pos;
	})
	.alias('end of input');

	P.notFirst = P(function( str, pos, n ) {
		return n ? pos : -1;
	});

	return P;
});
