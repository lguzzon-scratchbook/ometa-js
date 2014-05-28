(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		/* AMD. Register as an anonymous module. */
		define(['codemirror'], factory);
	} else {
		/* Browser globals - dangerous */
		root.codeMirrorOmetaHighlighter = factory(root.CodeMirror);
	}
}(this, function (CodeMirror) {
	return function(ometaGrammar, modeName, mimeType, options) {
		options = options || {};
		options = {
			disableReusingMemoizations: options.disableReusingMemoizations || false,
			enableVisibleOnlyHighlighting: options.enableVisibleOnlyHighlighting || false,
			enableLineByLineParsing: options.enableLineByLineParsing || false,
			lineByLineBuffer: options.lineByLineBuffer == 0 ? 0 : options.lineByLineBuffer || 50,
			modeExtensions: options.modeExtensions || {}
		};
		var limitedHighlighting = options.enableLineByLineParsing || options.enableVisibleOnlyHighlighting,
			getGrammar = (function() {
				var grammar = ometaGrammar.createInstance();
				if(!options.disableReusingMemoizations) {
					grammar.enableReusingMemoizations(grammar._sideEffectingRules);
				}
				grammar._enableTokens();
				return function() {
					if(grammar.reset) {
						grammar.reset();
					}
					return grammar;
				};
			})(),
			removeOldTokens = function(state) {
				for(var i = 0; i < state.currentTokens.length; i++) {
					if(state.currentTokens[i][0] <= state.index) {
						state.currentTokens.splice(i, 1);
						i--;
					}
				}
			},
			addNewTokens = function(state, tokens) {
				// Check current and backtrack to add available tokens
				for(var i = state.index; i >= state.previousIndex; i--) {
					if(tokens[i] != null) {
						state.currentTokens = state.currentTokens.concat(tokens[i]);
					}
				}
				state.previousIndex = state.index;
				// Remove any useless tokens we may have just added.
				removeOldTokens(state);
			},
			getNextToken = function(state) {
				removeOldTokens(state);
				var token = state.currentTokens[0];
				for(var i = 1; i < state.currentTokens.length; i++) {
					if(state.currentTokens[i][0] < token[0]) {
						token = state.currentTokens[i];
					}
				}
				return token;
			};
		CodeMirror.defineMode(modeName, function(config, modeOpts) {
			var tokens = [],
				tokensOffset = 0,
				parse,
				fullParse,
				eol = function(state, stream) {
					if(stream && !stream.eol()) {
						return;
					}
					// We check in case they deleted everything.
					if(state.line == 0) {
						try {
							parse();
						}
						catch(e) {
							if(!(e instanceof SyntaxError)) {
								// Only throw the error if it's not a standard matching error (they'll happen a lot as the user is typing)
								throw e;
							}
						}
					}
					state.index++;
					state.line++;
				},
				applyTokens = function(stream, state) {
					var startPos = stream.pos;
					if(stream.eatSpace()) {
						state.index += stream.pos - startPos;
						eol(state, stream);
						return null;
					}
					var token = getNextToken(state);
					var totalAdvanceDistance = token[0] - state.index;
					var advanceDistance = stream.string.length - stream.pos;
					advanceDistance = Math.min(advanceDistance, totalAdvanceDistance);
					stream.pos += advanceDistance;
					state.index += advanceDistance;
					eol(state, stream);
					return modeName + '-' + token[1];
				};
				(function() {
					var previousText = '',
						prevParsedToLine = 0,
						previousParseResult,
						buildTokens = function(input) { 
							var tokens = [];
							try {
								do {
									tokens[input.idx] = input.tokens;
								} while(input = input.tail());
							}
							catch(e) {
								// Ignore the error, it's due to hitting the end of input.
							}
							return tokens;
						};
					parse = function(forceParseToLine, includeBuffer) {
						var ometaEditor = modeOpts.getOMetaEditor();
						if(ometaEditor == null) {
							return;
						}
						var text = ometaEditor.getValue(),
							parseToLine = 0,
							prependText = '';
						if(modeOpts.hasOwnProperty('prependText')) {
							prependText = modeOpts.prependText();
						}
						if(forceParseToLine != null) {
							parseToLine = Math.min(ometaEditor.lastLine(), forceParseToLine);
						}
						if(options.enableVisibleOnlyHighlighting) {
							parseToLine = Math.max(parseToLine, ometaEditor.getViewport().to);
						}
						// We only regenerate tokens if the text has changed, or the last visible line is further down than before.
						if((limitedHighlighting && parseToLine > prevParsedToLine) || text != previousText) {
							previousText = text;
							if(limitedHighlighting) {
								if(includeBuffer) {
									parseToLine = Math.min(ometaEditor.lastLine(), parseToLine + options.lineByLineBuffer)
								}
								prevParsedToLine = parseToLine;
								var lastVisibleIndex = 0;
								for(var i = 0; i <= parseToLine; i++) {
									lastVisibleIndex = text.indexOf('\n', lastVisibleIndex);
									if(lastVisibleIndex === -1) {
										// We were on the last line so found no newline character, which means we just use the full text rather than partial.
										lastVisibleIndex = text.length;
										break;
									}
									// Increment the pointer to get to the start of the next line.
									lastVisibleIndex++;
								}
								// Trim the text to only what is visible before parsing it.
								text = text.slice(0, lastVisibleIndex);
							}
							text = prependText + text;
							var grammar = getGrammar();
							try {
								previousParseResult = grammar.matchAll(text, 'Process');
							}
							finally {
								// We always want to build the tokens to highlight,
								// even if we hit an error (failed to parse the text),
								// since they're probably just in the middle of typing.
								tokens = buildTokens(grammar.inputHead);
								tokensOffset = prependText.length;
							}
						};
						return previousParseResult;
					};
					fullParse = function() {
						return parse(Infinity);
					};
				})(),
				mode = {
					copyState: function(state) {
						return {
							line: state.line,
							index: state.index, // The index from the very first token.
							previousIndex: state.previousIndex,
							currentTokens: state.currentTokens
						};
					},

					startState: function() {
						return {
							line: 0,
							index: tokensOffset,
							previousIndex: -1,
							currentTokens: []
						};
					},

					blankLine: eol,

					token: function(stream, state) {
						if(stream.sol()) {
							try {
								if(options.enableLineByLineParsing) {
									parse(state.line, true);
								}
								else {
									parse();
								}
							}
							catch(e) {
								if(!(e instanceof SyntaxError)) {
									// Only throw the error if it's not a standard matching error (they'll happen a lot as the user is typing)
									throw e;
								}
							}
						}

						addNewTokens(state, tokens);

						if(state.currentTokens.length > 0) {
							return applyTokens(stream, state);
						}

						// Advance the stream and state pointers until we hit a token.
						for(stream.pos++, state.index++; stream.pos < stream.string.length; stream.pos++ && state.index++) {
							if(tokens[state.index] != null) {
								return null;
							}
						}
						// We hit the end of the stream without finding a token, advance index for new line
						eol(state);
						return null;
					},

					indent: function(state, textAfter) {
						return 0; // We don't indent as we currently have no way of asking the grammar about indentation.
					},

					// This is used by hinter to provide hints for the grammar.
					getGrammar: function() {
						return ometaGrammar.createInstance();
					},
					prependText: function() {
						if(modeOpts.hasOwnProperty('prependText')) {
							return modeOpts.prependText();
						}
						return '';
					},
					fullParse: fullParse
				};

			for(var key in options.modeExtensions) {
				if(options.modeExtensions.hasOwnProperty(key)) {
					mode[key] = options.modeExtensions[key];
				}
			}
			return mode;
		});

		if(mimeType != null) {
			CodeMirror.defineMIME(mimeType, modeName);
		}
	};
}));