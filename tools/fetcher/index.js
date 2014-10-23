var fs = require('fs')
var events = require('events')
var util = require('util')

var APP_PATH = __dirname.replace(/yoshioka\.js.*$/, '')

function Fetcher(config) {
  config = config || {};
  events.EventEmitter.call(this);

  this._filecount = 0;
  this.dirs = config.dirs ? config.dirs : [];
  this.files = config.files ? config.files : [];
}

util.inherits(Fetcher, events.EventEmitter);

/**
 * Fetch application files
 */
Fetcher.prototype.fetch = function() {
  this.dirs.forEach(function(path) {
    this._filecount++
    this._parseDir(path)
  }, this)

  this.files.forEach(function(path) {
    this._filecount++
    this._parseFile(path)
  }, this)
}

/**
 * Parse a directory
 */
Fetcher.prototype._parseDir = function(path) {
  fs.readdirSync(APP_PATH+path).forEach(function(d) {
    // Ignore dotfiles
    if (d[0] == '.') return

    this._filecount++

    var file = path + '/' + d
    var stat = fs.statSync(APP_PATH + path + '/' + d)
    if (stat.isDirectory()) {
      this._parseDir(file)
    } else if (stat.isFile()) {
      this._parseFile(file)
    }
  }, this)

  this._parseComplete()
}

/**
 * Parse a file
 */
Fetcher.prototype._parseFile = function(path) {
  this._parseComplete()
}

Fetcher.prototype._parseComplete = function() {
  this._filecount--
  this._checkFileCount()
}

/**
 * Check the file count. Fire a `end` event if equal to 0.
 */
Fetcher.prototype._checkFileCount = function() {
  if (this._filecount === 0) {
    this.emit('parseEnd')
  }
}

/**
 * Create dirs recursively from a path
 */
Fetcher.prototype._mkdir = function(path, basepath) {
  basepath = basepath.replace(/\/\/+/g, '/')

  var file = (file = path.split(/\//)) && file[file.length - 1]
  var dir = path.replace(file, '')
  var parts = basepath || ''

  dir.split(/\//).forEach(function(part) {
    parts += part + '/'
    fs.existsSync(parts) || fs.mkdirSync(parts, 0755)
  })
}

exports.Fetcher = Fetcher
