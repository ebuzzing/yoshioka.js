var fs = require('fs')
var util = require('util')
var basename = require('path').basename
var getconfig = require('./getconfig')
var Fetcher = require('../fetcher').Fetcher

var APP_PATH = __dirname.replace(/yoshioka\.js.*$/, '')

/**
 * Make the YUI_config file from all the application files and config
 * @class Maker
 */
function Maker(config) {
  config = config || {}
  Fetcher.call(this, config)

  this.basepath = config.basepath || '/'
  this._buildpath = config.buildpath || APP_PATH
  this._modules = {}
  this._dev = config.dev
  this._tests = config.tests

  this._appConfig = getconfig.getConfig({
    dev: this._dev,
    tests: this._tests,
    buildname: config.buildname || ''
  })

  if (!Array.isArray(this._appConfig.exclude)) {
    this._appConfig.exclude = this._appConfig.exclude != null ? [this._appConfig.exclude] : []
  }
}

util.inherits(Maker, Fetcher)

/**
 * Parse a file
 */
Maker.prototype._parseFile = function(path) {
  var excluded = (this._appConfig.exclude || []).some(function(e) {
    return path.match(RegExp(e.replace('*', '[^/]+')))
  })

  if (excluded) {
    this._parseComplete()
    return
  }

  if (path.match(/\.js$/) && !path.match(/test\.js$/)) {
    this._parseJSFile(path)
  } else if (path.match(/\.css$/)) {
    this._parseCSSFile(path)
  } else if (path.match(/\.html$/)) {
    this._parseHTMLFile(path)
  } else {
    this._parseStaticFile(path)
  }
}

Maker.prototype._parseJSFile = function(path) {
  var script = fs.readFileSync(APP_PATH+path).toString()

  // Parse JS comments
  var module = script.match(/\@module ([a-zA-Z0-9\/\-\_]+)/)
  if (module) {
    module = module[1]
    this._modules[module] = {path: path}

    var requires = script.replace(/\n|\r/g, '').match(/\/\*.*?\*\//);
    if (requires && (requires = requires[0].match(/\@requires ([a-zA-Z0-9\/\-\_\,\.\s\*]+)\s\*(\/|\s@)/))) {
      this._modules[module].requires = requires[1]
        .replace(/\s\*/g, '')
        .replace(/,$/, '')
        .replace(/\s/g, '')
        .replace(/\*/g, '')
        .split(/,/)
    }
  }

  this._parseComplete()
}

Maker.prototype._parseCSSFile = function(path)
{
  var module = path.match(/([^\/]+)\/assets\//)
  if (module) {
    module = module[1]
  } else {
    throw 'CSS file unknown path: ' + path
  }

  var fullpath = this._appConfig.ys_app +
    (path.match(/^plugins\//) ? '/plugins/' : '/views/') + module + '/assets/' +
    basename(path, '.css')

  this._modules[fullpath] = {}
  this._modules[fullpath].path = path
  this._modules[fullpath].type = 'css'

  this._parseComplete()
}

Maker.prototype._parseStaticFile = function() {
  this._parseComplete()
}

Maker.prototype._parseHTMLFile = function() {
  this._parseComplete()
}

/**
 * Check the file count. Fire a `end` event if equal to 0.
 */
Maker.prototype._checkFileCount = function() {
  if (this._filecount === 0) {
    this.emit('parseEnd', this._appConfig)
  }
}

// Write config file
Maker.prototype.writeConfig = function(config)
{
    /**
     * Get the default config file
     */
    var coreConfig, YUI_config, filename;

    filename = (true === config.tests) ? 'tconfig.js' : 'config.js'

    try
    {
        coreConfig = fs.readFileSync(
            APP_PATH+'yoshioka.js/core/core_config.js'
        ).toString();
    }
    catch (e)
    {
        throw new Error("Core config is missing. Please restore the yoshioka.js/core/core_config.js file.\n");
    }

    /**
     * Set YUI_config default values
     */
    YUI_config = this._appConfig;
    YUI_config.ys_app || (YUI_config.ys_app = 'ys');
    YUI_config.ys_mainview || (YUI_config.ys_mainview = 'main');
    YUI_config.groups || (YUI_config.groups = {});
    YUI_config.groups.core = JSON.parse(coreConfig);
    YUI_config.groups.core.base = this.basepath;

    /**
     * App group config
     */
    YUI_config.groups[YUI_config.ys_app] = YUI_config.groups[YUI_config.ys_app] || {};
    YUI_config.groups[YUI_config.ys_app].modules = this._modules;
    YUI_config.groups[YUI_config.ys_app].base = this.basepath;

    fs.writeFileSync(
        (config.path || '')+'config/'+filename,
        'YUI_config=' + JSON.stringify(YUI_config) + ';'
    );
    this.emit('writeEnd');
};

exports.Maker = Maker
