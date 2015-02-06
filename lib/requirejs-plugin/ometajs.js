define(['cache', 'ometa-parsers', 'uglify-js'], function (cache, OMetaCompiler, UglifyJS) {
	'use strict';
	var compressor = UglifyJS.Compressor({
		sequences: false,
		drop_debugger: false,
		unused: false // We need this off for OMeta
	}),
	parseError = function(instance, e) {
		var source = instance.input.lst,
			idx = e.OMeta.idx,
			start = Math.max(idx - 30, source.lastIndexOf('\n', idx - 1) + 1, 0),
			end = Math.min(idx + 30, source.indexOf('\n', idx), source.length);
		throw new Error(
			'Parsing error at: ' + e.OMeta.line + ':' + e.OMeta.col + '\n' +
			'Around: ' + source.substring(start, end) + '\n' +
			'Around: ' + source.substring(Math.max(start, idx - 2), Math.min(end, idx + 2))
		);
		throw e;
	},
	compileOMeta = function (source) {
		var tree = OMetaCompiler.BSOMetaJSParser.matchAll(source, "topLevel", undefined, parseError),
			js = OMetaCompiler.BSOMetaJSTranslator.match(tree, "trans"),
			ast;
		if(!/(?:\s|^)define(?:\s*)\(/.test(js)) {
			// If there is no explicit define statement then redirect exports to the window object.
			js = 'var exports = exports || window;' + js;
		}
		ast = UglifyJS.parse(js);
		ast.figure_out_scope();
		ast = ast.transform(compressor);
		js = ast.print_to_string({
			beautify: true
		});
		return js;
	};
	return cache(function(source) {
		return compileOMeta(source);
	}, function(name, parentRequire) {
		return parentRequire.toUrl(name + '.ometajs');
	});
});
