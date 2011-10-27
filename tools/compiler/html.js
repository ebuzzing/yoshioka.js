(function() {

var

APP_PATH = __dirname.replace(/yoshioka\.js.*$/, '')+'/',
BR = '[[__BR__]]',
BR_REG = /\[\[__BR__\]\]/g,
CSS_BLOCK_REG = /\{css\}(.*?)\{\/css\}/gi,
fs = require('fs'),

CSSCompiler = require('./css').CSSCompiler,

HTMLCompiler = function(config)
{
	this.init(config);
};
HTMLCompiler.prototype =
{
	_file: null,
	_filecontent: '',
	
	init: function(config)
	{
		config || (config = {});
		
		this._file = config.file;
		
		this._basepath =
			(config.basepath ||
			this._getFilePath()
				.replace(/\/+/gi, '/')
				.replace(/\/$/, ''));
		
		this._filecontent = config.filecontent;
	},
	
	/**
	 * Parse HTML file :
	 * - replace {$basepath} variable by the environment basepath
	 * - compile {css}{/css} blocks
	 */
	parse: function(callback)
	{
		if (!this._filecontent)
		{
			this._filecontent = fs.readFile(
				APP_PATH+'/'+this._file,
				function(callback, err, data)
				{
					this._filecontent = data.toString();
					this._parse(callback);
				}.bind(this, callback)
			);
		}
		else
		{
			this._parse(callback);
		}
	},
	_parse: function(callback)
	{
		/**
		 * Replace some tags
		 */
		this._filecontent = this._filecontent
			.replace(
				/\{\$basepath\}/gi,
				this._basepath);
		
		/**
		 * specials tags
		 */
		this._filecontent = this._filecontent.replace(/\n/g, BR);
		
		this._parseCSSBlock(callback);
	},
	_parseCSSBlock: function(callback)
	{
		var block = this._filecontent.match(CSS_BLOCK_REG)
		if (block)
		{
			this._compileCSSBlock(
				block[0].replace(
					BR_REG,
					"\n"
				),
				callback
			);
		}
		
		this._finishParsing(callback);
	},
	_finishParsing: function(callback)
	{
		this._filecontent = this._filecontent.replace(
			BR_REG,
			"\n"
		);
		
		if (callback)
		{
			return callback(this._filecontent);
		}
		return this._filecontent;
	},
	
	/**
	 * Compile the text between two {css}{/css} block tags
	 */
	_compileCSSBlock: function(block, callback)
	{
		var c = new CSSCompiler({
			filecontent: block.replace(/\{css\}/, '')
							  .replace(/\{\/css\}/, '')
		});
		c.parse(function(block, callback, content)
		{
			this._filecontent = this._filecontent.replace(block.replace(/\n/g, BR), content);
			this._parseCSSBlock(callback);
		}.bind(this, block, callback));
	},
	
	/**
	 * Get the file path without filename
	 */
	_getFilePath: function()
	{
		var path;
		if (!this._file)
		{
			return '/';
		}
		path = this._file.split(/\//);
		path.pop();
		return path.join('/').replace(APP_PATH, '');
	}
};
exports.HTMLCompiler = HTMLCompiler;
	
})();
