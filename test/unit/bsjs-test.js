var common = require('../fixtures/common');

exports['bsjsparser should generate ast'] = function(test) {
  var ast;
  test.doesNotThrow(function() {
    ast = common.ometajs.BSJSParser.matchAll('var x = 1', 'topLevel');
  });

  test.ok(Array.isArray(ast));
  test.done();
};

exports['bsjsidentity should not change ast'] = function(test) {
  var ast1,
      ast2;

  test.doesNotThrow(function() {
    ast1 = common.ometajs.BSJSParser.matchAll('var x = 1', 'topLevel');
    ast2 = common.ometajs.BSJSIdentity.matchAll([ast1], 'trans');
  });

  test.ok(Array.isArray(ast1));
  test.ok(Array.isArray(ast2));

  test.deepEqual(ast1, ast2);

  test.done();
};

exports['bsjstranslator should compile to js'] = function(test) {
  var ast,
      code;

  test.doesNotThrow(function() {
    ast = common.ometajs.BSJSParser.matchAll('var x = 1', 'topLevel');
    code = common.ometajs.BSJSTranslator.matchAll([ast], 'trans');
  });

  test.ok(Array.isArray(ast));
  test.ok(/var\s+x/.test(code));

  test.done();
};

addCompilerTest = function(src, expectation) {
  var ast,
      code;

  exports['js-compiler should compile "' + src + '"'] = function(test) {
    test.doesNotThrow(function() {
      ast = common.ometajs.BSJSParser.matchAll(src, 'topLevel');
      code = common.ometajs.BSJSTranslator.matchAll([ast], 'trans');
    });

    test.ok(Array.isArray(ast), 'expected AST to be an Array');
    test.ok(expectation.test(code), 'expected "' + code + '" to match: "'+ expectation + '"');

    test.done();
  };
};

shouldCompile = function(src) {
  return {to: function(expectation) {addCompilerTest(src, expectation)}};
};

var parens = function(it) {return '\\(' + it + '\\)'}
var spaces = function(it) {return '\\s*' + it + '\\s*'}
var escape = function(it) {
  shoulBeEscaped = ['*', '+', '^']
  return shoulBeEscaped.indexOf(it) > -1 ? '\\' + it : it
}

testBinop = function(op1, op, op2) {
  eop = escape(op)
  regexp1 = new RegExp('var\\s+x' + spaces('=') + parens(parens(op1) + spaces(eop) + parens(op2)))
  regexp2 = new RegExp(parens('x' + spaces(eop + '=') + parens(op1)))
  shouldCompile('var x = ' + op1 + op + op2).to(regexp1)
  shouldCompile('var x = ' + op1 + ' ' + op + ' ' + op2).to(regexp1)
  shouldCompile('x ' + op + '= ' + op1).to(regexp2)
};

testUnary = function(op, op1) {
  regexp = new RegExp('var\\s+x' + spaces('=') + parens(spaces(op) + parens(op1)))
  shouldCompile('var x = ' + op + op1).to(regexp)
};

shouldCompile('var x = 1').to(/var\s+x/)

testBinop('1', '+', '2')
testBinop('1', '-', '2')

// bitweise operators
testUnary('~', '0')
testBinop('1', '&', '2')
testBinop('0', '|', '1')
testBinop('0', '^', '1')
